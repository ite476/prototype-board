import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { startServer } from '../server/http.mjs';
import { FileStore } from '../server/store.mjs';
import { stageOf } from '../src/core/board.ts';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'prototype-board-test-'));
  const dist = join(root, 'dist'); await mkdir(dist); await writeFile(join(dist, 'index.html'), '<h1>보드</h1>');
  const directory = join(root, 'data');
  let runtime = await startServer({ directory, dist, port: 0, host: '127.0.0.1' });
  t.after(async () => { await runtime.close(); await rm(root, { recursive: true, force: true }); });
  const headers = () => ({ 'Content-Type': 'application/json', 'X-Prototype-Board': '1', 'X-Prototype-Board-Workspace': runtime.service.board().workspaceId });
  const request = async (path, payload, extra = {}) => {
    const response = await fetch(`${runtime.origin}${path}`, { method: payload ? 'POST' : 'GET', headers: { ...headers(), ...extra }, body: payload ? JSON.stringify(payload) : undefined });
    return { status: response.status, body: await response.json() };
  };
  const send = async (path, payload) => { const result = await request(path, { requestId: randomUUID(), ...payload }); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; };
  await send('/api/projects', { id: 'personal', name: '개인 기획' });
  const idea = (extra = {}) => send('/api/ideas', { projectId: 'personal', title: '확인할 기획', summary: '검토할 내용을 모읍니다.', ...extra });
  const event = (runId, status) => send(`/api/runs/${runId}/events`, { status, message: `${status} 단계입니다.` });
  const artifact = (item, kind, content) => send(`/api/ideas/${item.ideaId}/artifacts`, { runId: item.runId, kind, name: kind === 'plan' ? 'plan.md' : 'preview.html', content });
  return { root, dist, directory, get runtime() { return runtime; }, request, send, idea, event, artifact, async restart() { await runtime.close(); runtime = await startServer({ directory, dist, port: 0, host: '127.0.0.1' }); } };
}

test('접수·문서·HTML·검토·개발 준비 결과가 서버 재시작 후 유지된다', async (t) => {
  const f = await fixture(t); const item = await f.idea();
  assert.ok(item.url.endsWith(`/review/${item.ideaId}`));
  await f.event(item.runId, 'planning');
  const content = '# 기획\n\n한 줄의 기획입니다.\n';
  const plan = await f.artifact(item, 'plan', content);
  await f.event(item.runId, 'drafting');
  const html = await f.artifact(item, 'html', '<!doctype html><button onclick="this.textContent=\'확인됨\'">확인</button>');
  await f.event(item.runId, 'review-ready');
  let data = f.runtime.service.board();
  assert.equal(data.runs[0].events.length, 6);
  assert.equal(data.artifacts[0].sha256, createHash('sha256').update(content).digest('hex'));
  assert.equal(data.ideas[0].selectedProposalId, undefined, '검토 요청은 자동 채택이 아니다');
  await f.send('/api/review', { type: 'decision', ideaId: item.ideaId, proposalId: html.proposalId, expectedRevision: data.revision });
  for (const check of f.runtime.service.board().proposals[0].readiness) {
    await f.send('/api/review', { type: 'readiness', proposalId: html.proposalId, itemId: check.id, complete: true, expectedRevision: f.runtime.service.board().revision });
  }
  data = f.runtime.service.board(); assert.equal(stageOf(data, data.ideas[0]), 'development-ready');
  await f.restart(); assert.deepEqual(f.runtime.service.board(), data);
  const response = await fetch(`${f.runtime.origin}/api/artifacts/${plan.artifactId}`);
  assert.equal(await response.text(), content);
  assert.equal((await fetch(f.runtime.origin)).status, 200);
});

test('같은 요청은 재시도해도 한 번만 저장하고 다른 내용이면 충돌을 알린다', async (t) => {
  const f = await fixture(t);
  const payload = { requestId: 'stable-request', projectId: 'personal', title: '중복 확인', summary: '요약' };
  const results = await Promise.all(Array.from({ length: 8 }, () => f.request('/api/ideas', payload)));
  assert.ok(results.every((item) => item.status === 200 && item.body.ideaId === results[0].body.ideaId));
  assert.equal(f.runtime.service.board().ideas.length, 1);
  assert.equal((await f.request('/api/ideas', { ...payload, title: '다른 내용' })).status, 409);
  await f.restart();
  assert.equal((await f.request('/api/ideas', payload)).body.ideaId, results[0].body.ideaId);
});

test('동시 접수를 모두 보관하고 오래된 검토 저장으로 다른 기록을 덮어쓰지 않는다', async (t) => {
  const f = await fixture(t);
  await Promise.all(Array.from({ length: 20 }, (_, index) => f.idea({ title: `기획 ${index}` })));
  assert.equal(f.runtime.service.board().ideas.length, 20);
  assert.equal(new Set(f.runtime.service.board().ideas.map((item) => item.id)).size, 20);
  const before = f.runtime.service.board();
  assert.equal((await f.request('/api/review', { requestId: 'stale', expectedRevision: 0, type: 'decision', ideaId: before.ideas[0].id })).status, 409);
  assert.deepEqual(f.runtime.service.board(), before);
});

test('필수 결과물과 순서가 맞아야 검토 요청으로 전환한다', async (t) => {
  const f = await fixture(t); const item = await f.idea();
  const next = (status) => f.request(`/api/runs/${item.runId}/events`, { requestId: randomUUID(), status, message: '단계 전환' });
  assert.equal((await next('review-ready')).status, 409);
  await f.event(item.runId, 'planning');
  assert.equal((await next('review-ready')).status, 409);
  await f.artifact(item, 'plan', '# 기획');
  assert.equal((await next('review-ready')).status, 409);
  await f.event(item.runId, 'blocked');
  await f.event(item.runId, 'planning'); await f.event(item.runId, 'drafting');
  await f.artifact(item, 'html', '<h1>시안</h1>'); await f.event(item.runId, 'review-ready');
  assert.equal((await next('planning')).status, 409);
  const planning = await f.idea({ scope: 'planning' });
  await f.event(planning.runId, 'planning'); await f.artifact(planning, 'plan', '# 문서만'); await f.event(planning.runId, 'review-ready');
});

test('다른 사이트·잘못된 보드 식별자·잘못된 입력으로 저장할 수 없다', async (t) => {
  const f = await fixture(t); const payload = { requestId: randomUUID(), projectId: 'personal', title: '제목', summary: '요약' };
  assert.equal((await f.request('/api/ideas', payload, { Origin: 'https://example.invalid' })).status, 403);
  const hostStatus = await new Promise((done, fail) => {
    httpRequest(`${f.runtime.origin}/health`, { headers: { Host: 'example.invalid' } }, (response) => { response.resume(); done(response.statusCode); }).on('error', fail).end();
  });
  assert.equal(hostStatus, 403);
  assert.equal((await f.request('/api/ideas', payload, { 'X-Prototype-Board-Workspace': 'different' })).status, 409);
  assert.equal((await f.request('/api/ideas', payload, { 'X-Prototype-Board': '' })).status, 415);
  assert.equal((await f.request('/api/ideas', { ...payload, projectId: 'missing' })).status, 404);
  assert.equal((await f.request('/api/ideas', { ...payload, requestId: '__proto__' })).status, 400);
  assert.equal((await f.request('/api/ideas', { ...payload, questions: [3] })).status, 400);
  assert.equal((await f.request('/api/ideas', { ...payload, brief: 'x'.repeat(2_000_000) })).status, 413);
  assert.equal(f.runtime.service.board().ideas.length, 0);
});

test('HTML은 외부 연결과 보드 접근을 막는 응답으로 제공하고 임의 파일을 노출하지 않는다', async (t) => {
  const f = await fixture(t); const item = await f.idea(); await f.event(item.runId, 'planning');
  const html = await f.artifact(item, 'html', '<script>fetch("/api/board")</script>');
  const response = await fetch(`${f.runtime.origin}/api/artifacts/${html.artifactId}`);
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /sandbox allow-scripts/); assert.match(policy, /connect-src 'none'/); assert.doesNotMatch(policy, /allow-same-origin/);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(`${f.runtime.origin}/api/artifacts/artifact-0000`)).status, 404);
  assert.equal((await fetch(`${f.runtime.origin}/server/main.mjs`)).status, 404);
  assert.equal((await f.request(`/api/ideas/${item.ideaId}/artifacts`, { requestId: randomUUID(), runId: item.runId, kind: 'plan', name: '../secret.md', content: 'secret' })).status, 400);
  await writeFile(join(f.root, 'outside.txt'), 'not public');
  await symlink(join(f.root, 'outside.txt'), join(f.dist, 'leak.txt'));
  assert.equal((await fetch(`${f.runtime.origin}/leak.txt`)).status, 404);
});

test('저장 폴더를 중복 실행하거나 손상된 데이터를 자동 초기화하지 않는다', async (t) => {
  const f = await fixture(t);
  await assert.rejects(new FileStore(f.directory).open(), /잠금|사용 중/);
  const broken = join(f.root, 'broken'); await mkdir(broken); await writeFile(join(broken, 'board.json'), '{broken');
  await assert.rejects(new FileStore(broken).open(), /기존 파일은 유지/);
  assert.equal(await readFile(join(broken, 'board.json'), 'utf8'), '{broken');
});

test('스냅샷 저장 실패 후 마지막 성공 상태를 유지하며 같은 요청을 다시 처리할 수 있다', async (t) => {
  const f = await fixture(t); const original = f.runtime.store.persist.bind(f.runtime.store); const before = f.runtime.service.board();
  f.runtime.store.persist = async () => { throw new Error('테스트용 저장 실패'); };
  const payload = { requestId: 'retry-after-storage-error', projectId: 'personal', title: '다시 저장', summary: '재시도' };
  await assert.rejects(f.runtime.service.createIdea(payload), /저장 실패/);
  assert.deepEqual(f.runtime.service.board(), before);
  f.runtime.store.persist = original;
  await f.runtime.service.createIdea(payload); assert.equal(f.runtime.service.board().ideas.length, 1);
});
