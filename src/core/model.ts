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
  label: string;
  title: string;
  summary: string;
  preview: { type: string; props: Record<string, JsonValue> };
  readiness: ReadinessItem[];
}

export interface BoardData {
  schemaVersion: 1;
  projects: Project[];
  ideas: Idea[];
  proposals: Proposal[];
}

export type BoardView = 'dashboard' | 'approved' | 'development-ready' | 'guide';
export type BoardStage = 'planned' | 'reviewing' | 'approved' | 'development-ready';

/** 사용처에서 주입하는 화면 설정. 계정, 서버 주소, 업무 자료를 공통 코드에 넣지 않는다. */
export interface BoardConfig {
  title: string;
  homeMark: string;
  storageLabel: string;
  storageDescription: string;
}
