import { useEffect, useRef, useState } from 'react';
import { validateBoard } from './core/board.ts';
import type { BoardConfig, BoardData, BoardView, Idea, Proposal, ReviewCommand } from './core/model.ts';
import type { BoardRepository } from './core/repository.ts';
import { BoardHeader } from './components/BoardHeader.tsx';
import { BoardOverview } from './components/BoardOverview.tsx';
import { ReviewWorkspace } from './components/ReviewWorkspace.tsx';
import type { PreviewRegistry } from './components/PreviewFrame.tsx';
import { ActivityOverview } from './components/WorkflowPanel.tsx';

interface Route { projectId: string; view: BoardView | 'review'; ideaId?: string; proposalId?: string }

function readRoute(): Route {
  try {
    const [prefix, projectId = '', view = 'dashboard', ideaId, proposalId] = window.location.hash.slice(1).split('/').map(decodeURIComponent);
    if (prefix !== 'p' || !['dashboard', 'approved', 'development-ready', 'activity', 'guide', 'review'].includes(view)) return { projectId: '', view: 'dashboard' };
    return { projectId, view: view as Route['view'], ideaId, proposalId };
  } catch { return { projectId: '', view: 'dashboard' }; }
}

function navigate(projectId: string, view: string, ideaId?: string, proposalId?: string) {
  window.location.hash = ['p', projectId, view, ideaId, proposalId].filter((part) => part !== undefined).map((part) => encodeURIComponent(part!)).join('/');
}

/**
 * 재사용 가능한 보드 진입점. 설정·데이터·저장 어댑터·미리보기를 바깥에서 받는다.
 * 저장 전 성공을 표시하지 않고, 실패 시 화면의 마지막 저장 데이터를 유지한다.
 * 다른 작업의 접수 결과를 주기적으로 읽는다. 저장 중 시작된 낡은 조회 결과는 반영하지 않는다.
 */
export function PrototypeBoard({ config, initialData, repository, previews }: {
  config: BoardConfig; initialData: BoardData; repository: BoardRepository; previews: PreviewRegistry;
}) {
  const [data, setData] = useState<BoardData | null>(null);
  const [route, setRoute] = useState(readRoute);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true; let loading = false;
    const refresh = async () => {
      if (loading || saveLock.current || document.hidden) return;
      loading = true; const started = generation.current;
      try {
        const next = await repository.load() ?? initialData; validateBoard(next);
        if (active && generation.current === started && !saveLock.current) setData((current) =>
          (current?.revision ?? -1) > (next.revision ?? -1) ? current : next);
      } catch (error) { if (active) setError(error instanceof Error ? error.message : '보드를 읽지 못했습니다.'); }
      finally { loading = false; }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), 2000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [initialData, repository]);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const save = async (command: ReviewCommand) => {
    if (saveLock.current || !data) return;
    generation.current++;
    saveLock.current = true; setSaving(true); setError('');
    try { setData(await repository.review(command, data)); }
    catch (error) { setError(error instanceof Error ? error.message : '변경 내용을 저장하지 못했습니다.'); }
    finally { saveLock.current = false; setSaving(false); }
  };
  if (!data) return <main className="board-main"><p role={error ? 'alert' : 'status'}>{error || '보드를 불러오고 있습니다.'}</p></main>;
  const projectId = data.projects.some((project) => project.id === route.projectId) ? route.projectId : data.projects[0]?.id ?? '';
  const idea = data.ideas.find((item) => item.id === route.ideaId && item.projectId === projectId);
  const open = (item: Idea, proposal?: Proposal) => navigate(projectId, 'review', item.id, proposal?.id ?? item.selectedProposalId);
  return <>
    <BoardHeader config={config} projects={data.projects} projectId={projectId} view={route.view}
      onProject={(id) => navigate(id, 'dashboard')} onNavigate={(view) => navigate(projectId, view)} />
    {error && <div className="error-banner" role="alert">{error} <button onClick={() => window.location.reload()}>다시 읽기</button></div>}
    {saving && <div className="save-status" role="status">저장 중…</div>}
    {route.view === 'guide' ? <main className="board-main guide-page">
      <p className="kicker">사용 안내</p><h2>{config.title}</h2>
      <section><h3>시안을 살펴보고 결과를 정리합니다.</h3><p>프로젝트를 고른 뒤 같은 주제의 여러 화면을 비교할 수 있습니다. 채택한 시안은 통과 목록으로 이동하고, 준비 항목을 모두 확인하면 개발 준비 상태가 됩니다.</p></section>
      <section><h3>현재 저장 방식</h3><p>{config.storageDescription}</p></section>
      <section><h3>채팅에서 기획 맡기기</h3><p>연결한 저장소에서 <code>$prototype-board</code> 또는 “프로토타입 보드에 기획을 등록하고 시안을 만들어줘”라고 요청하세요. 작업 현황에서 접수와 결과물 저장 기록을 확인할 수 있습니다.</p></section>
      <section><h3>자료와 실행 범위</h3><p>프로젝트 선택은 접근 권한을 나누는 기능이 아닙니다. 개인 자료와 회사 자료는 별도 저장 폴더와 연결 설정을 사용하세요. 별도 에이전트나 유료 모델을 자동 실행하지 않습니다. 저장한 HTML은 보드 API와 외부 네트워크를 사용할 수 없으며, React 소스는 보관만 합니다.</p></section>
    </main> : route.view === 'activity' ? <ActivityOverview data={data} projectId={projectId} onOpen={open} />
      : route.view === 'review' ? idea ? <ReviewWorkspace data={data} idea={idea} proposalId={route.proposalId} registry={previews} saving={saving} onSelect={(proposal) => open(idea, proposal)} onSave={save} />
      : <main className="board-main"><h2>이 프로젝트에서 주제를 찾을 수 없습니다.</h2><button onClick={() => navigate(projectId, 'dashboard')}>보드로 돌아가기</button></main>
      : <BoardOverview data={data} projectId={projectId} view={route.view} registry={previews} saving={saving} onOpen={open} onSave={save} />}
    <footer className="board-footer">{config.title}</footer>
  </>;
}
