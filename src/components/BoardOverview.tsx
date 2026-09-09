import { ideasFor, metricsFor, stageLabels } from '../core/board.ts';
import type { BoardData, BoardView, Idea, Proposal, ReviewCommand } from '../core/model.ts';
import { BoardCard } from './BoardCard.tsx';
import type { PreviewRegistry } from './PreviewFrame.tsx';

/** 목록과 수치는 현재 프로젝트의 동일한 데이터에서 계산한다. 준비 항목은 채택된 시안에 귀속된다. */
export function BoardOverview({ data, projectId, view, registry, saving, onOpen, onSave }: {
  data: BoardData; projectId: string; view: BoardView; registry: PreviewRegistry; saving: boolean;
  onOpen: (idea: Idea, proposal?: Proposal) => void; onSave: (command: ReviewCommand) => Promise<void>;
}) {
  const metrics = metricsFor(data, projectId);
  const ideas = ideasFor(data, projectId, view);
  const title = view === 'approved' ? '통과한 시안' : view === 'development-ready' ? '개발 준비' : '검토할 시안';
  return <main className="board-main">
    <section className="overview-heading">
      <div><p className="kicker">{title}</p><h2>{view === 'dashboard' ? <>시안을 둘러보며,<br /><span>다음 화면을 함께 살펴보세요.</span></> : title}</h2>
        <p>{view === 'dashboard' ? '카드를 열고 시안을 바꿔가며 화면을 살펴보세요.' : view === 'approved' ? '채택한 화면과 검토 결과를 다시 확인하세요.' : '통과한 시안에 필요한 결정을 하나씩 정리하세요.'}</p></div>
      <div className="metrics">{Object.entries(metrics).map(([stage, count]) => <div key={stage}><strong>{count}</strong><span>{stageLabels[stage as keyof typeof stageLabels]}</span></div>)}</div>
    </section>
    <section aria-label={title}>
      <div className="list-heading"><h3>{view === 'development-ready' ? '준비 항목 확인' : '시안 목록'}</h3><span>{ideas.length}개 주제</span></div>
      {ideas.length === 0 && <div className="empty-state"><h3>아직 이 목록에 시안이 없습니다.</h3><p>{view === 'dashboard' ? '다른 프로젝트를 살펴보거나 통과한 시안을 확인해 보세요.' : '시안 상세 화면에서 채택한 안이 이곳에 표시됩니다.'}</p></div>}
      <div className="card-grid">{ideas.map((idea) => {
        const proposal = data.proposals.find((item) => item.id === idea.selectedProposalId);
        if (view !== 'development-ready' || !proposal) return <BoardCard key={idea.id} data={data} idea={idea} registry={registry} onOpen={() => onOpen(idea, proposal)} />;
        return <article className="readiness-card" key={idea.id}>
          <p className="kicker">{proposal.label}</p><h3>{idea.title}</h3>
          <p>{proposal.readiness.filter((item) => item.complete).length}/{proposal.readiness.length}개 확인</p>
          {proposal.readiness.length === 0 && <p>이 시안에는 아직 준비 항목이 없습니다.</p>}
          {proposal.readiness.map((item) => <label className="readiness-check" key={item.id}>
            <input type="checkbox" checked={item.complete} disabled={saving} onChange={() => void onSave({ type: 'readiness', proposalId: proposal.id, itemId: item.id, complete: !item.complete })} />
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          </label>)}
          <button className="text-button" onClick={() => onOpen(idea, proposal)}>화면 다시 보기 →</button>
        </article>;
      })}</div>
    </section>
  </main>;
}
