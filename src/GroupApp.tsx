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
import { Petals } from './components/Petals';
import { VoiceSettings } from './components/VoiceSettings';
import type { Milestone } from './lib/coach';
import { useBoltaKhata, type KhataOptions, type SyncStatus } from './useBoltaKhata';

type Tab = 'sabha' | 'khata' | 'report';

const SYNC: Record<Lang, Record<SyncStatus, string>> = {
  hi: { local: 'सिर्फ़ इस फ़ोन पर', saved: 'सुरक्षित, ऑनलाइन', syncing: 'भेज रहे हैं…', offline: 'ऑफ़लाइन, फ़ोन पर सुरक्षित', error: 'भेजने में दिक्कत' },
  mr: { local: 'फक्त या फोनवर', saved: 'सुरक्षित, ऑनलाइन', syncing: 'पाठवत आहे…', offline: 'ऑफलाइन, फोनवर सुरक्षित', error: 'पाठवताना अडचण' },
  en: { local: 'On this phone only', saved: 'Saved online', syncing: 'Saving…', offline: 'Offline, safe on this phone', error: 'Could not save online' },
};
const SYNC_DOT: Record<SyncStatus, string> = { local: 'bg-patra/60', saved: 'bg-mohar', syncing: 'bg-haldi animate-pulse', offline: 'bg-patra/50', error: 'bg-haldi' };

const G_TEXT: Record<Lang, { back: string; demoBadge: string; viewer: string; share: string; shareHint: string; copy: string; copied: string; notFound: string; conflict: string }> = {
  hi: { back: 'सभी समूह', demoBadge: 'डेमो', viewer: 'आप यह समूह सिर्फ़ देख सकते हैं। एंट्री समूह के फ़ोन से होती है।', share: 'समूह से जोड़ने का कोड', shareHint: 'NGO कार्यकर्ता या बैंक अधिकारी इस कोड से समूह देख सकते हैं, बदल नहीं सकते।', copy: 'कॉपी', copied: 'कॉपी हो गया', notFound: 'यह समूह नहीं मिला, या आपके खाते में नहीं है।', conflict: 'दूसरे फ़ोन से नई एंट्री आई थीं। ऑनलाइन वाला खाता रखा गया है।' },
  mr: { back: 'सर्व गट', demoBadge: 'डेमो', viewer: 'तुम्ही हा गट फक्त पाहू शकता. नोंदी गटाच्या फोनवरून होतात.', share: 'गटात सामील होण्याचा कोड', shareHint: 'NGO कार्यकर्ते किंवा बँक अधिकारी या कोडने गट पाहू शकतात, बदलू शकत नाहीत.', copy: 'कॉपी', copied: 'कॉपी झाले', notFound: 'हा गट सापडला नाही, किंवा तुमच्या खात्यात नाही.', conflict: 'दुसऱ्या फोनवरून नवीन नोंदी आल्या होत्या. ऑनलाइन खाते ठेवले आहे.' },
  en: { back: 'All groups', demoBadge: 'Demo', viewer: 'You can view this group only. Entries are made on the group\'s own phone.', share: 'Code to follow this group', shareHint: 'An NGO worker or bank officer can follow the group with this code, read-only.', copy: 'Copy', copied: 'Copied', notFound: 'This group was not found, or is not in your account.', conflict: 'Another phone had newer entries. The online ledger was kept.' },
};

export default function GroupApp({ options, onExit }: { options?: KhataOptions; onExit?: () => void }) {
  const app = useBoltaKhata(options);
  const [copied, setCopied] = useState(false);
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

  if (app.loadError) {
    const gt = G_TEXT[lang];
    return (
      <div className="cloth grid min-h-screen place-items-center p-6 text-center text-patra">
        <div>
          <p className="font-display text-3xl">{gt.notFound}</p>
          {onExit && <button type="button" onClick={onExit} className="mt-6 min-h-[48px] rounded-lg bg-patra px-5 font-display text-xl text-bahi">← {gt.back}</button>}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cloth grid min-h-screen place-items-center">
        <p className="font-display text-4xl text-patra">बोलता खाता</p>
      </div>
    );
  }

  const groupName = lang === 'en' ? data.group.name : data.group.nameLocal;
  const gt = G_TEXT[lang];

  return (
    <div className="min-h-screen">
      <header className="no-print cloth sticky top-0 z-30 border-b-4 border-haldi/70 shadow-[0_6px_20px_rgba(0,0,0,.3)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3">
          {onExit ? (
            <button type="button" onClick={onExit} aria-label={gt.back} title={gt.back} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-2xl text-patra ring-1 ring-patra/30 hover:bg-bahi-dark/50">
              ←
            </button>
          ) : (
            <img src="/icon.svg" alt="" className="h-10 w-10 rounded-lg ring-2 ring-patra/30" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-2xl leading-none text-patra">
              {groupName}
              {app.isDemo && <span className="ml-2 rounded bg-haldi px-1.5 align-middle font-body text-xs font-semibold text-bahi-dark">{gt.demoBadge}</span>}
            </p>
            <p className="flex items-center gap-1.5 truncate text-sm text-patra/80">
              <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${SYNC_DOT[app.syncStatus]}`} />
              {SYNC[lang][app.syncStatus]}{data.group.village ? `, ${data.group.village}` : ''}
            </p>
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
              <VoiceSettings lang={lang} />
              {!app.isDemo && app.joinCode && (
                <div className="space-y-1 rounded-lg p-3 ring-1 ring-patra/25">
                  <p className="font-semibold">{gt.share}</p>
                  <p className="flex items-center gap-3">
                    <span className="font-mono text-3xl tracking-[0.3em] text-haldi-light">{app.joinCode}</span>
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard?.writeText(app.joinCode!).catch(() => {}); setCopied(true); }}
                      className="min-h-[40px] rounded-lg bg-patra px-3 text-sm font-semibold text-bahi"
                    >
                      {copied ? gt.copied : gt.copy}
                    </button>
                  </p>
                  <p className="text-sm text-patra/80">{gt.shareHint}</p>
                </div>
              )}
              {app.isDemo && <form
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
              </form>}
              <p className="text-sm text-patra/80">{t.settings.privacy}</p>
              {app.isDemo && (
                <button
                  type="button"
                  onClick={() => { if (window.confirm(t.settings.resetConfirm)) { void app.resetDemo(); setSettingsOpen(false); setTab('sabha'); } }}
                  className="rounded-lg px-4 py-2 text-sm ring-1 ring-haldi/60"
                >
                  {t.settings.reset}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {(app.readOnly || app.conflict) && (
        <p className="no-print bg-haldi px-4 py-2 text-center font-semibold text-bahi-dark" role="status">
          {app.readOnly ? gt.viewer : gt.conflict}
        </p>
      )}

      {app.isDemo && !data.settings.welcomed && (
        <Welcome
          lang={lang}
          onLang={(l) => app.updateSettings({ lang: l })}
          onDemo={() => { app.updateSettings({ welcomed: true }); setTab('sabha'); void app.playDemo(); }}
          onStart={() => { app.updateSettings({ welcomed: true }); setTab('sabha'); }}
        />
      )}

      <Petals trigger={app.petalKey} />

      {helpOpen && (
        <HelpSheet
          lang={lang}
          learned={(data.settings.learned ?? []) as Milestone[]}
          onClose={() => setHelpOpen(false)}
          onTry={(ph) => { setHelpOpen(false); setTab('sabha'); void app.say(ph); }}
          onDemo={() => {
            setHelpOpen(false);
            if (app.isDemo) { setTab('sabha'); void app.playDemo(); } else window.location.hash = '#/demo';
          }}
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
