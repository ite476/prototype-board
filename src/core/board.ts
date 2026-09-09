import type { BoardData, BoardStage, Idea, Proposal } from './model.ts';

export const stageLabels: Record<BoardStage, string> = {
  planned: '준비 중', reviewing: '검토 중', approved: '통과', 'development-ready': '개발 준비',
};

/** 모든 목록은 같은 데이터에서 계산한다. 통과 목록용 복사본을 별도로 저장하지 않는다. */
export function proposalsFor(data: BoardData, ideaId: string): Proposal[] {
  return data.proposals.filter((proposal) => proposal.ideaId === ideaId);
}

export function stageOf(data: BoardData, idea: Idea): BoardStage {
  const proposals = proposalsFor(data, idea.id);
  const selected = proposals.find((proposal) => proposal.id === idea.selectedProposalId);
  if (!selected) return proposals.length || data.runs?.some((run) => run.ideaId === idea.id && run.status === 'review-ready') ? 'reviewing' : 'planned';
  return selected.readiness.length > 0 && selected.readiness.every((item) => item.complete)
    ? 'development-ready' : 'approved';
}

export function ideasFor(data: BoardData, projectId: string, view: string = 'dashboard'): Idea[] {
  return data.ideas.filter((idea) => {
    if (idea.projectId !== projectId) return false;
    const stage = stageOf(data, idea);
    if (view === 'approved' || view === 'development-ready') {
      return stage === 'approved' || stage === 'development-ready';
    }
    return stage === 'planned' || stage === 'reviewing';
  });
}

export function metricsFor(data: BoardData, projectId: string) {
  const metrics: Record<BoardStage, number> = { planned: 0, reviewing: 0, approved: 0, 'development-ready': 0 };
  for (const idea of data.ideas.filter((item) => item.projectId === projectId)) metrics[stageOf(data, idea)]++;
  return metrics;
}

/** 채택과 준비 항목 수정은 새 스냅샷을 반환한다. 저장 실패 시 기존 화면 데이터를 보존한다. */
export function selectProposal(data: BoardData, ideaId: string, proposalId?: string): BoardData {
  const idea = data.ideas.find((item) => item.id === ideaId);
  if (!idea) throw new Error('주제를 찾을 수 없습니다.');
  if (proposalId && !data.proposals.some((item) => item.id === proposalId && item.ideaId === ideaId)) {
    throw new Error('이 주제에 속하지 않은 시안입니다.');
  }
  return { ...data, ideas: data.ideas.map((item) => item.id === ideaId
    ? { ...item, selectedProposalId: proposalId } : item) };
}

export function toggleReadiness(data: BoardData, proposalId: string, itemId: string): BoardData {
  const proposal = data.proposals.find((item) => item.id === proposalId);
  if (!proposal || !proposal.readiness.some((item) => item.id === itemId)) throw new Error('준비 항목을 찾을 수 없습니다.');
  return { ...data, proposals: data.proposals.map((item) => item.id !== proposalId ? item : {
    ...item, readiness: item.readiness.map((check) => check.id === itemId ? { ...check, complete: !check.complete } : check),
  }) };
}

/** 외부 저장 어댑터가 반환한 데이터도 검사한다. 버전·중복·깨진 참조를 조용히 무시하지 않는다. */
export function validateBoard(value: unknown): asserts value is BoardData {
  const fail = (): never => { throw new Error('보드 데이터 형식 또는 연결이 올바르지 않습니다.'); };
  const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  const text = (item: unknown) => typeof item === 'string' && item.trim().length > 0;
  if (!object(value) || value.schemaVersion !== 1) fail();
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.projects) || !Array.isArray(data.ideas) || !Array.isArray(data.proposals)) fail();
  const projects = data.projects as Record<string, unknown>[];
  const ideas = data.ideas as Record<string, unknown>[];
  const proposals = data.proposals as Record<string, unknown>[];
  for (const records of [projects, ideas, proposals]) {
    if (records.some((item) => !object(item) || !text(item.id))) fail();
    if (new Set(records.map((item) => item.id)).size !== records.length) fail();
  }
  for (const project of projects) if (!text(project.name) || typeof project.description !== 'string') fail();
  for (const idea of ideas) {
    if (!projects.some((item) => item.id === idea.projectId) || !text(idea.title) || typeof idea.summary !== 'string'
      || !text(idea.updatedAt) || !Array.isArray(idea.tags) || !idea.tags.every(text)) fail();
    if (idea.selectedProposalId !== undefined && !proposals.some((item) => item.id === idea.selectedProposalId && item.ideaId === idea.id)) fail();
  }
  for (const proposal of proposals) {
    if (!ideas.some((item) => item.id === proposal.ideaId) || !text(proposal.label) || !text(proposal.title)
      || typeof proposal.summary !== 'string' || !object(proposal.preview) || !text(proposal.preview.type)
      || !object(proposal.preview.props) || !Array.isArray(proposal.readiness)) fail();
    const checks = proposal.readiness as Record<string, unknown>[];
    if (checks.some((item) => !object(item) || !text(item.id) || !text(item.label) || typeof item.detail !== 'string' || typeof item.complete !== 'boolean')
      || new Set(checks.map((item) => item.id)).size !== checks.length) fail();
  }
  // 브라우저 예제는 추가 필드가 없을 수 있다. 저장 서버 응답은 모든 연결을 함께 확인한다.
  if (data.workspaceId !== undefined || data.runs !== undefined || data.artifacts !== undefined) {
    if (!text(data.workspaceId) || !Number.isInteger(data.revision) || !Array.isArray(data.runs) || !Array.isArray(data.artifacts)) fail();
    const runs = data.runs as Record<string, unknown>[];
    const artifacts = data.artifacts as Record<string, unknown>[];
    const statuses = ['queued', 'planning', 'drafting', 'review-ready', 'blocked', 'cancelled'];
    for (const records of [runs, artifacts]) {
      if (records.some((item) => !object(item) || !text(item.id)) || new Set(records.map((item) => item.id)).size !== records.length) fail();
    }
    for (const idea of ideas) if (idea.questions !== undefined && (!Array.isArray(idea.questions) || !idea.questions.every((item) => typeof item === 'string'))) fail();
    for (const run of runs) {
      if (!ideas.some((idea) => idea.id === run.ideaId) || !['planning', 'prototype'].includes(String(run.scope)) || !statuses.includes(String(run.status))
        || typeof run.actor !== 'string' || !(run.model === null || typeof run.model === 'string') || !object(run.source) || !Array.isArray(run.events)) fail();
      if ((run.events as unknown[]).some((event) => !object(event) || !text(event.id) || !text(event.at) || !text(event.message) || !statuses.includes(String(event.status)))) fail();
    }
    for (const artifact of artifacts) if (!runs.some((run) => run.id === artifact.runId && run.ideaId === artifact.ideaId)
      || !['plan', 'html', 'source'].includes(String(artifact.kind)) || !text(artifact.name) || !text(artifact.createdAt) || !Number.isInteger(artifact.bytes)) fail();
    for (const proposal of proposals) {
      if (proposal.runId !== undefined && !runs.some((run) => run.id === proposal.runId && run.ideaId === proposal.ideaId)) fail();
      const preview = proposal.preview as { type: string; props: Record<string, unknown> };
      if (preview.type === 'html' && !artifacts.some((artifact) => artifact.id === preview.props.artifactId && artifact.ideaId === proposal.ideaId && artifact.kind === 'html')) fail();
    }
  }
}
