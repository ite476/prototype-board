import { proposalsFor, selectProposal } from '../core/board.ts';
import type { BoardData, Idea, Proposal } from '../core/model.ts';
import { PreviewFrame, type PreviewRegistry } from './PreviewFrame.tsx';

/** 미리보기 선택은 탐색만 바꾼다. 채택 버튼을 누르고 저장이 성공해야 통과 목록에 반영한다. */
export function ReviewWorkspace({ data, idea, proposalId, registry, saving, onSelect, onSave }: {
  data: BoardData; idea: Idea; proposalId?: string; registry: PreviewRegistry; saving: boolean;
  onSelect: (proposal: Proposal) => void; onSave: (data: BoardData) => Promise<void>;
}) {
  const proposals = proposalsFor(data, idea.id);
  const proposal = proposals.find((item) => item.id === proposalId)
    ?? proposals.find((item) => item.id === idea.selectedProposalId) ?? proposals[0];
  return <main className="board-main">
    <div className="review-heading"><p className="kicker">시안 비교</p><h2>{idea.title}</h2><p>{idea.summary}</p></div>
    <div className="review-layout">
      <aside className="option-panel" aria-label="시안 선택">
        <h3>화면을 골라보세요</h3>
        {proposals.map((item) => <button className="option" key={item.id} aria-pressed={item.id === proposal?.id} onClick={() => onSelect(item)}>
          <span>{item.label}{item.id === idea.selectedProposalId ? ' · 채택됨' : ''}</span><strong>{item.title}</strong><small>{item.summary}</small>
        </button>)}
        {!proposals.length && <p>이 주제는 아직 화면을 준비하고 있습니다.</p>}
        {proposal && <div className="review-actions">
          <button className="primary-button" disabled={saving || idea.selectedProposalId === proposal.id} onClick={() => void onSave(selectProposal(data, idea.id, proposal.id))}>
            {idea.selectedProposalId === proposal.id ? '채택한 시안' : '이 시안 채택'}
          </button>
          {idea.selectedProposalId && <button className="text-button" disabled={saving} onClick={() => void onSave(selectProposal(data, idea.id))}>채택을 취소하고 다시 검토</button>}
          <p>채택은 보드의 검토 결과입니다. 실제 제품에는 별도로 반영해야 합니다.</p>
        </div>}
      </aside>
      <section className="selected-preview" aria-label="선택한 시안 미리보기">
        <div className="preview-heading"><h3>{proposal?.label ?? '화면 준비 중'}</h3><span>화면을 눌러 확인해 보세요</span></div>
        <PreviewFrame key={proposal?.id} proposal={proposal} registry={registry} />
      </section>
    </div>
  </main>;
}
