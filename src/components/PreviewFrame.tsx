import type { ComponentType } from 'react';
import type { Proposal } from '../core/model.ts';

export interface PreviewProps { proposal: Proposal; compact: boolean }
export type PreviewRegistry = Record<string, ComponentType<PreviewProps>>;

/**
 * 카드 배경과 상세 화면은 같은 미리보기 컴포넌트를 쓴다.
 * 등록된 신뢰 가능한 컴포넌트만 실행한다. 데이터의 HTML·스크립트·URL을 실행하지 않는다.
 * 외부 HTML 실행은 별도 origin과 sandbox 설계 후 추가한다.
 */
export function PreviewFrame({ proposal, registry, compact = false }: { proposal?: Proposal; registry: PreviewRegistry; compact?: boolean }) {
  const Renderer = proposal ? registry[proposal.preview.type] : undefined;
  const content = Renderer && proposal ? <Renderer proposal={proposal} compact={compact} />
    : <div className="preview-empty">{proposal ? '이 시안의 미리보기 도구를 연결해 주세요.' : '시안을 준비하고 있습니다.'}</div>;
  if (compact) return <div className="card-preview" aria-hidden="true" inert><div className="card-preview-canvas">{content}</div></div>;
  return <div className="preview-frame">{content}</div>;
}
