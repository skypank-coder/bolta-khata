import { useEffect, useState } from 'react';
import type { Lang } from './lib/store';
import { SPEECH_LANG } from './lib/phrases';
import { voiceAvailable } from './lib/speech';
import { LANG_NAMES, UI } from './lib/ui';
import { Khata } from './screens/Khata';
import { Report } from './screens/Report';
import { Sabha } from './screens/Sabha';
import { useBoltaKhata } from './useBoltaKhata';

type Tab = 'sabha' | 'khata' | 'report';

export default function App() {
  const app = useBoltaKhata();
  const [tab, setTab] = useState<Tab>('sabha');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceOk, setVoiceOk] = useState(true);
  const { data, lang } = app;
  const t = UI[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    voiceAvailable(SPEECH_LANG[lang]).then(setVoiceOk);
  }, [lang]);

  // Leaving the meeting screen stops the microphone.
  useEffect(() => {
    if (tab !== 'sabha') app.stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!data) {
    return (
      <div className="cloth grid min-h-screen place-items-center">
        <p className="font-display text-4xl text-patra">बोलता खाता</p>
      </div>
    );
  }

  const groupName = lang === 'en' ? data.group.name : data.group.nameLocal;

  return (
    <div className="min-h-screen">
      <header className="no-print cloth sticky top-0 z-30 border-b-4 border-haldi/70 shadow-[0_6px_20px_rgba(0,0,0,.3)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3">
          <img src="/icon.svg" alt="" className="h-10 w-10 rounded-lg ring-2 ring-patra/30" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl leading-none text-patra">{t.appName}</p>
            <p className="truncate text-sm text-patra/75">{groupName}, {data.group.village}</p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            aria-label={t.settings.title}
            className="grid h-11 w-11 place-items-center rounded-lg text-patra ring-1 ring-patra/30 hover:bg-bahi-dark/50"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pt-2" aria-label="Screens">
          {(['sabha', 'khata', 'report'] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-current={tab === k ? 'page' : undefined}
              className={`rounded-t-lg px-5 py-2 font-display text-lg transition ${
                tab === k ? 'bg-patra text-bahi' : 'text-patra/80 hover:text-patra'
              }`}
            >
              {t.tabs[k]}
              {k === 'khata' && !app.chain.ok && <span className="ml-1.5 inline-block h-2.5 w-2.5 rounded-full bg-haldi" aria-hidden />}
            </button>
          ))}
        </nav>
        {settingsOpen && (
          <div className="border-t border-patra/20 bg-bahi-dark/95 text-patra">
            <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
              <fieldset>
                <legend className="mb-2 font-semibold">{t.settings.language}</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => app.updateSettings({ lang: l })}
                      aria-pressed={lang === l}
                      className={`rounded-lg px-4 py-2 text-lg ${lang === l ? 'bg-patra text-bahi' : 'ring-1 ring-patra/30'}`}
                    >
                      {LANG_NAMES[l]}
                    </button>
                  ))}
                </div>
                {!voiceOk && <p className="mt-2 text-sm text-haldi-light">{t.settings.voiceMissing}</p>}
              </fieldset>
              <p className="text-sm text-patra/80">{t.settings.privacy}</p>
              <button
                type="button"
                onClick={() => { if (window.confirm(t.settings.resetConfirm)) { void app.resetDemo(); setSettingsOpen(false); setTab('sabha'); } }}
                className="rounded-lg px-4 py-2 text-sm ring-1 ring-haldi/60"
              >
                {t.settings.reset}
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {tab === 'sabha' && <Sabha app={app} />}
        {tab === 'khata' && <Khata app={app} />}
        {tab === 'report' && <Report app={app} />}
      </main>
    </div>
  );
}
