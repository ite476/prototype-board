import type { PreviewProps } from './PreviewFrame.tsx';

/** 저장한 HTML을 불투명 출처의 iframe으로 연다. allow-same-origin·상위 이동·팝업은 허용하지 않는다. */
export function HtmlPreview({ proposal, compact }: PreviewProps) {
  const artifactId = proposal.preview.props.artifactId;
  if (typeof artifactId !== 'string' || !/^artifact-[a-f0-9-]+$/.test(artifactId)) return <p>미리보기 파일 연결을 확인하세요.</p>;
  return <iframe className="html-preview" title={`${proposal.label} · ${proposal.title}`} src={`/api/artifacts/${artifactId}`}
    sandbox="allow-scripts" referrerPolicy="no-referrer" loading={compact ? 'lazy' : 'eager'} tabIndex={compact ? -1 : 0} />;
}
