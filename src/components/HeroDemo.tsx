import { useEffect, useState } from 'react';
import { DEMO_GROUP, type Lang } from '../lib/store';
import { SpokenText } from './SpokenText';
import { Understood } from './Understood';

/** A meeting playing on loop on the website: a member speaks, the khata answers, the stamp lands. */
const SCRIPT: Record<Lang, Array<[string, string, boolean]>> = {
  hi: [
    ['मैं मीना, दो सौ रुपये बचत', 'मीना देवी: बचत ₹200। सही है?', false],
    ['हाँ सही है', 'लिख लिया।', true],
    ['राधा को ढाई हज़ार लोन', 'ग्रुप के पास ₹22,700 से ₹20,200 बचेंगे। नेता जी, मंज़ूर?', false],
    ['मंज़ूर', 'लोन मंज़ूर। राधा को ₹2,500 लिख लिया।', true],
    ['हाथ में बीस हज़ार एक सौ है', 'खाते के हिसाब से ₹20,200 होने चाहिए। ₹100 कम है।', false],
  ],
  mr: [
    ['मी मीना, दोनशे रुपये बचत', 'मीना देवी: बचत ₹200. बरोबर आहे का?', false],
    ['बरोबर', 'लिहिलं.', true],
    ['राधाला अडीच हजार कर्ज', 'गटाकडे ₹22,700 पैकी ₹20,200 उरतील. अध्यक्ष, मंजूर?', false],
    ['मंजूर', 'कर्ज मंजूर. राधाला ₹2,500 लिहिलं.', true],
    ['रोख वीस हजार शंभर', 'खात्याप्रमाणे ₹20,200 हवेत. ₹100 कमी आहेत.', false],
  ],
  en: [
    ['Meena, two hundred rupees savings', 'Meena Devi: savings ₹200. Is that right?', false],
    ['yes', 'Saved.', true],
    ['Radha loan two thousand five hundred', 'Group cash goes from ₹22,700 to ₹20,200. Leader, approve?', false],
    ['approve', 'Loan approved. ₹2,500 to Radha is recorded.', true],
    ['Cash in hand twenty thousand one hundred', 'The ledger says ₹20,200. That is ₹100 short.', false],
  ],
};

export function HeroDemo({ lang, heardLabel, stamp }: { lang: Lang; heardLabel: string; stamp: string }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const lines = SCRIPT[lang];
  const [said, reply, stamped] = lines[i % lines.length];
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { setI(0); setTyped(0); }, [lang]);
  useEffect(() => {
    if (reduce) { setTyped(said.length); return; }
    if (typed < said.length) {
      const t = setTimeout(() => setTyped((n) => n + 1), 45);
      return () => clearTimeout(t);
    }
    const next = setTimeout(() => { setI((n) => n + 1); setTyped(0); }, 3200);
    return () => clearTimeout(next);
  }, [typed, said, reduce]);

  const done = typed >= said.length;
  return (
    <div className="ledger-paper bound relative mx-auto w-full max-w-md -rotate-1 rounded-xl py-5 pl-16 pr-5 shadow-[0_10px_0_-4px_#F1DE96,0_20px_0_-8px_#E7CF7C,0_30px_60px_rgba(0,0,0,.45)]">
      <div className="flex items-center gap-2 text-sm text-bahi">
        <span className={`inline-block h-3 w-3 rounded-full ${done ? 'bg-mohar' : 'animate-pulse bg-bahi'}`} />
        {heardLabel}
      </div>
      <p className="mt-1 min-h-[44px] font-display text-2xl leading-[44px] text-neel-soft">
        “<Understood text={said.slice(0, typed)} members={DEMO_GROUP.members} />{!done && <span className="animate-pulse">|</span>}”
      </p>
      <div className="min-h-[96px]">
        {done && <SpokenText key={i} text={reply} className="font-display text-2xl leading-[44px] text-neel" />}
      </div>
      {done && stamped && (
        <span key={`s${i}`} aria-hidden className="absolute bottom-6 right-6 rotate-[-9deg] animate-stamp rounded-md border-[3px] border-mohar px-3 font-display text-2xl leading-9 text-mohar mix-blend-multiply">
          {stamp}
        </span>
      )}
    </div>
  );
}
