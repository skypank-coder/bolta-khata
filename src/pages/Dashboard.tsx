import { useEffect, useState } from 'react';
import { LangSwitch } from '../components/LangSwitch';
import { api, ApiError, type GroupSummary, type User } from '../lib/api';
import { newId } from '../lib/ledger';
import { formatRupees } from '../lib/numbers';
import { useDeviceLang } from '../lib/prefs';
import { SITE } from '../lib/site';
import { buildDemoData, buildNewGroup, saveData } from '../lib/store';

/** Every group this person runs or follows: a leader sees hers, an NGO worker sees all of theirs. */
export function Dashboard({ user, go, onLogout, onUser }: { user: User; go: (to: string) => void; onLogout: () => void; onUser: (u: User) => void }) {
  const [lang] = useDeviceLang();
  const d = SITE[lang].dash;
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [form, setForm] = useState({ name: '', village: '', cash: '', demo: false });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [claim, setClaim] = useState({ phone: '', name: '', pin: '' });

  const load = () => api.groups().then((r) => { setGroups(r.groups); setLoadErr(false); }).catch(() => setLoadErr(true));
  useEffect(() => { void load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const settings = { lang, handsFree: true, welcomed: true };
      const data = form.demo
        ? { ...(await buildDemoData(lang)), settings }
        : await buildNewGroup(form.name.trim(), form.village.trim(), Number(form.cash) || 0, settings);
      data.group = { ...data.group, name: form.name.trim(), nameLocal: form.name.trim(), village: form.village.trim() };
      const id = newId('g');
      const r = await api.createGroup({ id, name: data.group.name, village: data.group.village, members: data.group.members, entries: data.ledger });
      await saveData({ ...data, syncedSeq: r.lastSeq }, `g:${r.id}`);
      go(`/g/${r.id}`);
    } catch (err) {
      setMsg(err instanceof ApiError && err.code === 'offline' ? SITE[lang].auth.errors.offline : SITE[lang].auth.errors.default);
    } finally {
      setBusy(false);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api.join(code);
      go(`/g/${r.id}`);
    } catch {
      setMsg(d.badCode);
    }
  };

  const sum = (k: 'savings' | 'outstanding' | 'cash') => (groups ?? []).reduce((s, g) => s + g[k], 0);
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang === 'en' ? 'en-IN' : 'hi-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : d.never;
  const input = 'min-h-[48px] w-full rounded-lg bg-patra px-3 text-lg text-neel';

  return (
    <div className="min-h-screen pb-16">
      <header className="cloth sticky top-0 z-30 border-b-4 border-haldi/70">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => go('/')} aria-label={SITE[lang].hero.title}>
            <img src="/icon.svg" alt="" className="h-10 w-10 rounded-lg ring-2 ring-patra/30" />
          </button>
          <div className="min-w-0 flex-1 text-patra">
            <p className="text-sm text-patra/80">{d.hello},</p>
            <p className="truncate font-display text-2xl leading-none">{user.name}</p>
          </div>
          <LangSwitch />
          <button type="button" onClick={onLogout} className="min-h-[44px] rounded-lg px-3 text-patra ring-1 ring-patra/40">{d.logout}</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl text-patra">{d.title}</h1>
          {groups && groups.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-patra sm:grid-cols-4">
              {[groups.length, sum('savings'), sum('outstanding'), sum('cash')].map((v, i) => (
                <div key={d.totals[i]}>
                  <dt className="text-sm text-patra/75">{d.totals[i]}</dt>
                  <dd className="font-display text-2xl num">{i === 0 ? v : formatRupees(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {user.guest && (
          <form
            className="rounded-2xl bg-patra p-5 text-neel shadow-[0_0_0_4px_#E0A100]"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg(null);
              try {
                const r = await api.claim(claim.phone, claim.name, claim.pin);
                onUser(r.user);
              } catch (err) {
                const errs = SITE[lang].auth.errors;
                setMsg(errs[err instanceof ApiError ? err.code : 'default'] ?? errs.default);
              }
            }}
          >
            <p className="font-display text-2xl text-bahi">{d.guestTitle}</p>
            <p className="mt-1">{d.guestHint}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
              <label className="text-sm font-semibold">{SITE[lang].auth.phone}<input className="field" type="tel" inputMode="numeric" required placeholder="98765 43210" value={claim.phone} onChange={(e) => setClaim({ ...claim, phone: e.target.value })} /></label>
              <label className="text-sm font-semibold">{SITE[lang].auth.name}<input className="field" required value={claim.name} onChange={(e) => setClaim({ ...claim, name: e.target.value })} /></label>
              <label className="text-sm font-semibold">PIN<input className="field tracking-[0.4em]" type="password" inputMode="numeric" maxLength={6} required placeholder="••••" value={claim.pin} onChange={(e) => setClaim({ ...claim, pin: e.target.value.replace(/\D/g, '') })} /></label>
              <button type="submit" className="min-h-[52px] rounded-xl bg-bahi px-5 font-display text-xl text-patra">{d.claim}</button>
            </div>
          </form>
        )}

        {loadErr && <p role="alert" className="rounded-lg bg-haldi p-3 font-semibold text-bahi-dark">{SITE[lang].auth.errors.offline}</p>}
        {groups && groups.length === 0 && <p className="text-xl text-patra/90">{d.empty}</p>}

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(groups ?? []).map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => go(`/g/${g.id}`)}
                className="ledger-paper bound group block w-full rounded-xl py-4 pl-16 pr-4 text-left shadow-[0_8px_0_-3px_#F1DE96,0_16px_30px_rgba(0,0,0,.35)] transition hover:-translate-y-1 focus-visible:-translate-y-1"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-display text-2xl text-bahi">{g.name}</span>
                    <span className="block truncate text-neel-soft">{g.village || '—'}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${g.role === 'owner' ? 'bg-bahi text-patra' : 'bg-neel text-patra'}`}>
                    {g.role === 'owner' ? d.owner : d.viewer}
                  </span>
                </span>
                <span className="mt-3 grid grid-cols-3 gap-2 text-neel">
                  <span><span className="block text-xs text-neel-soft">{d.cash}</span><span className="font-display text-xl num">{formatRupees(g.cash)}</span></span>
                  <span><span className="block text-xs text-neel-soft">{d.savings}</span><span className="font-display text-xl num">{formatRupees(g.savings)}</span></span>
                  <span><span className="block text-xs text-neel-soft">{d.outstanding}</span><span className="font-display text-xl num">{formatRupees(g.outstanding)}</span></span>
                </span>
                <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neel-soft">
                  <span>{g.members} {d.members}</span>
                  <span>{d.lastMeeting}: {date(g.lastMeeting)}</span>
                  <span className={g.chainOk ? 'text-mohar' : 'font-semibold text-bahi'}>{g.chainOk ? `🔒 ${d.chainOk}` : `⚠ ${d.chainBad}`}</span>
                  {g.joinCode && <span className="font-mono">{d.code}: {g.joinCode}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {msg && <p role="alert" className="rounded-lg bg-haldi p-3 font-semibold text-bahi-dark">{msg}</p>}

        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <form onSubmit={create} className="space-y-3 rounded-2xl bg-bahi-dark/50 p-5 text-patra ring-1 ring-patra/20">
            <h2 className="font-display text-2xl">{d.newTitle}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">{d.groupName}<input className={input} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="text-sm">{d.village}<input className={input} value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} /></label>
              <label className="text-sm">{d.cashNow}<input className={input} type="number" inputMode="numeric" min={0} disabled={form.demo} value={form.cash} onChange={(e) => setForm({ ...form, cash: e.target.value })} /></label>
            </div>
            <label className="flex min-h-[44px] items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-haldi" checked={form.demo} onChange={(e) => setForm({ ...form, demo: e.target.checked })} />
              {d.withDemo}
            </label>
            <button type="submit" disabled={busy} className="min-h-[52px] rounded-xl bg-haldi px-6 font-display text-xl text-bahi-dark shadow-[0_4px_0_#8a6200] active:translate-y-0.5 disabled:opacity-60">
              {busy ? '…' : d.create}
            </button>
          </form>
          <form onSubmit={join} className="space-y-3 rounded-2xl bg-bahi-dark/50 p-5 text-patra ring-1 ring-patra/20">
            <h2 className="font-display text-2xl">{d.joinTitle}</h2>
            <p className="text-sm text-patra/80">{d.joinHint}</p>
            <input
              className={`${input} font-mono uppercase tracking-[0.4em]`}
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              aria-label={d.joinTitle}
            />
            <button type="submit" className="min-h-[48px] w-full rounded-xl bg-patra px-6 font-display text-xl text-bahi">{d.join}</button>
          </form>
        </div>
      </main>
    </div>
  );
}
