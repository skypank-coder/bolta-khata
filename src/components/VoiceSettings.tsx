import { useEffect, useState } from 'react';
import { SPEECH_LANG } from '../lib/phrases';
import { loadVoicePrefs, saveVoicePrefs, speak, voicesFor, type VoicePrefs } from '../lib/speech';
import type { Lang } from '../lib/store';

const T: Record<Lang, { title: string; voice: string; best: string; pace: string; slow: string; normal: string; fast: string; test: string; sample: string; none: string }> = {
  hi: { title: 'आवाज़', voice: 'किसकी आवाज़', best: 'सबसे साफ़ (अपने आप)', pace: 'रफ़्तार', slow: 'धीमी', normal: 'सामान्य', fast: 'तेज़', test: 'सुनकर देखिए', sample: 'नमस्ते दीदी। मीना देवी, बचत एक सौ रुपये। सही है?', none: 'इस फ़ोन में हिंदी आवाज़ नहीं मिली। Chrome या Edge में खोलिए।' },
  mr: { title: 'आवाज', voice: 'कोणाचा आवाज', best: 'सर्वात स्पष्ट (आपोआप)', pace: 'वेग', slow: 'हळू', normal: 'सामान्य', fast: 'जलद', test: 'ऐकून पाहा', sample: 'नमस्कार ताई. मीना देवी, बचत शंभर रुपये. बरोबर आहे का?', none: 'या फोनमध्ये मराठी किंवा हिंदी आवाज सापडला नाही. Chrome किंवा Edge मध्ये उघडा.' },
  en: { title: 'Voice', voice: 'Voice', best: 'Clearest (automatic)', pace: 'Speed', slow: 'Slow', normal: 'Normal', fast: 'Fast', test: 'Test it', sample: 'Namaste. Meena Devi, savings one hundred rupees. Is that right?', none: 'No Indian voice found on this device. Open in Chrome or Edge.' },
};

const PACES = [['slow', 0.8], ['normal', 0.95], ['fast', 1.1]] as const;

/** Choose the clearest voice this device has, and how fast it speaks. Saved on this phone only. */
export function VoiceSettings({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [prefs, setPrefs] = useState<VoicePrefs>(loadVoicePrefs);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => { voicesFor(SPEECH_LANG[lang]).then(setVoices); }, [lang]);
  const update = (p: VoicePrefs) => { setPrefs(p); saveVoicePrefs(p); };

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 font-semibold">{t.title}</legend>
      {voices.length === 0 ? (
        <p className="text-sm text-haldi-light">{t.none}</p>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          {t.voice}
          <select
            value={prefs.voice ?? ''}
            onChange={(e) => update({ ...prefs, voice: e.target.value || undefined })}
            className="min-h-[44px] rounded-lg bg-patra px-3 text-base text-neel"
          >
            <option value="">{t.best}: {voices[0]?.name}</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm" role="radiogroup" aria-label={t.pace}>
        <span>{t.pace}:</span>
        {PACES.map(([k, rate]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={prefs.rate === rate}
            onClick={() => update({ ...prefs, rate })}
            className={`min-h-[40px] rounded-full px-3 ${prefs.rate === rate ? 'bg-patra text-bahi' : 'ring-1 ring-patra/30'}`}
          >
            {t[k]}
          </button>
        ))}
        <button type="button" onClick={() => void speak(t.sample, SPEECH_LANG[lang])} className="min-h-[40px] rounded-full bg-haldi px-3 font-semibold text-bahi-dark">
          🔊 {t.test}
        </button>
      </div>
    </fieldset>
  );
}
