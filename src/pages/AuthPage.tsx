import { useState } from 'react';
import { LangSwitch } from '../components/LangSwitch';
import { api, ApiError, type User } from '../lib/api';
import { useDeviceLang } from '../lib/prefs';
import { SITE } from '../lib/site';

/** Mobile number and a PIN, like UPI: the sign-in every member already knows. */
export function AuthPage({ mode, go, onSignedIn }: { mode: 'login' | 'signup'; go: (to: string) => void; onSignedIn: (u: User) => void }) {
  const [lang] = useDeviceLang();
  const a = SITE[lang].auth;
  const [form, setForm] = useState({ phone: '', name: '', pin: '', pin2: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (signup && form.pin !== form.pin2) { setError(a.errors.pin_mismatch); return; }
    setBusy(true);
    try {
      const r = signup ? await api.signup(form.phone, form.name, form.pin) : await api.login(form.phone, form.pin);
      onSignedIn(r.user);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'default';
      setError(a.errors[code] ?? a.errors.default);
    } finally {
      setBusy(false);
    }
  };

  const field = 'field';
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="cloth flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => go('/')} className="flex flex-1 items-center gap-3 text-left">
          <img src="/icon.svg" alt="" className="h-10 w-10 rounded-lg ring-2 ring-patra/30" />
          <span className="font-display text-2xl text-patra">{SITE[lang].hero.title}</span>
        </button>
        <LangSwitch />
      </header>

      <main className="grid flex-1 place-items-center px-4 pb-12">
        <form onSubmit={submit} className="ledger-paper bound page-turn w-full max-w-md rounded-xl py-7 pl-16 pr-6 shadow-[0_24px_60px_rgba(0,0,0,.45)]" noValidate>
          <h1 className="font-display text-4xl text-bahi">{signup ? a.signupTitle : a.loginTitle}</h1>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block font-semibold text-neel">{a.phone}</span>
              <span className="flex items-center gap-2">
                <span className="grid min-h-[52px] place-items-center rounded-lg bg-neel px-3 text-xl font-semibold text-patra">+91</span>
                <input className={field} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} required placeholder="98765 43210" value={form.phone} onChange={set('phone')} />
              </span>
            </label>
            {signup && (
              <label className="block">
                <span className="mb-1 block font-semibold text-neel">{a.name}</span>
                <input className={field} type="text" autoComplete="name" required placeholder={lang === 'en' ? 'e.g. Meena Devi' : 'जैसे: मीना देवी'} value={form.name} onChange={set('name')} />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block font-semibold text-neel">{a.pin}</span>
              <input
                className={`${field} tracking-[0.6em]`}
                type="password"
                inputMode="numeric"
                autoComplete={signup ? 'new-password' : 'current-password'}
                pattern="\d{4,6}"
                maxLength={6}
                required
                placeholder="••••"
                value={form.pin}
                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
              />
            </label>
            {signup && (
              <label className="block">
                <span className="mb-1 block font-semibold text-neel">{a.pin2}</span>
                <input
                  className={`${field} tracking-[0.6em]`}
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  required
                  value={form.pin2}
                  onChange={(e) => setForm((f) => ({ ...f, pin2: e.target.value.replace(/\D/g, '') }))}
                />
                <span className="mt-1 block text-sm text-neel-soft">{a.pinHint}</span>
              </label>
            )}
          </div>

          {error && <p role="alert" className="mt-4 rounded-lg bg-bahi/10 p-3 font-semibold text-bahi">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 min-h-[56px] w-full rounded-xl bg-bahi px-4 font-display text-2xl text-patra shadow-[0_5px_0_#4a0a0c] active:translate-y-1 disabled:opacity-60"
          >
            {busy ? '…' : signup ? a.signup : a.login}
          </button>

          <p className="mt-5 text-center text-lg text-neel">
            {signup ? a.toLogin : a.toSignup}{' '}
            <button type="button" onClick={() => go(signup ? '/login' : '/signup')} className="font-semibold text-bahi underline underline-offset-4">
              {signup ? SITE[lang].nav.login : SITE[lang].nav.signup}
            </button>
          </p>
          <button type="button" onClick={() => go('/demo')} className="mt-3 w-full text-center text-neel-soft underline underline-offset-4">
            ▶ {a.demo}
          </button>
        </form>
      </main>
    </div>
  );
}
