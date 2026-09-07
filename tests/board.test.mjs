import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ideasFor, metricsFor, stageOf, selectProposal, toggleReadiness, validateBoard } from '../src/core/board.ts';
import { BrowserBoardRepository } from '../src/core/repository.ts';

const fixture = () => ({
  schemaVersion: 1,
  projects: [{ id: 'one', name: 'One', description: '' }, { id: 'two', name: 'Two', description: '' }],
  ideas: [
    { id: 'first', projectId: 'one', title: 'First', summary: '', tags: [], updatedAt: 'example' },
    { id: 'second', projectId: 'two', title: 'Second', summary: '', tags: [], updatedAt: 'example' },
  ],
  proposals: [
    { id: 'a', ideaId: 'first', label: 'A', title: 'A', summary: '', preview: { type: 'test', props: {} }, readiness: [{ id: 'screen', label: 'Screen', detail: '', complete: false }] },
    { id: 'b', ideaId: 'second', label: 'B', title: 'B', summary: '', preview: { type: 'test', props: {} }, readiness: [] },
  ],
});

test('채택하면 같은 주제가 검토 목록에서 통과 목록으로 이동한다', () => {
  const initial = fixture();
  const next = selectProposal(initial, 'first', 'a');
  assert.equal(initial.ideas[0].selectedProposalId, undefined);
  assert.equal(ideasFor(next, 'one', 'dashboard').length, 0);
  assert.deepEqual(ideasFor(next, 'one', 'approved').map((idea) => idea.id), ['first']);
  assert.equal(stageOf(next, next.ideas[0]), 'approved');
});

test('프로젝트 간 목록과 수치가 섞이지 않는다', () => {
  const next = selectProposal(fixture(), 'first', 'a');
  assert.equal(ideasFor(next, 'two', 'approved').length, 0);
  assert.equal(ideasFor(next, 'two', 'development-ready').length, 0);
  assert.deepEqual(metricsFor(next, 'two'), { planned: 0, reviewing: 1, approved: 0, 'development-ready': 0 });
});

test('준비 항목을 모두 마친 채택안만 개발 준비가 된다', () => {
  const approved = selectProposal(fixture(), 'first', 'a');
  const ready = toggleReadiness(approved, 'a', 'screen');
  assert.equal(stageOf(ready, ready.ideas[0]), 'development-ready');
  assert.equal(ideasFor(ready, 'one', 'approved').length, 1);
  const reopened = selectProposal(ready, 'first');
  assert.equal(stageOf(reopened, reopened.ideas[0]), 'reviewing');
  const empty = selectProposal(fixture(), 'second', 'b');
  assert.equal(stageOf(empty, empty.ideas[1]), 'approved');
});

test('다른 주제의 시안을 채택하거나 존재하지 않는 항목을 수정할 수 없다', () => {
  assert.throws(() => selectProposal(fixture(), 'first', 'b'));
  assert.throws(() => selectProposal(fixture(), 'unknown', 'a'));
  assert.throws(() => toggleReadiness(fixture(), 'a', 'unknown'));
});

test('시안이 없으면 준비 중이며 빈 보드도 유효하다', () => {
  const data = fixture(); data.proposals = [];
  assert.equal(stageOf(data, data.ideas[0]), 'planned');
  validateBoard({ schemaVersion: 1, projects: [], ideas: [], proposals: [] });
});

test('버전, 중복 식별자, 깨진 연결, 잘못된 필드를 검사한다', () => {
  validateBoard(fixture());
  for (const mutate of [
    (data) => { data.schemaVersion = 2; },
    (data) => { data.projects.push(data.projects[0]); },
    (data) => { data.ideas[0].projectId = 'missing'; },
    (data) => { data.ideas[0].selectedProposalId = 'b'; },
    (data) => { data.proposals[0].preview.props = null; },
    (data) => { data.proposals[0].readiness[0].complete = 'yes'; },
    (data) => { data.ideas[0].tags = [null]; },
  ]) {
    const data = fixture(); mutate(data); assert.throws(() => validateBoard(data));
  }
});

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('저장 후 다시 읽을 수 있고 저장 이름별로 분리된다', async () => {
  const storage = memoryStorage();
  const one = new BrowserBoardRepository(storage, 'one');
  const two = new BrowserBoardRepository(storage, 'two');
  assert.equal(await one.load(), null);
  await one.save(fixture());
  assert.deepEqual(await one.load(), fixture());
  assert.equal(await two.load(), null);
});

test('손상된 저장 데이터나 저장 공간 오류를 조용히 초기화하지 않는다', async () => {
  const broken = new BrowserBoardRepository({ getItem: () => '{', setItem: () => assert.fail('must not overwrite') }, 'broken');
  await assert.rejects(broken.load());
  const full = new BrowserBoardRepository({ getItem: () => null, setItem: () => { throw new Error('full'); } }, 'full');
  await assert.rejects(full.save(fixture()));
});
