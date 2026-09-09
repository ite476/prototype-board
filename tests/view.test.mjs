import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HttpBoardRepository } from '../src/core/repository.ts';
import { validateBoard } from '../src/core/board.ts';

const board = () => ({ schemaVersion: 1, revision: 1, workspaceId: 'workspace-one',
  projects: [{ id: 'one', name: '개인 기획', description: '' }],
  ideas: [{ id: 'idea-one', projectId: 'one', title: '흐름 보기', summary: '기획을 확인합니다.', brief: '작업 배경', questions: ['남은 결정'], tags: [], updatedAt: '2026-01-01' }],
  proposals: [{ id: 'proposal-one', ideaId: 'idea-one', runId: 'run-one', label: 'A안', title: '흐름 보기', summary: '', preview: { type: 'html', props: { artifactId: 'artifact-a1' } }, readiness: [] }],
  artifacts: [{ id: 'artifact-a1', ideaId: 'idea-one', runId: 'run-one', kind: 'html', name: 'flow.html', bytes: 100, createdAt: '2026-01-01' }],
  runs: [{ id: 'run-one', ideaId: 'idea-one', scope: 'prototype', actor: '현재 작업', model: null, source: {}, status: 'drafting', events: [{ id: 'event-one', status: 'drafting', message: '화면을 만들고 있습니다.', at: '2026-01-01' }] }],
});

test('주제 상세에 실제 기획·기록·결과물 링크와 격리된 미리보기가 렌더링된다', async (t) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  t.after(() => vite.close());
  const { ReviewWorkspace } = await vite.ssrLoadModule('/src/components/ReviewWorkspace.tsx');
  const { HtmlPreview } = await vite.ssrLoadModule('/src/components/HtmlPreview.tsx');
  const data = board();
  const rendered = renderToStaticMarkup(createElement(ReviewWorkspace, { data, idea: data.ideas[0], registry: { html: HtmlPreview }, saving: false, onSave: async () => {}, onSelect: () => {} }));
  for (const phrase of ['작업 배경', '남은 결정', '화면을 만들고 있습니다.', '/api/artifacts/artifact-a1', 'sandbox="allow-scripts"', '이 시안 채택']) assert.ok(rendered.includes(phrase), phrase);
  assert.ok(!rendered.includes('allow-same-origin'));
});

test('HTTP 저장은 전체 보드가 아니라 부분 명령과 읽었던 버전만 전송한다', async (t) => {
  const data = board(); let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/review') { sent = JSON.parse(options.body); assert.equal(options.headers['X-Prototype-Board-Workspace'], data.workspaceId); return Response.json({ saved: true }); }
    return Response.json(data);
  });
  const repo = new HttpBoardRepository(); await repo.load();
  await repo.review({ type: 'decision', ideaId: 'idea-one', proposalId: 'proposal-one' }, data);
  assert.equal(sent.expectedRevision, 1); assert.equal(sent.proposalId, 'proposal-one'); assert.ok(sent.requestId); assert.equal(sent.ideas, undefined);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: '다른 작업의 변경이 있습니다.' }, { status: 409 }));
  await assert.rejects(repo.review({ type: 'decision', ideaId: 'idea-one' }, data), /다른 작업/);
});

test('같은 주소에 다른 보드가 실행되거나 저장된 결과물 연결이 깨지면 거절한다', async (t) => {
  const data = board(); validateBoard(data);
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const repo = new HttpBoardRepository(); await repo.load(); data.workspaceId = 'other-board';
  await assert.rejects(repo.load(), /다른 보드/);
  data.artifacts[0].runId = 'missing'; assert.throws(() => validateBoard(data));
});
