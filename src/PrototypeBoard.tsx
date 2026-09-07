import { useEffect, useRef, useState } from 'react';
import { validateBoard } from './core/board.ts';
import type { BoardConfig, BoardData, BoardView, Idea, Proposal } from './core/model.ts';
import type { BoardRepository } from './core/repository.ts';
import { BoardHeader } from './components/BoardHeader.tsx';
import { BoardOverview } from './components/BoardOverview.tsx';
import { ReviewWorkspace } from './components/ReviewWorkspace.tsx';
import type { PreviewRegistry } from './components/PreviewFrame.tsx';

interface Route { projectId: string; view: BoardView | 'review'; ideaId?: string; proposalId?: string }

function readRoute(): Route {
  try {
    const [prefix, projectId = '', view = 'dashboard', ideaId, proposalId] = window.location.hash.slice(1).split('/').map(decodeURIComponent);
    if (prefix !== 'p' || !['dashboard', 'approved', 'development-ready', 'guide', 'review'].includes(view)) return { projectId: '', view: 'dashboard' };
    return { projectId, view: view as Route['view'], ideaId, proposalId };
  } catch { return { projectId: '', view: 'dashboard' }; }
}

function navigate(projectId: string, view: string, ideaId?: string, proposalId?: string) {
  window.location.hash = ['p', projectId, view, ideaId, proposalId].filter((part) => part !== undefined).map((part) => encodeURIComponent(part!)).join('/');
}

/**
 * 재사용 가능한 보드 진입점. 설정·데이터·저장 어댑터·미리보기를 바깥에서 받는다.
 * 저장 전 성공을 표시하지 않고, 실패 시 화면의 마지막 저장 데이터를 유지한다.
 * 초기 버전은 단일 사용자·단일 탭용이며 공동 편집이나 에이전트 접수 API는 포함하지 않는다.
 */
export function PrototypeBoard({ config, initialData, repository, previews }: {
  config: BoardConfig; initialData: BoardData; repository: BoardRepository; previews: PreviewRegistry;
}) {
  const [data, setData] = useState<BoardData | null>(null);
  const [route, setRoute] = useState(readRoute);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  useEffect(() => {
    let active = true;
    repository.load().then((stored) => {
      const next = stored ?? initialData;
      validateBoard(next);
      if (active) setData(next);
    }).catch(() => { if (active) setError('저장된 보드를 읽지 못했습니다. 저장 공간과 데이터 형식을 확인해 주세요. 기존 데이터는 바꾸지 않았습니다.'); });
    return () => { active = false; };
  }, [initialData, repository]);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const save = async (next: BoardData) => {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true); setError('');
    try { await repository.save(next); setData(next); }
    catch { setError('변경 내용을 저장하지 못했습니다. 기존 상태를 유지했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.'); }
    finally { saveLock.current = false; setSaving(false); }
  };
  if (!data) return <main className="board-main"><p role={error ? 'alert' : 'status'}>{error || '보드를 불러오고 있습니다.'}</p></main>;
  const projectId = data.projects.some((project) => project.id === route.projectId) ? route.projectId : data.projects[0]?.id ?? '';
  const idea = data.ideas.find((item) => item.id === route.ideaId && item.projectId === projectId);
  const open = (item: Idea, proposal?: Proposal) => navigate(projectId, 'review', item.id, proposal?.id ?? item.selectedProposalId);
  return <>
    <BoardHeader config={config} projects={data.projects} projectId={projectId} view={route.view}
      onProject={(id) => navigate(id, 'dashboard')} onNavigate={(view) => navigate(projectId, view)} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    {saving && <div className="save-status" role="status">저장 중…</div>}
    {route.view === 'guide' ? <main className="board-main guide-page">
      <p className="kicker">사용 안내</p><h2>{config.title}</h2>
      <section><h3>시안을 살펴보고 결과를 정리합니다.</h3><p>프로젝트를 고른 뒤 같은 주제의 여러 화면을 비교할 수 있습니다. 채택한 시안은 통과 목록으로 이동하고, 준비 항목을 모두 확인하면 개발 준비 상태가 됩니다.</p></section>
      <section><h3>현재 저장 방식</h3><p>{config.storageDescription}</p></section>
      <section><h3>예제와 실제 사용</h3><p>기본 화면은 사용법을 보여주는 예제입니다. 실제 작업 기록이나 검토 완료를 나타내지 않습니다. 프로젝트 선택은 접근 권한을 나누는 기능이 아닙니다.</p></section>
    </main> : route.view === 'review' ? idea ? <ReviewWorkspace data={data} idea={idea} proposalId={route.proposalId} registry={previews} saving={saving} onSelect={(proposal) => open(idea, proposal)} onSave={save} />
      : <main className="board-main"><h2>이 프로젝트에서 주제를 찾을 수 없습니다.</h2><button onClick={() => navigate(projectId, 'dashboard')}>보드로 돌아가기</button></main>
      : <BoardOverview data={data} projectId={projectId} view={route.view} registry={previews} saving={saving} onOpen={open} onSave={save} />}
    <footer className="board-footer">{config.title}</footer>
  </>;
}
