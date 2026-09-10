import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { startServer } from '../server/http.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../.agents/skills/prototype-board/scripts/board.mjs', import.meta.url));

test('설치 위치와 무관한 CLI로 접수하며 설정 없거나 보드가 다르면 쓰지 않는다', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'prototype-board-cli-test-'));
  const dist = join(root, 'dist'); await mkdir(dist); await writeFile(join(dist, 'index.html'), '<h1>보드</h1>');
  const runtime = await startServer({ directory: join(root, 'data'), dist, port: 0, host: '127.0.0.1' });
  t.after(async () => { await runtime.close(); await rm(root, { recursive: true, force: true }); });
  const workspaceId = runtime.service.board().workspaceId;
  const request = async (path, payload) => {
    const response = await fetch(`${runtime.origin}${path}`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Prototype-Board': '1', 'X-Prototype-Board-Workspace': workspaceId,
    }, body: JSON.stringify(payload) });
    const body = await response.text();
    assert.equal(response.status, 200, body);
    return JSON.parse(body);
  };
  await request('/api/projects', { requestId: randomUUID(), id: 'personal', name: '개인 기획' });
  const config = join(root, 'connection.json');
  await writeFile(config, JSON.stringify({ baseUrl: runtime.origin, workspaceId, projectId: 'personal' }));
  const input = join(root, 'request.json');
  await writeFile(input, JSON.stringify({ requestId: 'cli-stable', title: 'CLI 기획', summary: '접수를 확인합니다.', scope: 'planning' }));
  const run = async (...args) => JSON.parse((await exec(process.execPath, [cli, ...args], { cwd: root, timeout: 15000 })).stdout);
  assert.equal((await run('doctor', '--config', config)).projectExists, true);
  const result = await run('register', '--config', config, '--file', input);
  assert.ok(result.ideaId); assert.equal((await run('register', '--config', config, '--file', input)).ideaId, result.ideaId);
  await run('event', '--config', config, '--run', result.runId, '--status', 'planning', '--message', '기획 시작', '--request-id', 'cli-plan');
  const document = join(root, 'plan.md'); await writeFile(document, '# CLI 기획\n');
  assert.ok((await run('artifact', '--config', config, '--idea', result.ideaId, '--run', result.runId, '--kind', 'plan', '--file', document, '--request-id', 'cli-doc')).artifactId);
  await run('event', '--config', config, '--run', result.runId, '--status', 'review-ready', '--message', '기획 저장됨', '--request-id', 'cli-review');
  assert.equal((await run('status', '--config', config, '--run', result.runId)).status, 'review-ready');
  await assert.rejects(run('register', '--file', input), /연결한 보드가 없습니다/);
  await writeFile(config, JSON.stringify({ baseUrl: runtime.origin, workspaceId, projectId: 'another-project' }));
  await assert.rejects(run('event', '--config', config, '--run', result.runId, '--status', 'cancelled', '--message', '잘못된 대상', '--request-id', 'wrong-project'), /프로젝트의 작업이 아닙니다/);
  await writeFile(config, JSON.stringify({ baseUrl: runtime.origin, workspaceId: 'wrong-board', projectId: 'personal' }));
  await assert.rejects(run('register', '--config', config, '--file', input), /다릅니다/);
  assert.equal(runtime.service.board().ideas.length, 1);
});
