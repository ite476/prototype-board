import { proposalsFor, stageLabels, stageOf } from '../core/board.ts';
import type { BoardData, Idea } from '../core/model.ts';
import { PreviewFrame, type PreviewRegistry } from './PreviewFrame.tsx';

/** 주제 하나를 표시하는 공통 카드. 목록마다 복사하거나 특정 시안을 하드코딩하지 않는다. */
export function BoardCard({ data, idea, registry, onOpen }: { data: BoardData; idea: Idea; registry: PreviewRegistry; onOpen: () => void }) {
  const proposals = proposalsFor(data, idea.id);
  const selected = proposals.find((proposal) => proposal.id === idea.selectedProposalId);
  return <article className="board-card">
    <PreviewFrame proposal={selected ?? proposals[0]} registry={registry} compact />
    <div className="card-content">
      <div className="card-meta"><span className={'status ' + stageOf(data, idea)}>{stageLabels[stageOf(data, idea)]}</span><span>{idea.updatedAt}</span></div>
      <h3>{idea.title}</h3><p>{idea.summary}</p>
      <div className="tags">{idea.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      {selected && <p className="selected-label">{selected.label} 채택 · 준비 항목 {selected.readiness.filter((item) => item.complete).length}/{selected.readiness.length}</p>}
      <button className="card-action" onClick={onOpen}>자세히 보기 <span aria-hidden="true">→</span></button>
    </div>
  </article>;
}
