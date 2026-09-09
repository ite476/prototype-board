import { createHash, randomUUID } from 'node:crypto';
import { extname, basename } from 'node:path';

export class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const requireValue = (valid, message, status = 400) => { if (!valid) throw new RequestError(status, message); };
const text = (value, name, max = 2000) => {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${name}을(를) 확인하세요.`);
  return value.trim();
};
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${randomUUID()}`;
const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const stages = ['queued', 'planning', 'drafting', 'review-ready', 'blocked', 'cancelled'];
const transitions = {
  queued: ['planning', 'blocked', 'cancelled'], planning: ['drafting', 'review-ready', 'blocked', 'cancelled'],
  drafting: ['review-ready', 'blocked', 'cancelled'], blocked: ['planning', 'drafting', 'cancelled'], 'review-ready': [], cancelled: [],
};

/** 기능 단위 API. REST·CLI·화면이 같은 요청 중복 방지 및 상태 변경 규칙을 사용한다. */
export class BoardService {
  constructor(store) { this.store = store; }
  board() { const { requests, ...board } = this.store.read(); return board; }
  async execute(operation, payload, change) {
    requireValue(payload && typeof payload === 'object' && !Array.isArray(payload), 'JSON 객체가 필요합니다.');
    const key = text(payload.requestId, '요청 식별자', 180);
    requireValue(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key), '요청 식별자 형식을 확인하세요.');
    const hash = fingerprint({ operation, payload });
    return this.store.transaction(async (state) => {
      const previous = Object.hasOwn(state.requests, key) ? state.requests[key] : undefined;
      if (previous) {
        requireValue(previous.hash === hash, '같은 요청 식별자에 다른 내용이 들어왔습니다.', 409);
        return previous.result;
      }
      const result = await change(state);
      state.requests[key] = { hash, result };
      return result;
    });
  }
  createProject(payload) {
    return this.execute('project', payload, (state) => {
      const projectId = text(payload.id, '프로젝트 식별자', 80);
      requireValue(/^[a-z0-9][a-z0-9-]*$/.test(projectId), '프로젝트 식별자는 영문 소문자·숫자·하이픈을 사용하세요.');
      requireValue(!state.projects.some((item) => item.id === projectId), '이미 있는 프로젝트입니다.', 409);
      state.projects.push({ id: projectId, name: text(payload.name, '프로젝트 이름', 120), description: String(payload.description ?? '').slice(0, 1000) });
      return { projectId };
    });
  }
  createIdea(payload) {
    return this.execute('idea', payload, (state) => {
      requireValue(state.projects.some((item) => item.id === payload.projectId), '대상 프로젝트를 찾을 수 없습니다.', 404);
      const scope = payload.scope ?? 'prototype';
      requireValue(['planning', 'prototype'].includes(scope), '요청 범위는 planning 또는 prototype이어야 합니다.');
      const ideaId = id('idea'); const runId = id('run');
      requireValue(payload.questions === undefined || (Array.isArray(payload.questions) && payload.questions.every((value) => typeof value === 'string')), '미정 사항은 문자열 목록이어야 합니다.');
      const idea = { id: ideaId, projectId: payload.projectId, title: text(payload.title, '제목', 160), summary: text(payload.summary, '요약'),
        brief: text(payload.brief ?? payload.summary, '기획 배경', 20000), questions: (payload.questions ?? []).slice(0, 30), tags: ['기획 접수'], updatedAt: now() };
      state.ideas.push(idea);
      state.runs.push({ id: runId, ideaId, scope, status: 'queued', actor: String(payload.actor ?? '스킬 호출 작업').slice(0, 120),
        model: payload.model ? String(payload.model).slice(0, 120) : null,
        source: { threadId: String(payload.source?.threadId ?? '').slice(0, 200), repository: String(payload.source?.repository ?? '').slice(0, 500) },
        events: [{ id: id('event'), status: 'queued', message: '기획 요청을 접수했습니다.', at: now() }] });
      return { ideaId, runId, route: `#p/${idea.projectId}/review/${ideaId}` };
    });
  }
  event(runId, payload) {
    return this.execute(`event:${runId}`, payload, (state) => {
      const run = state.runs.find((item) => item.id === runId);
      requireValue(run, '작업을 찾을 수 없습니다.', 404);
      requireValue(transitions[run.status].includes(payload.status), '현재 상태에서 해당 단계로 바꿀 수 없습니다.', 409);
      if (payload.status === 'review-ready') {
        requireValue(state.artifacts.some((item) => item.runId === runId && item.kind === 'plan'), '기획 문서를 먼저 저장하세요.', 409);
        if (run.scope === 'prototype') requireValue(state.proposals.some((item) => item.runId === runId), '화면 시안을 먼저 저장하세요.', 409);
      }
      run.status = payload.status;
      run.events.push({ id: id('event'), status: payload.status, message: text(payload.message, '진행 설명'), at: now() });
      return { runId, status: run.status };
    });
  }
  artifact(ideaId, payload) {
    return this.execute(`artifact:${ideaId}`, payload, async (state) => {
      const idea = state.ideas.find((item) => item.id === ideaId);
      const run = state.runs.find((item) => item.id === payload.runId && item.ideaId === ideaId);
      requireValue(idea && run, '주제와 작업 연결을 확인하세요.', 404);
      requireValue(['planning', 'drafting'].includes(run.status), '기획 또는 시안 제작 단계에서만 결과물을 추가할 수 있습니다.', 409);
      requireValue(['plan', 'html', 'source'].includes(payload.kind), '결과물 종류를 확인하세요.');
      const name = text(payload.name, '파일 이름', 160);
      const extension = extname(name).toLowerCase();
      requireValue(basename(name) === name && !name.includes('\\') && /^[^\x00-\x1f]+$/.test(name), '파일 이름에 경로를 넣지 마세요.');
      requireValue({ plan: ['.md'], html: ['.html'], source: ['.tsx', '.jsx', '.js', '.ts', '.css', '.json', '.txt', '.md'] }[payload.kind].includes(extension), '지원하지 않는 파일 형식입니다.');
      text(payload.content, '파일 내용', 500000);
      const content = payload.content;
      const artifactId = id('artifact');
      const artifact = { id: artifactId, ideaId, runId: run.id, kind: payload.kind, name, file: `${artifactId}${extension}`, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex'), createdAt: now() };
      let proposal;
      if (payload.kind === 'html') {
        proposal = { id: id('proposal'), ideaId, runId: run.id, label: text(payload.label ?? `${state.proposals.filter((item) => item.ideaId === ideaId).length + 1}안`, '시안 이름', 80),
          title: text(payload.title ?? idea.title, '시안 제목', 160), summary: String(payload.summary ?? idea.summary).slice(0, 2000),
          preview: { type: 'html', props: { artifactId } },
          readiness: [
            { id: 'screen', label: '화면 흐름 확인', detail: '버튼과 화면 전환을 직접 확인합니다.', complete: false },
            { id: 'open-questions', label: '미정 사항 결정', detail: '기획에서 남긴 질문과 적용 범위를 정합니다.', complete: false },
            { id: 'implementation', label: '실제 개발 범위 정리', detail: '적용할 저장소와 작업 범위를 정합니다.', complete: false },
          ] };
      }
      // 파일을 먼저 보관하고 스냅샷에 연결한다. 저장 중단 시 미연결 파일은 노출되지 않는다.
      await this.store.writeArtifact(artifactId, extension, content);
      state.artifacts.push(artifact);
      if (proposal) state.proposals.push(proposal);
      idea.updatedAt = now();
      run.events.push({ id: id('event'), status: run.status, message: `${name} 저장`, artifactId, at: now() });
      return { artifactId, proposalId: proposal?.id, route: `#p/${idea.projectId}/review/${ideaId}${proposal ? `/${proposal.id}` : ''}` };
    });
  }
  review(payload) {
    return this.execute('review', payload, (state) => {
      requireValue(Number.isInteger(payload.expectedRevision) && state.revision === payload.expectedRevision, '다른 작업의 변경이 있습니다. 최신 내용을 다시 읽고 시도하세요.', 409);
      if (payload.type === 'decision') {
        const idea = state.ideas.find((item) => item.id === payload.ideaId);
        requireValue(idea, '주제를 찾을 수 없습니다.', 404);
        requireValue(!payload.proposalId || state.proposals.some((item) => item.id === payload.proposalId && item.ideaId === idea.id), '이 주제의 시안이 아닙니다.');
        if (payload.proposalId) idea.selectedProposalId = payload.proposalId; else delete idea.selectedProposalId;
      } else if (payload.type === 'readiness') {
        const proposal = state.proposals.find((item) => item.id === payload.proposalId);
        const check = proposal?.readiness.find((item) => item.id === payload.itemId);
        requireValue(check && state.ideas.some((item) => item.selectedProposalId === proposal.id), '채택한 시안의 준비 항목만 변경할 수 있습니다.');
        requireValue(typeof payload.complete === 'boolean', '확인 여부가 필요합니다.');
        check.complete = payload.complete;
      } else throw new RequestError(400, '지원하지 않는 검토 요청입니다.');
      return { saved: true };
    });
  }
}
