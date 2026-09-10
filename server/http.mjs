import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { FileStore } from './store.mjs';
import { BoardService, RequestError } from './service.mjs';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const artifactPolicy = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json') || req.headers['x-prototype-board'] !== '1') {
    throw new RequestError(415, 'JSON과 X-Prototype-Board: 1 헤더가 필요합니다.');
  }
  if (Number(req.headers['content-length']) > 2_000_000) { req.resume(); throw new RequestError(413, '요청은 2MB 이하여야 합니다.'); }
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= 2_000_000) chunks.push(chunk);
  }
  if (size > 2_000_000) throw new RequestError(413, '요청은 2MB 이하여야 합니다.');
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new RequestError(400, 'JSON 형식을 확인하세요.'); }
}

/**
 * 화면과 API를 같은 로컬 주소로 제공한다. 임의의 파일 경로나 명령은 받지 않는다.
 * 외부 사이트의 요청을 거부하지만, 같은 컴퓨터의 다른 프로그램을 막는 인증 기능은 아니다.
 * HTML 시안은 별도 sandbox로 실행해 보드 API·브라우저 저장소·외부 연결에 접근하지 못하게 한다.
 */
export async function startServer({ directory, dist, port, host, publicOrigin }) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('서버 포트가 올바르지 않습니다.');
  if (!host || typeof host !== 'string') throw new Error('서버 바인딩 주소가 필요합니다.');
  if (publicOrigin) {
    const parsed = new URL(publicOrigin);
    if (parsed.protocol !== 'http:' || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error('공개 보드 주소는 http URL이어야 합니다.');
  }
  const store = await new FileStore(directory).open();
  const service = new BoardService(store);
  let boundOrigin;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const requestOrigin = `http://${req.headers.host}`;
      const requestHost = new URL(requestOrigin).hostname;
      const sameOrigin = publicOrigin ? requestOrigin === publicOrigin : ['127.0.0.1', 'localhost', '[::1]'].includes(requestHost);
      if (!sameOrigin || (req.headers.origin && req.headers.origin !== requestOrigin)
        || req.headers['sec-fetch-site'] === 'cross-site') throw new RequestError(403, '이 로컬 보드에서 시작한 요청만 허용합니다.');
      const url = new URL(req.url, requestOrigin); const path = url.pathname;
      if (req.method === 'GET' && path === '/health') return json(res, 200, { service: 'prototype-board', version: '0.2.0', workspaceId: store.read().workspaceId, url: requestOrigin });
      if (req.method === 'GET' && path === '/api/board') return json(res, 200, service.board());
      const artifactRoute = /^\/api\/artifacts\/(artifact-[a-f0-9-]+)$/.exec(path);
      if (req.method === 'GET' && artifactRoute) {
        const artifact = service.board().artifacts.find((item) => item.id === artifactRoute[1]);
        if (!artifact) throw new RequestError(404, '결과물을 찾을 수 없습니다.');
        const content = await store.readArtifact(artifact);
        res.setHeader('Content-Security-Policy', artifactPolicy);
        res.writeHead(200, { 'Content-Type': `${artifact.kind === 'html' ? 'text/html' : 'text/plain'}; charset=utf-8` });
        return res.end(content);
      }
      if (req.method === 'POST' && path.startsWith('/api/')) {
        if (req.headers['x-prototype-board-workspace'] !== store.read().workspaceId) throw new RequestError(409, '대상 보드가 다릅니다. 연결 설정을 확인하세요.');
        const payload = await body(req); let result;
        const events = /^\/api\/runs\/(run-[a-f0-9-]+)\/events$/.exec(path);
        const artifacts = /^\/api\/ideas\/(idea-[a-f0-9-]+)\/artifacts$/.exec(path);
        if (path === '/api/projects') result = await service.createProject(payload);
        else if (path === '/api/ideas') result = await service.createIdea(payload);
        else if (path === '/api/review') result = await service.review(payload);
        else if (events) result = await service.event(events[1], payload);
        else if (artifacts) result = await service.artifact(artifacts[1], payload);
        else throw new RequestError(404, '지원하지 않는 API입니다.');
        return json(res, 200, { ...result, ...(result.route ? { url: `${requestOrigin}/${result.route}` } : {}) });
      }
      if (path.startsWith('/api/') || !['GET', 'HEAD'].includes(req.method)) throw new RequestError(404, '경로를 찾을 수 없습니다.');
      const root = await realpath(dist);
      const decoded = decodeURIComponent(path);
      let file = resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
      if (!file.startsWith(`${root}${sep}`)) throw new RequestError(404, '경로를 찾을 수 없습니다.');
      try { file = await realpath(file); }
      catch { throw new RequestError(404, '화면 파일이 없습니다. npm run build를 먼저 실행하세요.'); }
      if (!file.startsWith(`${root}${sep}`)) throw new RequestError(404, '경로를 찾을 수 없습니다.');
      const content = await readFile(file);
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      res.writeHead(200, { 'Content-Type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8` });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error instanceof RequestError ? error.status : error instanceof URIError ? 400 : 500;
      if (status === 500) console.error('요청 처리 실패:', error.message);
      if (!res.headersSent) json(res, status, { error: status === 500 ? '로컬 서버에서 요청을 처리하지 못했습니다. 서버 로그를 확인하세요.' : error.message });
      else res.end();
    }
  });
  try {
    await new Promise((done, fail) => { server.once('error', fail); server.listen(port, host, done); });
    boundOrigin = publicOrigin ?? `http://${host}:${server.address().port}`;
  } catch (error) { await store.close(); throw error; }
  let closed = false;
  return { origin: boundOrigin, service, store, async close() {
    if (closed) return; closed = true;
    await new Promise((done, fail) => server.close((error) => error ? fail(error) : done()));
    await store.close();
  } };
}
