import { createRoot } from 'react-dom/client';
import { PrototypeBoard, BrowserBoardRepository } from './index.ts';
import { demoConfig, demoData, demoPreviews } from './examples/demo.tsx';
import './styles.css';

// 공통 프로그램의 조립 지점이다. 실제 사용처는 예제 대신 자체 데이터·저장 어댑터를 주입한다.
const repository = new BrowserBoardRepository(window.localStorage, 'demo');
createRoot(document.getElementById('root')!).render(
  <PrototypeBoard config={demoConfig} initialData={demoData} repository={repository} previews={demoPreviews} />,
);
