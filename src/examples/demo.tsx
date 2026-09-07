import { useState } from 'react';
import type { BoardConfig, BoardData, Proposal } from '../core/model.ts';
import type { PreviewProps, PreviewRegistry } from '../components/PreviewFrame.tsx';

/** 설치 확인용 가상 예제. 실제 고객·업무·채택 이력은 포함하지 않는다. */
export const demoConfig: BoardConfig = {
  title: '프로토타입 보드', homeMark: 'P', storageLabel: 'LOCAL ONLY',
  storageDescription: '이 예제는 현재 브라우저에 검토 결과를 저장합니다. 브라우저 데이터를 지우면 기록도 사라집니다. 다른 탭·기기·에이전트와 공동 편집하는 기능은 아직 없습니다. 서버나 실제 제품 API에는 연결하지 않습니다.',
};

const proposal = (id: string, label: string, title: string, summary: string, headline: string): Proposal => ({
  id, ideaId: 'welcome', label, title, summary,
  preview: { type: 'welcome', props: { headline, layout: id } },
  readiness: [
    { id: 'screen', label: '화면 흐름 확인', detail: '첫 화면에서 다음 화면으로 이어지는 동작을 확인합니다.', complete: false },
    { id: 'copy', label: '표시 문구 정리', detail: '제목과 버튼에 사용할 문구를 정합니다.', complete: false },
    { id: 'data', label: '필요한 데이터 정리', detail: '화면에서 읽고 저장할 값을 정합니다.', complete: false },
    { id: 'implementation', label: '개발 범위 정리', detail: '적용할 저장소와 담당할 작업을 정합니다.', complete: false },
  ],
});

export const demoData: BoardData = {
  schemaVersion: 1,
  projects: [
    { id: 'sample', name: '예제 프로젝트', description: '보드 사용법을 살펴보는 가상 시안' },
    { id: 'notebook', name: '아이디어 노트', description: '화면이 없는 주제를 모아두는 예제' },
  ],
  ideas: [
    { id: 'welcome', projectId: 'sample', title: '첫 화면 구성', summary: '문구와 배치를 바꿔가며 처음 들어온 사람의 사용 흐름을 살펴봅니다.', tags: ['첫 화면', 'A·B·C안'], updatedAt: '예제 데이터' },
    { id: 'search', projectId: 'sample', title: '시안 찾기', summary: '시안이 많아졌을 때 원하는 주제를 찾는 방법을 준비합니다.', tags: ['탐색', '아이디어'], updatedAt: '예제 데이터' },
    { id: 'notes', projectId: 'notebook', title: '메모 정리 방식', summary: '떠오른 생각을 간단히 적고 다음에 다시 살펴보는 화면을 준비합니다.', tags: ['메모'], updatedAt: '예제 데이터' },
  ],
  proposals: [
    proposal('welcome-a', 'A안', '바로 시작하기', '시작할 일을 먼저 보여줍니다.', '오늘은 무엇을 살펴볼까요?'),
    proposal('welcome-b', 'B안', '목록부터 살펴보기', '고를 수 있는 항목을 나란히 보여줍니다.', '눈길이 가는 아이디어를 골라보세요.'),
    proposal('welcome-c', 'C안', '차분히 둘러보기', '여유 있는 배치로 살펴볼 내용을 안내합니다.', '생각을 모으고, 하나씩 살펴보세요.'),
  ],
};

/** 카드 배경과 상세 화면이 함께 사용하는 실제 예제 미리보기다. 선택한 항목은 예제 안에서만 바뀐다. */
function WelcomePreview({ proposal, compact }: PreviewProps) {
  const [selected, setSelected] = useState('');
  const headline = String(proposal.preview.props.headline ?? proposal.title);
  const layout = String(proposal.preview.props.layout ?? 'welcome-a');
  return <div className={'welcome-preview ' + layout}>
    <div className="demo-toolbar"><span className="demo-dot" />작은 아이디어 노트<span>예제</span></div>
    <p className="kicker">나의 노트</p><h4>{headline}</h4><p>잠시 떠오른 생각도 편하게 남겨두세요.</p>
    <div className="demo-tiles">{['새로운 생각', '다시 볼 내용', '함께 나눌 이야기'].map((label, index) =>
      <button key={label} tabIndex={compact ? -1 : 0} aria-pressed={selected === label} onClick={() => setSelected(label)}><span>0{index + 1}</span><strong>{label}</strong><small>{selected === label ? '선택했어요' : '살펴보기 →'}</small></button>)}</div>
    {!compact && <p className="demo-feedback" aria-live="polite">{selected ? `‘${selected}’ 화면을 선택했습니다.` : '항목을 눌러 선택했을 때의 느낌을 확인해 보세요.'}</p>}
  </div>;
}

export const demoPreviews: PreviewRegistry = { welcome: WelcomePreview };
