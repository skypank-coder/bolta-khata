import { reversedIds, type LedgerEntry } from '../lib/ledger';
import { formatRupees } from '../lib/numbers';
import { UI } from '../lib/ui';
import type { useBoltaKhata } from '../useBoltaKhata';

type App = ReturnType<typeof useBoltaKhata>;

/** The whole register, with the lock (hash) of every entry and a live tamper check. */
export function Khata({ app }: { app: App }) {
  const { data, lang, chain } = app;
  if (!data) return null;
  const t = UI[lang];
  const k = t.khata;
  const byId = new Map(data.group.members.map((m) => [m.id, m]));
  const name = (id: string | null) => {
    const m = id ? byId.get(id) : undefined;
    return m ? (lang === 'en' ? m.name : m.nameLocal ?? m.name) : '';
  };
  const reversed = reversedIds(data.ledger);

  // Group entries by meeting, newest meeting first.
  const groups = new Map<string, LedgerEntry[]>();
  for (const e of data.ledger) {
    const key = e.meetingId ?? 'none';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const meetings = [...groups.entries()].reverse();
  // Tamper demo targets an old carried-over savings entry, so today's page stays readable.
  const tamperIndex = data.ledger.findIndex((e) => e.type === 'savings');

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-16 pt-4">
      <section
        className={`rounded-xl p-5 ${chain.ok ? 'bg-mohar text-patra' : 'bg-patra text-bahi ring-4 ring-bahi'}`}
        aria-live="polite"
      >
        <div className="flex items-start gap-4">
          <span aria-hidden className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 font-display text-2xl ${chain.ok ? 'border-patra' : 'border-bahi'}`}>
            {chain.ok ? '✓' : '!'}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl">{chain.ok ? k.okTitle : k.badTitle}</h1>
            <p className="mt-1 max-w-[62ch] text-lg">
              {chain.ok ? k.ok(chain.checked) : k.bad(data.ledger[chain.brokenAt ?? 0]?.seq ?? 0)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {data.tamperBackup ? (
            <button type="button" onClick={app.undoTamper} className="rounded-lg bg-bahi px-4 py-2.5 font-semibold text-patra">
              {k.undoTamper}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => tamperIndex >= 0 && app.tamper(tamperIndex)}
                className="rounded-lg bg-patra px-4 py-2.5 font-semibold text-mohar"
              >
                {k.tryTamper}
              </button>
              <span className="text-patra/85">{k.tryTamperHint}</span>
            </>
          )}
        </div>
      </section>

      <h2 className="font-display text-2xl text-patra">{k.title}</h2>

      {meetings.map(([meetingId, entries]) => {
        const opened = entries.find((e) => e.type === 'meeting_open');
        const title = meetingId === 'history' ? k.history
          : `${k.meeting} ${new Date((opened ?? entries[0]).ts).toLocaleString(lang === 'en' ? 'en-IN' : 'hi-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
        return (
          <section key={meetingId} className="ledger-paper bound overflow-hidden rounded-lg shadow-lg">
            <h3 className="border-b-2 border-bahi/30 bg-patra-deep/70 py-2 pl-16 font-display text-lg text-bahi">{title}</h3>
            <ol>
              {entries.map((e) => {
                const idx = data.ledger.indexOf(e);
                const broken = !chain.ok && chain.brokenAt !== null && idx >= chain.brokenAt;
                const isBreak = !chain.ok && idx === chain.brokenAt;
                const cancelled = reversed.has(e.id);
                return (
                  <li
                    key={e.id}
                    className={`relative grid min-h-[44px] grid-cols-[1fr_auto] items-center gap-x-3 py-1 pl-16 pr-4 ${isBreak ? 'bg-bahi/15' : ''}`}
                  >
                    <span className="absolute left-0 w-[52px] pr-2 text-right text-sm text-bahi/90 num">{e.seq}</span>
                    <span className={`min-w-0 truncate ${cancelled ? 'text-neel-faint line-through' : ''}`}>
                      <span className="font-semibold">{name(e.memberId)}</span>{' '}
                      <span className="text-neel-soft">{t.typeLabel[e.type]}</span>
                      {cancelled && <span className="ml-2 text-sm text-bahi no-underline">({k.reversed})</span>}
                    </span>
                    <span className="text-right font-display text-xl num">
                      {e.amount ? formatRupees(e.amount) : ''}
                    </span>
                    <span
                      className={`col-span-2 truncate font-mono text-[11px] ${broken ? 'text-bahi' : 'text-neel-faint'}`}
                      title={e.hash}
                    >
                      {broken ? '✗' : '🔒'} {k.lock} {e.hash.slice(0, 12)}… ← {e.prevHash.slice(0, 8)}…
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
