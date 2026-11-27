import { useMemo, useState } from 'react';
import { MicButton } from '../components/MicButton';
import { RegisterPage } from '../components/RegisterPage';
import { memberBalance, meetingTotals } from '../lib/ledger';
import { formatRupees } from '../lib/numbers';
import { EXAMPLES } from '../lib/phrases';
import { UI } from '../lib/ui';
import type { useBoltaKhata } from '../useBoltaKhata';

type App = ReturnType<typeof useBoltaKhata>;

export function Sabha({ app }: { app: App }) {
  const { data, lang, mstate, status, interim, lastExchange, error, level, balances, stampKey } = app;
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const t = UI[lang];

  const members = data?.group.members ?? [];
  const ledger = data?.ledger ?? [];
  const today = useMemo(
    () => (mstate.meetingId ? ledger.filter((e) => e.meetingId === mstate.meetingId) : []),
    [ledger, mstate.meetingId],
  );
  const present = useMemo(
    () => new Set(mstate.meetingId ? meetingTotals(ledger, mstate.meetingId).present : []),
    [ledger, mstate.meetingId],
  );

  if (!data || !balances) return null;

  const name = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? (lang === 'en' ? m.name : m.nameLocal ?? m.name) : id;
  };
  // First name only, unless two members share it ("सुनीता कुमारी" / "सुनीता यादव").
  const firstOf = (m: (typeof members)[number]) => (lang === 'en' ? m.name : m.nameLocal ?? m.name).split(' ')[0];
  const shortName = (m: (typeof members)[number]) =>
    members.filter((o) => firstOf(o) === firstOf(m)).length > 1 ? (lang === 'en' ? m.name : m.nameLocal ?? m.name) : firstOf(m);
  const p = mstate.pending;
  const busy = status === 'thinking';

  // Every spoken answer also has a big button, for noisy rooms and for anyone who prefers to tap.
  const actions: Array<{ label: string; say: string; tone: 'yes' | 'no' | 'plain' }> =
    p?.kind === 'confirm' ? [{ label: t.actions.confirm, say: 'sahi hai', tone: 'yes' }, { label: t.actions.reject, say: 'galat hai', tone: 'no' }]
    : p?.kind === 'approveLoan' ? [{ label: t.actions.approve, say: 'manzoor', tone: 'yes' }, { label: t.actions.deny, say: 'nahi', tone: 'no' }]
    : p?.kind === 'confirmClose' ? [{ label: t.actions.close, say: 'sahi hai', tone: 'yes' }, { label: t.actions.keepOpen, say: 'nahi', tone: 'no' }]
    : p?.kind === 'needType' ? [{ label: t.typeLabel.savings, say: 'bachat', tone: 'plain' }, { label: t.typeLabel.repayment, say: 'kist', tone: 'plain' }]
    : p?.kind === 'pickMember' ? p.options.map((id) => ({ label: name(id), say: members.find((m) => m.id === id)!.name, tone: 'plain' as const }))
    : [];

  const phaseKey = mstate.phase === 'idle' ? 'idle' : mstate.phase;
  const examples = EXAMPLES[lang][phaseKey];
  const listeningText = status === 'listening' ? interim || '…' : null;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-48 pt-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0">
        {/* What the app just said, and what it heard */}
        <div className="ledger-paper overflow-hidden rounded-t-xl rounded-b-md shadow-[0_10px_0_-4px_#F1DE96,0_20px_0_-8px_#E7CF7C,0_24px_40px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between gap-3 border-b-2 border-bahi/30 bg-patra-deep/70 py-2 pl-16 pr-4 text-sm">
            <span className="font-semibold text-bahi">{t.phase[phaseKey]}</span>
            <span className="num text-neel-soft">
              {new Date().toLocaleDateString(lang === 'en' ? 'en-IN' : lang === 'mr' ? 'mr-IN' : 'hi-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="min-h-[176px] py-4 pl-16 pr-5" aria-live="polite">
            {listeningText !== null ? (
              <p className="font-display text-[1.7rem] leading-[44px] text-neel-soft">{listeningText}</p>
            ) : lastExchange ? (
              <>
                {lastExchange.heard && (
                  <p className="text-base leading-[44px] text-neel-soft">
                    <span className="mr-2 text-bahi/80">{t.heard}:</span>“{lastExchange.heard}”
                  </p>
                )}
                <p className="font-display text-[1.7rem] leading-[44px] text-neel">{lastExchange.rendered.show}</p>
              </>
            ) : (
              <p className="font-display text-[1.7rem] leading-[44px] text-neel">{t.welcome}</p>
            )}

            {actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    disabled={busy}
                    onClick={() => app.say(a.say, a.label)}
                    className={`min-h-[52px] rounded-lg px-6 font-display text-xl shadow-[0_4px_0_rgba(0,0,0,.25)] active:translate-y-0.5 disabled:opacity-50 ${
                      a.tone === 'yes' ? 'bg-mohar text-patra' : a.tone === 'no' ? 'bg-bahi text-patra' : 'border-2 border-neel bg-patra text-neel'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t-2 border-bahi/30">
            <h2 className="py-2 pl-16 font-display text-lg text-bahi">{t.todayPage}</h2>
            <RegisterPage entries={today} allEntries={ledger} members={members} lang={lang} stampKey={stampKey} />
          </div>
        </div>

        {error && t.errors[error] && (
          <p role="alert" className="mt-4 rounded-lg border-2 border-haldi bg-bahi-dark/60 p-3 text-patra">{t.errors[error]}</p>
        )}
      </section>

      <aside className="space-y-5">
        <div className="rounded-xl bg-bahi-dark/50 p-4 text-patra ring-1 ring-patra/15">
          <p className="text-patra/75">{t.cash}</p>
          <p className="font-display text-4xl num">{formatRupees(balances.groupCash)}</p>
          {mstate.meetingId && (
            <p className="mt-1 text-patra/80 num">{present.size}/{members.length} {t.present}</p>
          )}
        </div>

        <div>
          <h2 className="mb-2 font-display text-lg text-patra">{t.members}</h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
            {members.map((m) => {
              const b = memberBalance(balances, m.id);
              const here = present.has(m.id);
              const asked = p?.kind === 'pickMember' && p.options.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => app.say(m.name, lang === 'en' ? m.name : m.nameLocal ?? m.name)}
                    disabled={busy}
                    title={`${t.savings} ${formatRupees(b.savings)}, ${t.loanLeft} ${formatRupees(b.loanOutstanding)}`}
                    className={`flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left transition ${
                      here ? 'bg-patra text-neel' : 'bg-bahi-dark/40 text-patra/85 ring-1 ring-patra/15'
                    } ${asked ? 'ring-4 ring-haldi' : ''}`}
                  >
                    <span className="flex w-full items-center justify-between gap-1">
                      <span className="truncate font-semibold leading-tight">{shortName(m)}</span>
                      {here && <span aria-label={t.present} className="text-mohar">●</span>}
                    </span>
                    <span className={`text-xs num ${here ? 'text-neel-soft' : 'text-patra/60'}`}>{formatRupees(b.savings)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-patra/80">{t.tryThese}</h2>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={busy}
                onClick={() => app.say(ex)}
                className="rounded-full border border-patra/30 bg-bahi-dark/40 px-3.5 py-1.5 text-patra hover:bg-bahi-dark/70"
              >
                “{ex}”
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Thumb zone: mic in the middle, the two switches beside it */}
      <div className="no-print cloth fixed inset-x-0 bottom-0 z-20 border-t-4 border-haldi/70 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(0,0,0,.35)]">
        {typing && (
          <form
            className="mx-auto mb-3 flex max-w-xl gap-2"
            onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { void app.say(draft); setDraft(''); } }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.typePlaceholder}
              aria-label={t.typeInstead}
              className="min-w-0 flex-1 rounded-lg bg-patra px-3 py-2.5 text-lg text-neel placeholder:text-neel-faint"
            />
            <button type="submit" className="rounded-lg bg-haldi px-4 font-semibold text-bahi-dark">{t.send}</button>
          </form>
        )}
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-end gap-3">
          <label className="flex cursor-pointer flex-col items-start gap-1 text-sm text-patra/90" title={t.handsFreeHint}>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={data.settings.handsFree}
              onChange={(e) => app.updateSettings({ handsFree: e.target.checked })}
            />
            <span className="relative h-7 w-12 rounded-full bg-bahi-dark ring-1 ring-patra/30 transition peer-checked:bg-mohar peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-haldi-light after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-patra after:transition peer-checked:after:translate-x-5" />
            <span>{t.handsFree}</span>
          </label>
          <MicButton status={status} level={level} onClick={app.toggleTalk} label={t.status[status]} action={status === 'idle' ? t.status.idle : t.stop} />
          <button
            type="button"
            onClick={() => setTyping((v) => !v)}
            aria-expanded={typing}
            className="justify-self-end rounded-lg px-3 py-2 text-sm text-patra/90 ring-1 ring-patra/30 hover:bg-bahi-dark/50"
          >
            {t.typeInstead}
          </button>
        </div>
      </div>
    </div>
  );
}
