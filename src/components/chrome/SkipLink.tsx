/** First focusable element on every page: jumps past the chrome into the content. */
export function SkipLink({ targetId = 'content', label = 'Skip to content' }: { targetId?: string; label?: string }) {
  return (
    <a className="gl-skip" href={`#${targetId}`}>
      {label}
    </a>
  );
}
