import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#F59E0B', '#EA580C', '#FBBF24', '#F97316', '#FCD34D'];

/** A shower of marigold (genda) petals: the meeting is closed, a new member is welcomed. */
export function Petals({ trigger }: { trigger: number }) {
  const [visible, setVisible] = useState(false);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!trigger || reduce) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4200);
    return () => clearTimeout(t);
  }, [trigger, reduce]);

  const petals = useMemo(
    () => Array.from({ length: 42 }, (_, i) => ({
      id: `${trigger}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.4 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 900,
      size: 10 + Math.random() * 12,
      color: COLORS[i % COLORS.length],
    })),
    [trigger],
  );

  if (!visible) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {petals.map((p) => (
        <svg
          key={p.id}
          viewBox="0 0 20 30"
          className="petal absolute -top-8"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.5,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        >
          <path d="M10 1 C17 8 18 20 10 29 C2 20 3 8 10 1 Z" fill={p.color} />
          <path d="M10 4 L10 26" stroke="rgba(120,40,0,.35)" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}
