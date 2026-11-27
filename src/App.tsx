import { useEffect, useState } from 'react';
import type { Lang } from './lib/store';
import { SPEECH_LANG } from './lib/phrases';
import { voiceAvailable } from './lib/speech';
import { LANG_NAMES, UI } from './lib/ui';
import { Khata } from './screens/Khata';
import { Report } from './screens/Report';
import { Sabha } from './screens/Sabha';
import { Welcome } from './components/Welcome';
import { HelpSheet } from './components/HelpSheet';
import type { Milestone } from './lib/coach';
import { useBoltaKhata } from './useBoltaKhata';

type Tab = 'sabha' | 'khata' | 'report';

export default function App() {
  const app = useBoltaKhata();
  const [tab, setTab] = useState<Tab>('sabha');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [voiceOk, setVoiceOk] = useState(true);
  const [newGroup, setNewGroup] = useState({ name: '', village: '', cash: '' });
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
            onClick={() => setHelpOpen(true)}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-patra px-3 font-display text-lg text-bahi shadow-[0_3px_0_#4a0a0c]"
          >
            <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-bahi text-sm text-patra">?</span>
            {t.help}
          </button>
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
              <form
                className="space-y-2 rounded-lg p-3 ring-1 ring-patra/25"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newGroup.name.trim() || !window.confirm(t.settings.newGroupConfirm)) return;
                  void app.startNewGroup(newGroup.name.trim(), newGroup.village.trim(), Number(newGroup.cash) || 0);
                  setNewGroup({ name: '', village: '', cash: '' });
                  setSettingsOpen(false);
                  setTab('sabha');
                }}
              >
                <p className="font-semibold">{t.settings.newGroup}</p>
                <p className="text-sm text-patra/80">{t.settings.newGroupHint}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([['name', t.settings.groupName, 'text'], ['village', t.settings.village, 'text'], ['cash', t.settings.openingCash, 'number']] as const).map(([k, label, type]) => (
                    <label key={k} className="flex flex-col gap-1 text-sm">
                      {label}
                      <input
                        type={type}
                        inputMode={type === 'number' ? 'numeric' : undefined}
                        min={0}
                        required={k === 'name'}
                        value={newGroup[k]}
                        onChange={(e) => setNewGroup((g) => ({ ...g, [k]: e.target.value }))}
                        className="min-h-[44px] rounded-lg bg-patra px-3 text-base text-neel"
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="min-h-[44px] rounded-lg bg-haldi px-4 font-semibold text-bahi-dark">{t.settings.create}</button>
              </form>
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

      {!data.settings.welcomed && (
        <Welcome
          lang={lang}
          onLang={(l) => app.updateSettings({ lang: l })}
          onDemo={() => { app.updateSettings({ welcomed: true }); setTab('sabha'); void app.playDemo(); }}
          onStart={() => { app.updateSettings({ welcomed: true }); setTab('sabha'); }}
        />
      )}

      {helpOpen && (
        <HelpSheet
          lang={lang}
          learned={(data.settings.learned ?? []) as Milestone[]}
          onClose={() => setHelpOpen(false)}
          onTry={(ph) => { setHelpOpen(false); setTab('sabha'); void app.say(ph); }}
          onDemo={() => { setHelpOpen(false); setTab('sabha'); void app.playDemo(); }}
        />
      )}

      <main>
        {tab === 'sabha' && <Sabha app={app} onHelp={() => setHelpOpen(true)} />}
        {tab === 'khata' && <Khata app={app} />}
        {tab === 'report' && <Report app={app} />}
      </main>
    </div>
  );
}
