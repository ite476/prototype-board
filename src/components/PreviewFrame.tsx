import type { ComponentType } from 'react';
import type { Proposal } from '../core/model.ts';

export interface PreviewProps { proposal: Proposal; compact: boolean }
export type PreviewRegistry = Record<string, ComponentType<PreviewProps>>;

/**
 * 카드 배경과 상세 화면은 같은 미리보기 컴포넌트를 쓴다.
 * 컴포넌트 등록은 실행 코드이므로 신뢰하는 코드만 연결한다.
 * 저장한 HTML은 HtmlPreview의 sandbox iframe을 통해서만 표시한다.
 */
export function PreviewFrame({ proposal, registry, compact = false }: { proposal?: Proposal; registry: PreviewRegistry; compact?: boolean }) {
  const Renderer = proposal ? registry[proposal.preview.type] : undefined;
  const content = Renderer && proposal ? <Renderer proposal={proposal} compact={compact} />
    : <div className="preview-empty">{proposal ? '이 시안의 미리보기 도구를 연결해 주세요.' : '시안을 준비하고 있습니다.'}</div>;
  if (compact) return <div className="card-preview" aria-hidden="true" inert><div className="card-preview-canvas">{content}</div></div>;
  return <div className="preview-frame">{content}</div>;
}
