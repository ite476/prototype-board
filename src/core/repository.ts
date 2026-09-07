import type { BoardData } from './model.ts';
import { validateBoard } from './board.ts';

/**
 * 저장 방식을 화면에서 분리하는 계약이다.
 * 초기 버전의 전체 저장은 단일 브라우저용이다. 공유 API는 revision과 부분 갱신을 별도로 설계한다.
 */
export interface BoardRepository {
  load(): Promise<BoardData | null>;
  save(data: BoardData): Promise<void>;
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
}
