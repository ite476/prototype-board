#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';

/**
 * 설치 위치와 무관하게 동작하는 로컬 보드 클라이언트. 외부 라이브러리가 필요 없다.
 * 개인 보드를 기본 대상으로 추정하지 않는다. 저장소 연결 파일이나 명시한 프로필이 있어야 한다.
 * 접수 식별자는 호출자가 보관한다. 재시도할 때 같은 내용·같은 식별자를 사용한다.
 */
const profileDirectory = join(homedir(), '.config', 'prototype-board', 'profiles');
const { values, positionals } = parseArgs({ allowPositionals: true, options: Object.fromEntries([
  'profile', 'config', 'file', 'idea', 'run', 'kind', 'name', 'label', 'title', 'summary', 'status', 'message', 'request-id',
].map((key) => [key, { type: 'string' }])) });
const command = positionals[0];
const output = (value) => console.log(JSON.stringify(value, null, 2));
const required = (key) => { if (!values[key]) throw new Error(`--${key} 값이 필요합니다.`); return values[key]; };
const readJson = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
const usage = { commands: ['profiles', 'doctor', 'projects', 'project-create --file project.json', 'register --file request.json', 'status --run RUN_ID', 'event --run RUN_ID --status planning --message 설명 --request-id ID', 'artifact --idea IDEA_ID --run RUN_ID --kind plan|html|source --file PATH --request-id ID'], connection: '--profile NAME 또는 --config PATH. 생략 시 현재 디렉터리의 상위 경로에서 .prototype-board.local.json을 찾습니다.' };

async function configuration() {
  if (values.profile && values.config) throw new Error('--profile과 --config 중 하나만 지정하세요.');
  let path = values.config ? resolve(values.config) : undefined;
  if (values.profile) {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(values.profile)) throw new Error('프로필 이름은 영문 소문자·숫자·하이픈을 사용하세요.');
    path = join(profileDirectory, `${values.profile}.json`);
  }
  if (!path) {
    let directory = process.cwd();
    while (true) {
      const candidate = join(directory, '.prototype-board.local.json');
      try { if ((await stat(candidate)).isFile()) { path = candidate; break; } }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const parent = dirname(directory); if (parent === directory) break; directory = parent;
    }
  }
  if (!path) throw new Error('연결한 보드가 없습니다. 저장 대상을 확인한 뒤 --profile NAME 또는 --config PATH를 지정하세요. 개인 보드로 자동 접수하지 않았습니다.');
  const config = await readJson(path); const url = new URL(config.baseUrl);
  const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (url.protocol !== 'http:' || !loopback || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('초안에서는 localhost·127.x.x.x·[::1]의 로컬 보드만 연결할 수 있습니다.');
  if (typeof config.workspaceId !== 'string' || !config.workspaceId || typeof config.projectId !== 'string' || !config.projectId) throw new Error('설정에 workspaceId와 projectId가 필요합니다.');
  return { ...config, baseUrl: url.origin, configPath: path };
}

async function main() {
  if (!command || command === 'help') return output(usage);
  if (command === 'profiles') {
    let entries = []; try { entries = await readdir(profileDirectory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return output({ profiles: entries.filter((name) => /^[a-z0-9][a-z0-9-]*\.json$/.test(name)).map((name) => name.slice(0, -5)) });
  }
  const config = await configuration();
  const call = async (path, payload) => {
    const response = await fetch(`${config.baseUrl}${path}`, { method: payload ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: payload ? { 'Content-Type': 'application/json', 'X-Prototype-Board': '1', 'X-Prototype-Board-Workspace': config.workspaceId } : {},
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('보드 API가 아닌 응답입니다. 포트와 서버를 확인하세요.');
    const result = await response.json();
    if (!response.ok) throw new Error(`${response.status}: ${result.error ?? '요청 실패'}`);
    return result;
  };
  const health = await call('/health');
  if (health.service !== 'prototype-board' || health.workspaceId !== config.workspaceId) throw new Error('설정한 보드와 실제 실행 중인 보드가 다릅니다. 아무것도 저장하지 않았습니다.');
  if (command === 'doctor') {
    const board = await call('/api/board');
    const screen = await fetch(`${config.baseUrl}/`, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!screen.ok || !screen.headers.get('content-type')?.includes('text/html')) throw new Error('저장 API는 응답하지만 화면을 열 수 없습니다. 지정한 실행 저장소에서 npm run build 결과를 확인하세요.');
    await screen.text();
    return output({ ok: true, baseUrl: config.baseUrl, workspaceId: config.workspaceId, projectId: config.projectId,
      frontendReady: true, projectExists: board.projects.some((project) => project.id === config.projectId), configPath: config.configPath, revision: board.revision });
  }
  if (command === 'projects') return output((await call('/api/board')).projects);
  if (command === 'project-create') {
    const payload = await readJson(required('file'));
    if (payload.id !== config.projectId) throw new Error('만들 프로젝트와 연결 설정이 다릅니다. 대상을 확인하세요.');
    return output(await call('/api/projects', payload));
  }
  if (command === 'register') {
    const payload = await readJson(required('file'));
    if (payload.projectId && payload.projectId !== config.projectId) throw new Error('요청과 연결 설정의 프로젝트가 다릅니다. 대상부터 확인하세요.');
    return output(await call('/api/ideas', { ...payload, projectId: config.projectId }));
  }
  if (command === 'status') {
    const board = await call('/api/board'); const run = board.runs.find((item) => item.id === required('run'));
    if (!run || !board.ideas.some((idea) => idea.id === run.ideaId && idea.projectId === config.projectId)) throw new Error('연결한 프로젝트에서 작업을 찾을 수 없습니다.');
    return output(run);
  }
  if (command === 'event') {
    if (!/^run-[a-f0-9-]+$/.test(required('run'))) throw new Error('작업 식별자를 확인하세요.');
    const board = await call('/api/board'); const run = board.runs.find((item) => item.id === values.run);
    if (!run || !board.ideas.some((idea) => idea.id === run.ideaId && idea.projectId === config.projectId)) throw new Error('연결한 프로젝트의 작업이 아닙니다.');
    return output(await call(`/api/runs/${values.run}/events`, { status: required('status'), message: required('message'), requestId: required('request-id') }));
  }
  if (command === 'artifact') {
    if (!/^idea-[a-f0-9-]+$/.test(required('idea'))) throw new Error('주제 식별자를 확인하세요.');
    const board = await call('/api/board');
    if (!board.ideas.some((idea) => idea.id === values.idea && idea.projectId === config.projectId)) throw new Error('연결한 프로젝트의 주제가 아닙니다.');
    const path = resolve(required('file')); if ((await stat(path)).size > 1_500_000) throw new Error('파일은 1.5MB 이하여야 합니다.');
    return output(await call(`/api/ideas/${values.idea}/artifacts`, { runId: required('run'), kind: required('kind'), name: values.name ?? basename(path),
      content: await readFile(path, 'utf8'), label: values.label, title: values.title, summary: values.summary, requestId: required('request-id') }));
  }
  throw new Error('지원하지 않는 명령입니다. help로 사용법을 확인하세요.');
}
main().catch((error) => { console.error(JSON.stringify({ error: error.cause?.code ? `${error.message}: ${error.cause.code}. 로컬 서버와 연결 설정을 확인하세요.` : error.message })); process.exitCode = 1; });
