import { reversedIds, type LedgerEntry } from '../lib/ledger';
import { formatRupees } from '../lib/numbers';
import type { Lang, Member } from '../lib/store';
import { UI } from '../lib/ui';

interface Props {
  entries: LedgerEntry[];
  allEntries: LedgerEntry[];
  members: Member[];
  lang: Lang;
  stampKey: number;
}

const MONEY = new Set(['savings', 'repayment', 'loan', 'reversal', 'cash_count']);

/** Today's page of the register, written line by line as the group speaks. */
export function RegisterPage({ entries, allEntries, members, lang, stampKey }: Props) {
  const t = UI[lang];
  const byId = new Map(members.map((m) => [m.id, m]));
  const name = (id: string | null) => {
    const m = id ? byId.get(id) : undefined;
    return m ? (lang === 'en' ? m.name : m.nameLocal ?? m.name) : '';
  };
  const reversed = reversedIds(allEntries);
  const money = entries.filter((e) => MONEY.has(e.type));
  const present = entries.filter((e) => e.type === 'attendance');
  const lastMoney = money[money.length - 1];

  if (!entries.length) {
    return <p className="ruled h-[88px] pl-16 pr-4 text-lg leading-[44px] text-neel-soft">{t.emptyPage}</p>;
  }

  return (
    <ol className="ruled relative" aria-label={t.todayPage}>
      {present.length > 0 && (
        <li className="flex h-[44px] items-center gap-3 pl-16 pr-4 text-neel-soft">
          <span className="shrink-0 font-semibold text-neel">{t.typeLabel.attendance}</span>
          <span className="truncate">{present.map((e) => name(e.memberId)).join(', ')}</span>
        </li>
      )}
      {money.map((e) => {
        const cancelled = reversed.has(e.id);
        const isLast = e === lastMoney && e.type !== 'reversal' && e.type !== 'cash_count';
        return (
          <li key={e.id} className="relative flex h-[44px] animate-write items-center gap-3 pl-16 pr-4">
            <span className="absolute left-0 w-[52px] pr-2 text-right text-sm text-bahi/90 num">{e.seq}</span>
            <span className={`flex-1 truncate text-lg ${cancelled ? 'text-neel-faint line-through' : ''}`}>
              <span className="font-semibold">{name(e.memberId)}</span>{' '}
              <span className={e.type === 'reversal' ? 'text-bahi' : 'text-neel-soft'}>{t.typeLabel[e.type]}</span>
            </span>
            <span
              className={`font-display text-2xl num animate-ink ${
                cancelled ? 'text-neel-faint line-through' : e.type === 'loan' || e.type === 'reversal' ? 'text-bahi' : 'text-neel'
              }`}
            >
              {e.type === 'cash_count' ? '' : e.type === 'loan' || e.type === 'reversal' ? '−' : '+'}{formatRupees(e.amount)}
            </span>
            {isLast && !cancelled && (
              <span
                key={stampKey}
                aria-hidden
                className="pointer-events-none absolute right-24 top-0 rotate-[-9deg] animate-stamp rounded-md border-[3px] border-mohar px-2 font-display text-xl leading-8 text-mohar opacity-90 mix-blend-multiply"
              >
                {t.stampOk}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
