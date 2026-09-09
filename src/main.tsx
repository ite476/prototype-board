import { createRoot } from 'react-dom/client';
import { PrototypeBoard, BrowserBoardRepository, HttpBoardRepository } from './index.ts';
import { demoConfig, demoData, demoPreviews } from './examples/demo.tsx';
import { HtmlPreview } from './components/HtmlPreview.tsx';
import './styles.css';

// 예제는 명시적으로 요청한 경우에만 연다. API 장애를 예제로 바꿔 숨기지 않는다.
const demo = new URLSearchParams(window.location.search).get('demo') === '1';
const repository = demo ? new BrowserBoardRepository(window.localStorage, 'demo') : new HttpBoardRepository();
createRoot(document.getElementById('root')!).render(
  <PrototypeBoard config={demo ? demoConfig : {
    title: '프로토타입 보드', homeMark: 'P', storageLabel: 'LOCAL ONLY',
    storageDescription: '이 컴퓨터의 파일에 기획·시안·진행 기록을 저장합니다. Docker나 DB는 필요하지 않습니다. 서버 재시작 후에도 같은 저장 폴더를 연결하면 기록이 유지됩니다. 브라우저 예제는 ?demo=1에서 별도로 열 수 있습니다.',
  }} initialData={demo ? demoData : { schemaVersion: 1, projects: [], ideas: [], proposals: [] }} repository={repository} previews={demo ? demoPreviews : { html: HtmlPreview }} />,
);
