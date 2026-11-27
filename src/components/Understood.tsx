import { annotate, type Mark } from '../lib/intent';
import type { NamedMember } from '../lib/phonetic';

const STYLE: Record<Exclude<Mark, null>, string> = {
  name: 'font-semibold text-neel underline decoration-neel decoration-[3px] underline-offset-[6px]',
  amount: 'rounded bg-mohar/15 px-1 font-semibold text-mohar',
  savings: 'font-semibold text-bahi',
  repayment: 'font-semibold text-bahi',
  loan: 'font-semibold text-bahi',
  yes: 'rounded bg-mohar px-1 text-patra',
  no: 'rounded bg-bahi px-1 text-patra',
  cash: 'font-semibold text-neel underline decoration-dotted decoration-2 underline-offset-[6px]',
};

/** The speaker's own words, coloured by what the app understood in them. */
export function Understood({ text, members, className = '' }: { text: string; members: NamedMember[]; className?: string }) {
  return (
    <span className={className}>
      {annotate(text, members).map((p, i) => (p.mark ? <span key={i} className={STYLE[p.mark]}>{p.word}</span> : p.word))}
    </span>
  );
}
