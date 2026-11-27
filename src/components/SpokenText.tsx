/**
 * The reply appears word by word, at about the pace it is spoken,
 * so members who read slowly can follow along with the voice.
 */
export function SpokenText({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(/(\s+)/);
  let n = 0;
  return (
    <p className={className}>
      {words.map((w, i) =>
        w.trim() ? (
          <span key={i} className="inline-block animate-word" style={{ animationDelay: `${(n++) * 70}ms` }}>
            {w}
          </span>
        ) : (
          w
        ),
      )}
    </p>
  );
}
