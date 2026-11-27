import { useEffect, useRef } from 'react';
import { SPEECH_LANG } from '../lib/phrases';
import { speak } from '../lib/speech';
import type { Lang } from '../lib/store';
import { LANG_NAMES } from '../lib/ui';

const COPY: Record<Lang, { title: string; lines: [string, string][]; demo: string; start: string; spoken: string }> = {
  hi: {
    title: 'बोलता खाता',
    lines: [
      ['🎙️', 'माइक दबाइए और बोलिए: नाम, रकम, और बचत या किस्त।'],
      ['👂', 'हर एंट्री पूरे समूह को पढ़कर सुनाई जाती है।'],
      ['✅', 'समूह के “सही है” बोलने पर ही खाते में लिखी जाती है, और फिर कोई उसे चुपके से बदल नहीं सकता।'],
    ],
    demo: 'डेमो मीटिंग देखिए',
    start: 'अपनी मीटिंग शुरू कीजिए',
    spoken: 'नमस्ते दीदी। बोलता खाता में आपका स्वागत है। बोलिए, सुनिए, और सही है बोलिए।',
  },
  mr: {
    title: 'बोलता खाता',
    lines: [
      ['🎙️', 'माइक दाबा आणि सांगा: नाव, रक्कम, आणि बचत किंवा हप्ता.'],
      ['👂', 'प्रत्येक नोंद संपूर्ण गटाला वाचून ऐकवली जाते.'],
      ['✅', 'गटाने “बरोबर” म्हटल्यावरच खात्यात लिहिली जाते, आणि मग ती कोणी गुपचूप बदलू शकत नाही.'],
    ],
    demo: 'डेमो मीटिंग पाहा',
    start: 'आपली मीटिंग सुरू करा',
    spoken: 'नमस्कार ताई. बोलता खात्यात आपलं स्वागत आहे. बोला, ऐका, आणि बरोबर म्हणा.',
  },
  en: {
    title: 'Bolta Khata',
    lines: [
      ['🎙️', 'Tap the mic and say a name, an amount, and savings or repayment.'],
      ['👂', 'Every entry is read back to the whole group.'],
      ['✅', 'It is written only when the group says “sahi hai” (right), and after that nobody can quietly change it.'],
    ],
    demo: 'Watch a demo meeting',
    start: 'Start your own meeting',
    spoken: 'Welcome to Bolta Khata, the Self-Help Group register you run by voice.',
  },
};

interface Props {
  lang: Lang;
  onLang: (l: Lang) => void;
  onDemo: () => void;
  onStart: () => void;
}

/** First run: pick a language, understand the idea in three lines, then watch or start. */
export function Welcome({ lang, onLang, onDemo, onStart }: Props) {
  const c = COPY[lang];
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const go = (then: () => void) => {
    void speak(c.spoken, SPEECH_LANG[lang]);
    then();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-bahi-dark/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="ledger-paper bound page-turn w-full max-w-lg rounded-xl py-6 pl-16 pr-6 shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Language / भाषा">
          {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lang === l}
              onClick={() => onLang(l)}
              className={`min-h-[44px] rounded-full px-4 text-lg ${lang === l ? 'bg-bahi text-patra' : 'text-neel ring-1 ring-neel/30'}`}
            >
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>
        <h1 id="welcome-title" className="font-display text-5xl text-bahi">{c.title}</h1>
        <ol className="mt-4 space-y-3">
          {c.lines.map(([icon, text]) => (
            <li key={text} className="flex gap-3 text-lg leading-snug">
              <span aria-hidden className="text-2xl">{icon}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            ref={first}
            type="button"
            onClick={() => go(onDemo)}
            className="min-h-[52px] flex-1 rounded-lg bg-haldi px-4 font-display text-xl text-bahi-dark shadow-[0_4px_0_#8a6200] active:translate-y-0.5"
          >
            ▶ {c.demo}
          </button>
          <button
            type="button"
            onClick={() => go(onStart)}
            className="min-h-[52px] flex-1 rounded-lg bg-bahi px-4 font-display text-xl text-patra shadow-[0_4px_0_#4a0a0c] active:translate-y-0.5"
          >
            🎙️ {c.start}
          </button>
        </div>
      </div>
    </div>
  );
}
