import { useEffect, useMemo, useState } from 'react';
import { MicButton } from '../components/MicButton';
import { RegisterPage } from '../components/RegisterPage';
import { CoachStrip } from '../components/CoachStrip';
import { SabhaCircle, type Today } from '../components/SabhaCircle';
import { nextHint } from '../lib/coach';
import { SpokenText } from '../components/SpokenText';
import { Understood } from '../components/Understood';
import { meetingTotals, reversedIds } from '../lib/ledger';
import { UI } from '../lib/ui';
import type { useBoltaKhata } from '../useBoltaKhata';

type App = ReturnType<typeof useBoltaKhata>;

export function Sabha({ app, onHelp }: { app: App; onHelp: () => void }) {
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

  // Laptop: Space starts/stops talking, Escape stops (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, button, [role=dialog]')) return;
      if (e.code === 'Space') { e.preventDefault(); app.toggleTalk(); }
      if (e.code === 'Escape') app.stopLoop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);

  // Money each member brought (or took) today, for the coins on her seat.
  const todayByMember = useMemo(() => {
    const reversed = reversedIds(ledger);
    const out: Record<string, Today> = {};
    for (const e of today) {
      if (!e.memberId || reversed.has(e.id)) continue;
      const t = (out[e.memberId] ??= { savings: 0, repayment: 0, loan: 0 });
      if (e.type === 'savings') t.savings += e.amount;
      if (e.type === 'repayment') t.repayment += e.amount;
      if (e.type === 'loan') t.loan += e.amount;
    }
    return out;
  }, [today, ledger]);

  // The money entry just stamped, so its coins can fly.
  const flight = useMemo(() => {
    if (!stampKey) return null;
    const reversed = reversedIds(ledger);
    const last = [...today].reverse().find((e) => ['savings', 'repayment', 'loan'].includes(e.type) && !reversed.has(e.id));
    return last?.memberId ? { key: stampKey, memberId: last.memberId, dir: last.type === 'loan' ? 'out' as const : 'in' as const } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampKey]);

  if (!data || !balances) return null;

  const name = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? (lang === 'en' ? m.name : m.nameLocal ?? m.name) : id;
  };
  const p = mstate.pending;
  const busy = status === 'thinking';
  // Whose money is on the table right now: she glows in the circle.
  const speaker =
    p?.kind === 'confirm' ? p.drafts[0]?.memberId
    : p?.kind === 'approveLoan' ? p.draft.memberId
    : p?.kind === 'needAmount' || p?.kind === 'needType' ? p.memberId
    : mstate.lastSpeaker;

  // Every spoken answer also has a big button, for noisy rooms and for anyone who prefers to tap.
  const actions: Array<{ label: string; say: string; tone: 'yes' | 'no' | 'plain' }> =
    p?.kind === 'confirm' ? [{ label: t.actions.confirm, say: 'sahi hai', tone: 'yes' }, { label: t.actions.reject, say: 'galat hai', tone: 'no' }]
    : p?.kind === 'approveLoan' ? [{ label: t.actions.approve, say: 'manzoor', tone: 'yes' }, { label: t.actions.deny, say: 'nahi', tone: 'no' }]
    : p?.kind === 'confirmClose' ? [{ label: t.actions.close, say: 'sahi hai', tone: 'yes' }, { label: t.actions.keepOpen, say: 'nahi', tone: 'no' }]
    : p?.kind === 'needType' ? [{ label: t.typeLabel.savings, say: 'bachat', tone: 'plain' }, { label: t.typeLabel.repayment, say: 'kist', tone: 'plain' }]
    : p?.kind === 'pickMember' ? p.options.map((id) => ({ label: name(id), say: members.find((m) => m.id === id)!.name, tone: 'plain' as const }))
    : [];

  const phaseKey = mstate.phase === 'idle' ? 'idle' : mstate.phase;
  const listeningText = status === 'listening' ? interim || '…' : null;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-48 pt-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0">
        {/* What the app just said, and what it heard */}
        <div
          key={mstate.meetingId ?? 'none'}
          className="ledger-paper bound page-turn overflow-hidden rounded-t-xl rounded-b-md shadow-[0_10px_0_-4px_#F1DE96,0_20px_0_-8px_#E7CF7C,0_24px_40px_rgba(0,0,0,.35)]"
        >
          <div className="flex items-center justify-between gap-3 border-b-2 border-bahi/30 bg-patra-deep/70 py-2 pl-16 pr-4 text-sm">
            <span className="font-semibold text-bahi">{t.phase[phaseKey]}</span>
            <span className="num text-neel-soft">
              {new Date().toLocaleDateString(lang === 'en' ? 'en-IN' : lang === 'mr' ? 'mr-IN' : 'hi-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="min-h-[176px] py-4 pl-16 pr-5" aria-live="polite">
            {listeningText !== null ? (
              <p className="font-display text-[1.7rem] leading-[44px] text-neel-soft">
                <Understood text={listeningText} members={members} />
              </p>
            ) : lastExchange ? (
              <>
                {lastExchange.heard && (
                  <p className="text-base leading-[44px] text-neel-soft">
                    <span className="mr-2 text-bahi/80">{t.heard}:</span>“<Understood text={lastExchange.heard} members={members} />”
                  </p>
                )}
                <SpokenText key={lastExchange.id} text={lastExchange.rendered.show} className="font-display text-[1.7rem] leading-[44px] text-neel" />
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

          {!app.readOnly && <div className="px-4 pb-4 pl-16">
            <CoachStrip
              hint={(() => {
                const h = nextHint(mstate, members, lang);
                // When big answer buttons are already showing, the coach only explains.
                return actions.length ? { ...h, say: [] } : h;
              })()}
              label={t.nowSay}
              disabled={busy}
              onSay={(ph) => app.say(ph)}
            />
          </div>}

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
        <SabhaCircle
          members={members}
          lang={lang}
          present={present}
          today={todayByMember}
          balances={balances}
          speaker={speaker}
          asked={p?.kind === 'pickMember' ? p.options : []}
          cashLabel={t.cash}
          presentLabel={t.present}
          disabled={busy}
          onTap={(m) => app.say(m.name, lang === 'en' ? m.name : m.nameLocal ?? m.name)}
          flight={flight}
        />

        {app.isDemo && <div className="rounded-xl border-2 border-haldi/70 bg-bahi-dark/40 p-4">
          <button
            type="button"
            onClick={() => (app.demoPlaying ? app.stopLoop() : void app.playDemo())}
            className="w-full rounded-lg bg-haldi px-4 py-3 font-display text-xl text-bahi-dark shadow-[0_4px_0_#8a6200] active:translate-y-0.5"
          >
            {app.demoPlaying ? t.stopDemo : t.playDemo}
          </button>
          <p className="mt-2 text-sm text-patra/80">{t.playDemoHint}</p>
          <p className="mt-1 hidden text-sm text-patra/80 lg:block">{t.keyHint}</p>
        </div>}

        <button
          type="button"
          onClick={onHelp}
          className="flex w-full items-center gap-3 rounded-xl bg-patra p-4 text-left text-neel shadow-[0_4px_0_#4a0a0c] active:translate-y-0.5"
        >
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-neel font-display text-2xl text-patra">?</span>
          <span className="font-display text-lg leading-snug">{t.howTo}</span>
        </button>
      </aside>

      {/* Thumb zone: mic in the middle, the two switches beside it */}
      {!app.readOnly && <div className="no-print cloth fixed inset-x-0 bottom-0 z-20 border-t-4 border-haldi/70 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(0,0,0,.35)]">
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
      </div>}
    </div>
  );
}
