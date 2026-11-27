import { HeroDemo } from '../components/HeroDemo';
import { LangSwitch } from '../components/LangSwitch';
import type { User } from '../lib/api';
import { useDeviceLang } from '../lib/prefs';
import { SITE } from '../lib/site';
import { UI } from '../lib/ui';

/** The public website: what it is, how a meeting works, who it is for, and a way in. */
export function Landing({ user, go }: { user: User | null; go: (to: string) => void }) {
  const [lang] = useDeviceLang();
  const s = SITE[lang];

  return (
    <div className="min-h-screen">
      <header className="cloth sticky top-0 z-30 border-b-4 border-haldi/70">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <img src="/icon.svg" alt="" className="h-10 w-10 rounded-lg ring-2 ring-patra/30" />
          <p className="flex-1 font-display text-2xl text-patra">{s.hero.title}</p>
          <LangSwitch />
          {user ? (
            <button type="button" onClick={() => go('/groups')} className="min-h-[44px] rounded-lg bg-patra px-4 font-display text-lg text-bahi">{s.nav.dashboard}</button>
          ) : (
            <>
              <button type="button" onClick={() => go('/login')} className="hidden min-h-[44px] rounded-lg px-4 font-display text-lg text-patra ring-1 ring-patra/40 sm:block">{s.nav.login}</button>
              <button type="button" onClick={() => go('/signup')} className="min-h-[44px] rounded-lg bg-patra px-4 font-display text-lg text-bahi">{s.nav.signup}</button>
            </>
          )}
        </div>
      </header>

      {/* Hero: the promise on the left, a meeting playing on the right */}
      <section className="cloth relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div className="text-patra">
            <h1 className="font-display text-6xl leading-none sm:text-7xl">{s.hero.title}</h1>
            <p className="mt-4 font-display text-3xl leading-tight text-haldi-light sm:text-4xl">{s.hero.line}</p>
            <p className="mt-5 max-w-xl text-xl leading-relaxed text-patra/90">{s.hero.sub}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => go(user ? '/groups' : '/signup')}
                className="min-h-[56px] rounded-xl bg-haldi px-6 font-display text-2xl text-bahi-dark shadow-[0_5px_0_#8a6200] active:translate-y-1"
              >
                {user ? s.hero.open : s.hero.primary}
              </button>
              <button
                type="button"
                onClick={() => go('/demo')}
                className="min-h-[56px] rounded-xl bg-patra px-6 font-display text-2xl text-bahi shadow-[0_5px_0_#4a0a0c] active:translate-y-1"
              >
                ▶ {s.hero.secondary}
              </button>
            </div>
          </div>
          <HeroDemo lang={lang} heardLabel={UI[lang].heard} stamp={UI[lang].stampOk} />
        </div>
        <dl className="border-t border-patra/20 bg-bahi-dark/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-6 sm:grid-cols-4">
            {s.stats.map(([big, small]) => (
              <div key={small}>
                <dt className="font-display text-4xl text-haldi-light num">{big}</dt>
                <dd className="text-patra/85">{small}</dd>
              </div>
            ))}
          </div>
        </dl>
      </section>

      {/* How a meeting works: a real sequence, so it is numbered */}
      <section className="bg-patra">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-4xl text-bahi">{s.howTitle}</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {s.how.map(([icon, title, text], i) => (
              <li key={title} className="relative rounded-2xl bg-patra-deep/50 p-5 ring-1 ring-bahi/15">
                <span className="absolute -top-4 left-5 grid h-9 w-9 place-items-center rounded-full bg-bahi font-display text-lg text-patra num">{i + 1}</span>
                <span aria-hidden className="text-4xl">{icon}</span>
                <p className="mt-2 font-display text-2xl text-bahi">{title}</p>
                <p className="mt-1 text-lg leading-snug text-neel">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="ledger-paper bound">
        <div className="mx-auto max-w-6xl py-16 pl-20 pr-4">
          <h2 className="font-display text-4xl text-bahi">{s.featuresTitle}</h2>
          <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {s.features.map(([icon, title, text]) => (
              <li key={title} className="flex gap-4">
                <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-patra text-3xl shadow-[0_0_0_3px_#E0A100]">{icon}</span>
                <div>
                  <p className="font-display text-xl leading-tight text-bahi">{title}</p>
                  <p className="mt-1 text-lg leading-snug text-neel">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="cloth">
        <div className="mx-auto max-w-6xl px-4 py-16 text-patra">
          <h2 className="font-display text-4xl">{s.forTitle}</h2>
          <ul className="mt-8 grid gap-5 lg:grid-cols-3">
            {s.for.map(([who, price, text], i) => (
              <li key={who} className={`rounded-2xl p-6 ${i === 0 ? 'bg-patra text-neel shadow-[0_0_0_4px_#E0A100]' : 'bg-bahi-dark/50 ring-1 ring-patra/20'}`}>
                <p className={`font-display text-2xl ${i === 0 ? 'text-bahi' : ''}`}>{who}</p>
                <p className={`mt-1 font-display text-3xl ${i === 0 ? 'text-mohar' : 'text-haldi-light'}`}>{price}</p>
                <p className="mt-3 text-lg leading-snug">{text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="font-display text-3xl">{s.trustTitle}</h2>
              <ul className="mt-3 space-y-2 text-lg text-patra/90">
                {s.trust.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="text-haldi-light">🔒</span>{x}</li>)}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => go(user ? '/groups' : '/signup')}
              className="min-h-[60px] rounded-xl bg-haldi px-8 font-display text-2xl text-bahi-dark shadow-[0_5px_0_#8a6200] active:translate-y-1"
            >
              {s.cta}
            </button>
          </div>
        </div>
      </section>

      <footer className="bg-bahi-dark py-6 text-center text-sm text-patra/75">
        <p>{s.footer} <a className="underline" href="https://github.com/skypank-coder/bolta-khata" target="_blank" rel="noreferrer">GitHub</a></p>
      </footer>
    </div>
  );
}
