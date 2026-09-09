import type { BoardData, ReviewCommand } from './model.ts';
import { selectProposal, validateBoard } from './board.ts';

/**
 * 저장 방식을 화면에서 분리하는 계약이다.
 * 화면은 채택·준비 확인 명령만 전달한다. 서버 데이터 전체를 다시 써서 다른 작업을 지우지 않는다.
 */
export interface BoardRepository {
  load(): Promise<BoardData | null>;
  review(command: ReviewCommand, base: BoardData): Promise<BoardData>;
}

/** 예제용 저장. 실패하거나 손상된 데이터를 초기값으로 덮어써 숨기지 않는다. */
export class BrowserBoardRepository implements BoardRepository {
  private readonly storage: Storage;
  private readonly key: string;

  constructor(storage: Storage, namespace: string) {
    if (!namespace.trim()) throw new Error('저장 공간 식별자가 필요합니다.');
    this.storage = storage;
    this.key = `prototype-board:v1:${namespace}`;
  }

  async load(): Promise<BoardData | null> {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    validateBoard(data);
    return data;
  }

  async save(data: BoardData): Promise<void> {
    validateBoard(data);
    this.storage.setItem(this.key, JSON.stringify(data));
  }

  async review(command: ReviewCommand, base: BoardData): Promise<BoardData> {
    const next = command.type === 'decision' ? selectProposal(base, command.ideaId, command.proposalId) : {
      ...base, proposals: base.proposals.map((proposal) => proposal.id !== command.proposalId ? proposal : {
        ...proposal, readiness: proposal.readiness.map((item) => item.id !== command.itemId ? item : { ...item, complete: command.complete }),
      }),
    };
    await this.save(next); return next;
  }
}

/** 같은 주소의 파일 저장 API. 버전 충돌은 자동 덮어쓰지 않고 사용자에게 재확인을 요청한다. */
export class HttpBoardRepository implements BoardRepository {
  private workspaceId?: string;
  async load(): Promise<BoardData> {
    const response = await fetch('/api/board', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('보드를 읽지 못했습니다. 로컬 서버 실행 상태를 확인하세요.');
    const board: unknown = await response.json(); validateBoard(board);
    if (!board.workspaceId || !Number.isInteger(board.revision)) throw new Error('로컬 저장 API 응답이 아닙니다.');
    if (this.workspaceId && this.workspaceId !== board.workspaceId) throw new Error('같은 주소에 다른 보드가 실행 중입니다. 연결 설정을 확인하세요.');
    this.workspaceId = board.workspaceId; return board;
  }
  async review(command: ReviewCommand, base: BoardData): Promise<BoardData> {
    const response = await fetch('/api/review', { method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', 'X-Prototype-Board': '1', 'X-Prototype-Board-Workspace': base.workspaceId ?? '' },
      body: JSON.stringify({ ...command, expectedRevision: base.revision, requestId: crypto.randomUUID() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? '저장하지 못했습니다.');
    return this.load();
  }
}
