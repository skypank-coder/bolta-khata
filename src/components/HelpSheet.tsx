import { useEffect, useRef } from 'react';
import { MILESTONES, MILESTONE_TEXT, type Milestone } from '../lib/coach';
import { SPEECH_LANG } from '../lib/phrases';
import { speak } from '../lib/speech';
import type { Lang } from '../lib/store';

type Card = { icon: string; title: string; text: string; tryIt?: string };

const CARDS: Record<Lang, { heading: string; ladder: string; listen: string; tryLabel: string; demo: string; close: string; cards: Card[] }> = {
  hi: {
    heading: 'कैसे चलाएँ',
    ladder: 'आपने क्या सीखा',
    listen: 'सुनिए',
    tryLabel: 'आज़माइए',
    demo: 'पूरी डेमो मीटिंग देखिए',
    close: 'बंद करें',
    cards: [
      { icon: '🎙️', title: 'माइक दबाइए', text: 'नीचे का बड़ा गोल बटन दबाइए। फ़ोन आपकी बात सुनने लगेगा।' },
      { icon: '🗣️', title: 'नाम, रकम, बचत या किस्त बोलिए', text: 'जैसे: मैं मीना, सौ रुपये बचत।', tryIt: 'मैं मीना, सौ रुपये बचत' },
      { icon: '👂', title: 'फ़ोन पढ़कर सुनाएगा', text: 'सब ध्यान से सुनिए। आपके शब्द रंगीन दिखेंगे: नाम, रकम, बचत।' },
      { icon: '✅', title: '“सही है” बोलिए', text: 'तभी खाते में लिखा जाएगा। गलत हो तो बोलिए: ग़लत है।', tryIt: 'सही है' },
      { icon: '🤝', title: 'लोन पर नेता जी “मंज़ूर” बोलें', text: 'ग्रुप के पास पैसा हो, तभी लोन लिखा जाएगा।' },
      { icon: '🪙', title: 'अंत में नकद गिनिए', text: 'बोलिए: मीटिंग बंद करो। फिर: हाथ में कितना है। कम हो तो फ़ोन बताएगा।' },
    ],
  },
  mr: {
    heading: 'कसं वापरायचं',
    ladder: 'तुम्ही काय शिकलात',
    listen: 'ऐका',
    tryLabel: 'करून पाहा',
    demo: 'संपूर्ण डेमो मीटिंग पाहा',
    close: 'बंद करा',
    cards: [
      { icon: '🎙️', title: 'माइक दाबा', text: 'खालचं मोठं गोल बटण दाबा. फोन तुमचं बोलणं ऐकू लागेल.' },
      { icon: '🗣️', title: 'नाव, रक्कम, बचत किंवा हप्ता सांगा', text: 'उदा: मी मीना, शंभर रुपये बचत.', tryIt: 'मी मीना, शंभर रुपये बचत' },
      { icon: '👂', title: 'फोन वाचून ऐकवेल', text: 'सगळ्यांनी नीट ऐका. तुमचे शब्द रंगीत दिसतील: नाव, रक्कम, बचत.' },
      { icon: '✅', title: '“बरोबर” म्हणा', text: 'तेव्हाच खात्यात लिहिलं जाईल. चूक असेल तर म्हणा: चूक.', tryIt: 'बरोबर' },
      { icon: '🤝', title: 'कर्जासाठी अध्यक्ष “मंजूर” म्हणतील', text: 'गटाकडे पैसे असतील तरच कर्ज लिहिलं जाईल.' },
      { icon: '🪙', title: 'शेवटी रोख मोजा', text: 'सांगा: मीटिंग बंद करा. मग: हातात किती आहेत. कमी असतील तर फोन सांगेल.' },
    ],
  },
  en: {
    heading: 'How to use it',
    ladder: 'What you have learned',
    listen: 'Listen',
    tryLabel: 'Try it',
    demo: 'Watch a full demo meeting',
    close: 'Close',
    cards: [
      { icon: '🎙️', title: 'Tap the mic', text: 'Press the big round button at the bottom. The phone starts listening.' },
      { icon: '🗣️', title: 'Say a name, an amount, savings or repayment', text: 'For example: Meena, 100 rupees savings.', tryIt: 'Meena, 100 rupees savings' },
      { icon: '👂', title: 'The phone reads it back', text: 'Everyone listens. Your words light up: the name, the amount, savings.' },
      { icon: '✅', title: 'Say “yes” (sahi hai)', text: 'Only then is it written. If it is wrong, say: no.', tryIt: 'yes' },
      { icon: '🤝', title: 'For a loan, the leader says “approve”', text: 'A loan is written only if the group has the cash.' },
      { icon: '🪙', title: 'Count the cash at the end', text: 'Say: end the meeting. Then say how much is in hand. If it is short, the phone tells you.' },
    ],
  },
};

interface Props {
  lang: Lang;
  learned: Milestone[];
  onClose: () => void;
  onTry: (phrase: string) => void;
  onDemo: () => void;
}

/** Picture cards that read themselves aloud, and a ladder of what this group has already done. */
export function HelpSheet({ lang, learned, onClose, onTry, onDemo }: Props) {
  const c = CARDS[lang];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const done = MILESTONES.filter((m) => learned.includes(m)).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bahi-dark/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="ledger-paper bound page-turn mx-auto max-w-3xl rounded-xl py-6 pl-16 pr-5 shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="flex items-start justify-between gap-3">
          <h1 id="help-title" className="font-display text-4xl text-bahi">{c.heading}</h1>
          <button ref={closeRef} type="button" onClick={onClose} className="min-h-[44px] rounded-lg px-4 font-semibold text-neel ring-1 ring-neel/30">
            {c.close}
          </button>
        </div>

        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {c.cards.map((card, i) => (
            <li key={card.title} className="flex gap-3 rounded-xl bg-patra-deep/60 p-3 ring-1 ring-bahi/15">
              <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-patra text-3xl shadow-[0_0_0_3px_#E0A100]">
                {card.icon}
              </span>
              <div className="min-w-0">
                <p className="font-display text-xl leading-tight text-bahi">
                  <span className="mr-1 text-neel-soft num">{i + 1}.</span>{card.title}
                </p>
                <p className="mt-1 leading-snug">{card.text}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void speak(`${card.title}. ${card.text}`, SPEECH_LANG[lang])}
                    className="min-h-[40px] rounded-full bg-neel px-3 text-sm text-patra"
                  >
                    🔊 {c.listen}
                  </button>
                  {card.tryIt && (
                    <button
                      type="button"
                      onClick={() => onTry(card.tryIt!)}
                      className="min-h-[40px] rounded-full px-3 text-sm text-neel ring-1 ring-neel/40"
                    >
                      {c.tryLabel}: “{card.tryIt}”
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-6 font-display text-2xl text-bahi">
          {c.ladder} <span className="text-neel-soft num">{done}/{MILESTONES.length}</span>
        </h2>
        <ol className="mt-2 flex flex-wrap gap-2" aria-label={c.ladder}>
          {MILESTONES.map((m) => {
            const ok = learned.includes(m);
            return (
              <li
                key={m}
                className={`flex min-h-[40px] items-center gap-2 rounded-full px-3 ${ok ? 'bg-mohar text-patra' : 'border border-dashed border-neel/40 text-neel-soft'}`}
              >
                <span aria-hidden>{ok ? '✓' : '○'}</span>
                {MILESTONE_TEXT[lang][m]}
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          onClick={onDemo}
          className="mt-6 min-h-[52px] w-full rounded-lg bg-haldi px-4 font-display text-xl text-bahi-dark shadow-[0_4px_0_#8a6200] active:translate-y-0.5"
        >
          ▶ {c.demo}
        </button>
      </div>
    </div>
  );
}
