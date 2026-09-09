export { PrototypeBoard } from './PrototypeBoard.tsx';
export { BrowserBoardRepository, HttpBoardRepository } from './core/repository.ts';
export type { BoardRepository } from './core/repository.ts';
export type { BoardData, BoardConfig, Project, Idea, Proposal, ReadinessItem } from './core/model.ts';
export type { PreviewProps, PreviewRegistry } from './components/PreviewFrame.tsx';
export { validateBoard, ideasFor, metricsFor, stageOf, selectProposal, toggleReadiness } from './core/board.ts';
