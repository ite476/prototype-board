import type { BoardData, Idea, RunStatus, WorkRun } from '../core/model.ts';

export const runLabels: Record<RunStatus, string> = { queued: '접수됨', planning: '기획 중', drafting: '화면 만드는 중', 'review-ready': '검토 요청', blocked: '확인 필요', cancelled: '중단됨' };
const time = (value: string) => new Date(value).toLocaleString('ko-KR');

/** 접수부터 결과물 저장까지 실제 기록을 표시한다. 검토 요청과 사용자의 시안 채택은 서로 다른 상태다. */
function RunTimeline({ run }: { run: WorkRun }) {
  const steps: RunStatus[] = run.scope === 'planning' ? ['queued', 'planning', 'review-ready'] : ['queued', 'planning', 'drafting', 'review-ready'];
  return <article className="work-run">
    <div className="run-heading"><strong>{run.actor}</strong><span className={`run-status ${run.status}`}>{runLabels[run.status]}</span></div>
    <p className="run-meta">{run.scope === 'planning' ? '기획 문서' : '기획 + 화면 시안'}{run.model ? ` · ${run.model}` : ''}</p>
    <ol className="workflow-steps" aria-label="진행 단계">{steps.map((step) => <li key={step} className={run.status === step ? 'current' : run.events.some((event) => event.status === step) ? 'visited' : ''}>{runLabels[step]}</li>)}</ol>
    <details><summary>작업 기록 {run.events.length}개</summary><ol className="event-list">{run.events.map((event) => <li key={event.id}><time dateTime={event.at}>{time(event.at)}</time><span>{event.message}</span></li>)}</ol></details>
  </article>;
}

export function WorkflowPanel({ data, idea }: { data: BoardData; idea: Idea }) {
  const runs = data.runs?.filter((run) => run.ideaId === idea.id) ?? [];
  const artifacts = data.artifacts?.filter((artifact) => artifact.ideaId === idea.id) ?? [];
  if (!runs.length && !idea.brief) return null;
  return <section className="workflow-panel" aria-label="기획과 작업 기록">
    <div className="workflow-content"><div><p className="kicker">기획 내용</p><p className="brief-text">{idea.brief ?? idea.summary}</p>
      {!!idea.questions?.length && <details open><summary>함께 정할 것 {idea.questions.length}개</summary><ul>{idea.questions.map((question, index) => <li key={index}>{question}</li>)}</ul></details>}
      {!!artifacts.length && <div className="artifact-links" aria-label="저장한 결과물">{artifacts.map((artifact) => <a key={artifact.id} href={`/api/artifacts/${artifact.id}`} target="_blank" rel="noreferrer">{artifact.kind === 'plan' ? '기획' : artifact.kind === 'html' ? '화면' : '소스'} · {artifact.name}</a>)}</div>}
    </div><div>{runs.map((run) => <RunTimeline key={run.id} run={run} />)}</div></div>
  </section>;
}

export function ActivityOverview({ data, projectId, onOpen }: { data: BoardData; projectId: string; onOpen: (idea: Idea) => void }) {
  const ideas = data.ideas.filter((idea) => idea.projectId === projectId);
  const runs = data.runs?.filter((run) => ideas.some((idea) => idea.id === run.ideaId)).slice().reverse() ?? [];
  return <main className="board-main"><div className="review-heading"><p className="kicker">작업 현황</p><h2>맡긴 일, 지금 어디까지 왔나요?</h2><p>접수한 기획과 저장한 결과물을 함께 확인하세요.</p></div>
    {!runs.length && <div className="empty-state"><h3>아직 접수한 작업이 없습니다.</h3><p>채팅에서 프로토타입 보드에 기획을 맡기면 이곳에 기록됩니다.</p></div>}
    <div className="activity-grid">{runs.map((run) => { const idea = ideas.find((item) => item.id === run.ideaId)!; return <section className="activity-card" key={run.id}>
      <button className="activity-title" onClick={() => onOpen(idea)}>{idea.title} →</button><p>{idea.summary}</p><RunTimeline run={run} />
    </section>; })}</div>
  </main>;
}
