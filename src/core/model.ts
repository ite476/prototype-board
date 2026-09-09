/**
 * 공통 보드의 직렬화 가능한 데이터 계약이다.
 * 제품별 업무 필드는 preview.props에 두고, 이 계약에 특정 고객·업무 이름을 추가하지 않는다.
 * 프로젝트는 표시용 필터다. 서로 다른 소유자의 자료는 별도 저장소·실행 환경으로 분리한다.
 */
export interface Project {
  id: string;
  name: string;
  description: string;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface Idea {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  tags: string[];
  updatedAt: string;
  brief?: string;
  questions?: string[];
  /** 한 주제에서 현재 채택한 시안. 선택·미리보기와 채택은 별개다. */
  selectedProposalId?: string;
}

export interface ReadinessItem {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
}

export interface Proposal {
  id: string;
  ideaId: string;
  runId?: string;
  label: string;
  title: string;
  summary: string;
  preview: { type: string; props: Record<string, JsonValue> };
  readiness: ReadinessItem[];
}

export interface BoardData {
  schemaVersion: 1;
  revision?: number;
  workspaceId?: string;
  projects: Project[];
  ideas: Idea[];
  proposals: Proposal[];
  artifacts?: Artifact[];
  runs?: WorkRun[];
}

export type RunStatus = 'queued' | 'planning' | 'drafting' | 'review-ready' | 'blocked' | 'cancelled';
export interface Artifact {
  id: string; ideaId: string; runId: string; kind: 'plan' | 'html' | 'source'; name: string; bytes: number; createdAt: string;
}
/** 실제 수행한 단계와 결과물만 기록한다. 계획된 모델 호출을 실행 이력처럼 표시하지 않는다. */
export interface WorkRun {
  id: string; ideaId: string; scope: 'planning' | 'prototype'; status: RunStatus; actor: string; model: string | null;
  source: { threadId: string; repository: string };
  events: { id: string; status: RunStatus; message: string; at: string; artifactId?: string }[];
}
export type ReviewCommand = { type: 'decision'; ideaId: string; proposalId?: string }
  | { type: 'readiness'; proposalId: string; itemId: string; complete: boolean };

export type BoardView = 'dashboard' | 'approved' | 'development-ready' | 'activity' | 'guide';
export type BoardStage = 'planned' | 'reviewing' | 'approved' | 'development-ready';

/** 사용처에서 주입하는 화면 설정. 계정, 서버 주소, 업무 자료를 공통 코드에 넣지 않는다. */
export interface BoardConfig {
  title: string;
  homeMark: string;
  storageLabel: string;
  storageDescription: string;
}
