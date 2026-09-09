import { useEffect, useRef, useState } from 'react';
import type { BoardConfig, BoardView, Project } from '../core/model.ts';

/** 설정에서 받은 마크를 표시하는 공통 홈 버튼. 현재 프로젝트를 유지한다. */
export function BrandHomeButton({ mark, onHome }: { mark: string; onHome: () => void }) {
  return <button className="brand-home" onClick={onHome} aria-label="프로토타입 보드 홈으로 이동">{mark}</button>;
}

/** 프로젝트 이름 자체가 버튼이다. 외부 클릭과 Escape로 팝오버를 닫는다. */
function ProjectSwitcher({ projects, selected, onSelect }: { projects: Project[]; selected?: Project; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="project-switcher" ref={wrapper}>
    <button ref={trigger} className="project-name" aria-expanded={open} onClick={() => setOpen(!open)}>{selected?.name ?? '프로토타입 보드'}</button>
    {open && <div className="project-popover" aria-label="프로젝트 선택">
      {projects.map((project) => <button key={project.id} aria-pressed={selected?.id === project.id}
        onClick={() => { onSelect(project.id); setOpen(false); trigger.current?.focus(); }}>
        <strong>{project.name}</strong><small>{project.description}</small>
      </button>)}
    </div>}
  </div>;
}

export function BoardHeader({ config, projects, projectId, onProject, view, onNavigate }: {
  config: BoardConfig; projects: Project[]; projectId: string; onProject: (id: string) => void;
  view: string; onNavigate: (view: BoardView) => void;
}) {
  return <header className="board-header">
    <div className="brand-lockup">
      <BrandHomeButton mark={config.homeMark} onHome={() => onNavigate('dashboard')} />
      <div><ProjectSwitcher key={projectId + view} projects={projects} selected={projects.find((item) => item.id === projectId)} onSelect={onProject} /><h1>{config.title}</h1></div>
      <button className="local-chip" onClick={() => onNavigate('guide')}>{config.storageLabel}</button>
    </div>
    <nav aria-label="보드 목록">
      {([['dashboard', '검토할 시안'], ['approved', '통과한 시안'], ['development-ready', '개발 준비'], ['activity', '작업 현황']] as const).map(([id, label]) =>
        <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => onNavigate(id)}>{label}</button>)}
    </nav>
  </header>;
}
