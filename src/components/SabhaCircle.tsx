import { memberBalance, type Balances } from '../lib/ledger';
import { formatRupees } from '../lib/numbers';
import type { Lang, Member } from '../lib/store';

export interface Today {
  savings: number;
  repayment: number;
  loan: number;
}

interface Props {
  members: Member[];
  lang: Lang;
  present: Set<string>;
  today: Record<string, Today>;
  balances: Balances;
  /** Whose money is being talked about right now. */
  speaker: string | null;
  /** Members the app has asked to choose between ("which Sunita?"). */
  asked: string[];
  cashLabel: string;
  presentLabel: string;
  disabled: boolean;
  onTap: (m: Member) => void;
}

/** The group sitting in a ring on the durrie, the way an SHG meeting actually looks. */
export function SabhaCircle({ members, lang, present, today, balances, speaker, asked, cashLabel, presentLabel, disabled, onTap }: Props) {
  const n = Math.max(members.length, 1);
  const label = (m: Member) => (lang === 'en' ? m.name : m.nameLocal ?? m.name);
  const firstOf = (m: Member) => label(m).split(' ')[0];
  const short = (m: Member) =>
    members.filter((o) => firstOf(o) === firstOf(m)).length > 1 ? `${firstOf(m)} ${label(m).split(' ')[1]?.slice(0, 1) ?? ''}.` : firstOf(m);
  // Ring radius as a % of the box; more members sit a little further out.
  const radius = n > 12 ? 43 : 40;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]" role="group" aria-label={presentLabel}>
      {/* The durrie */}
      <div
        aria-hidden
        className="absolute inset-[17%] rounded-full shadow-[inset_0_0_0_6px_#6E1013,inset_0_0_0_10px_#E0A100,0_10px_30px_rgba(0,0,0,.35)]"
        style={{
          background:
            'repeating-radial-gradient(circle at center, #9E1B1F 0 14px, #B3262B 14px 18px, #9E1B1F 18px 30px, #E0A100 30px 32px), #9E1B1F',
        }}
      />
      <div className="absolute inset-[30%] grid place-items-center rounded-full bg-patra text-center shadow-[0_0_0_4px_#E0A100]">
        <div className="px-2">
          <p className="text-xs leading-tight text-neel-soft sm:text-sm">{cashLabel}</p>
          <p className="font-display text-xl leading-tight text-bahi num sm:text-2xl">{formatRupees(balances.groupCash)}</p>
          <p className="text-xs text-neel-soft num sm:text-sm">{present.size}/{members.length} {presentLabel}</p>
        </div>
      </div>

      {members.map((m, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        const here = present.has(m.id);
        const isSpeaker = speaker === m.id;
        const isAsked = asked.includes(m.id);
        const t = today[m.id];
        const paid = t ? t.savings + t.repayment : 0;
        const b = memberBalance(balances, m.id);
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onTap(m)}
            title={`${label(m)}: ${formatRupees(b.savings)}${b.loanOutstanding ? `, ${formatRupees(b.loanOutstanding)}` : ''}`}
            aria-label={`${label(m)}${here ? `, ${presentLabel}` : ''}`}
            className="group absolute flex w-[19%] flex-col items-center gap-0.5 transition-transform duration-300"
            style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) scale(${isSpeaker ? 1.14 : 1})`, zIndex: isSpeaker ? 2 : 1 }}
          >
            <span
              className={`relative grid aspect-square w-[78%] place-items-center rounded-full font-display text-lg transition-all duration-300 sm:text-2xl ${
                here ? 'bg-patra text-bahi shadow-[0_0_0_3px_#1C7A48,0_4px_0_#4a0a0c]' : 'border-2 border-dashed border-patra/50 bg-bahi-dark/40 text-patra/60'
              } ${isSpeaker ? 'shadow-[0_0_0_4px_#F5C84B,0_0_22px_8px_rgba(245,200,75,.65)]' : ''} ${isAsked ? 'animate-pulse shadow-[0_0_0_4px_#F5C84B]' : ''}`}
            >
              {Array.from(firstOf(m))[0]}
              {paid > 0 && (
                <span className="absolute -right-2 -top-1 rounded-full bg-mohar px-1.5 text-[10px] font-semibold leading-5 text-patra num shadow sm:text-xs">
                  +{formatRupees(paid).replace('₹', '')}
                </span>
              )}
              {t && t.loan > 0 && (
                <span className="absolute -bottom-1 -right-2 rounded-full bg-haldi px-1.5 text-[10px] font-semibold leading-5 text-bahi-dark num shadow sm:text-xs">
                  −{formatRupees(t.loan).replace('₹', '')}
                </span>
              )}
            </span>
            <span className={`max-w-full truncate text-xs leading-tight sm:text-sm ${here ? 'text-patra' : 'text-patra/60'}`}>{short(m)}</span>
          </button>
        );
      })}
    </div>
  );
}
