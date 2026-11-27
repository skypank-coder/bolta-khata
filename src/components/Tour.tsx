import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SPEECH_LANG } from '../lib/phrases';
import { speak, stopSpeaking } from '../lib/speech';
import type { Lang } from '../lib/store';
import type { TourStep } from '../lib/tours';
import { Sakhi } from './Sakhi';

const T: Record<Lang, { next: string; back: string; skip: string; done: string; replay: string; auto: string }> = {
  hi: { next: 'आगे', back: 'पीछे', skip: 'छोड़िए', done: 'शुरू करें', replay: 'फिर सुनिए', auto: 'अपने आप आगे' },
  mr: { next: 'पुढे', back: 'मागे', skip: 'वगळा', done: 'सुरू करा', replay: 'पुन्हा ऐका', auto: 'आपोआप पुढे' },
  en: { next: 'Next', back: 'Back', skip: 'Skip', done: 'Let\'s start', replay: 'Hear again', auto: 'Auto-advance' },
};

interface Rect { top: number; left: number; width: number; height: number }

/**
 * Sakhi walks through the screen: a spotlight on one part at a time, what it does
 * spoken aloud in the chosen language, and on to the next by herself.
 */
export function Tour({ steps, lang, onDone }: { steps: TourStep[]; lang: Lang; onDone: () => void }) {
  const t = T[lang];
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [talking, setTalking] = useState(false);
  const [auto, setAuto] = useState(true);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  const finish = useCallback(() => { stopSpeaking(); onDone(); }, [onDone]);

  // Find what this step points at, bring it into view, and keep the spotlight on it.
  useLayoutEffect(() => {
    if (!step.target) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
    };
    measure();
    const timer = setInterval(measure, 120); // follows smooth scrolling and layout changes
    window.addEventListener('resize', measure);
    return () => { clearInterval(timer); window.removeEventListener('resize', measure); };
  }, [step]);

  // Speak the step; move on by herself when she has finished (unless turned off).
  useEffect(() => {
    let live = true;
    setTalking(true);
    const started = Date.now();
    speak(step.say[lang], SPEECH_LANG[lang]).then(() => {
      if (!live) return;
      setTalking(false);
      // If there is no voice on this device, give people time to read.
      const readTime = Math.max(0, step.say[lang].length * 55 - (Date.now() - started));
      setTimeout(() => {
        if (live && auto && !last) setI((n) => n + 1);
      }, 900 + readTime);
    });
    nextRef.current?.focus();
    return () => { live = false; };
  }, [step, lang, auto, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, steps.length]);

  // Sakhi stands on the opposite half of the screen from what she points at.
  const targetLow = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false;
  const place = !rect ? 'bottom-6 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2' : targetLow ? 'top-4 left-1/2 -translate-x-1/2' : 'bottom-4 left-1/2 -translate-x-1/2';

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Sakhi">
      {/* Dim everything except the spotlight */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-2xl ring-4 ring-haldi-light transition-all duration-300"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 9999px rgba(40, 8, 8, 0.72), 0 0 30px 8px rgba(245, 200, 75, .6)' }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgba(40,8,8,0.72)]" />
      )}

      <div className={`fixed flex w-[min(640px,calc(100vw-24px))] items-end gap-2 ${place}`}>
        <div className="shrink-0 animate-pop">
          <Sakhi talking={talking} waving={i === 0} size={110} />
        </div>
        <div key={i} className="animate-pop relative mb-6 flex-1 rounded-2xl bg-patra p-4 text-neel shadow-[0_12px_40px_rgba(0,0,0,.45)]" aria-live="polite">
          <span aria-hidden className="absolute -left-2 bottom-6 h-4 w-4 rotate-45 bg-patra" />
          <p className="font-display text-xl leading-snug">{step.say[lang]}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-auto flex gap-1" aria-hidden>
              {steps.map((_, k) => <span key={k} className={`h-2 w-2 rounded-full ${k === i ? 'bg-bahi' : 'bg-neel/25'}`} />)}
            </span>
            <button type="button" onClick={() => void speak(step.say[lang], SPEECH_LANG[lang])} className="min-h-[40px] rounded-full px-3 text-sm ring-1 ring-neel/30">🔊 {t.replay}</button>
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="min-h-[40px] rounded-full px-3 text-sm ring-1 ring-neel/30">{t.back}</button>}
            <button type="button" onClick={finish} className="min-h-[40px] rounded-full px-3 text-sm ring-1 ring-neel/30">{t.skip}</button>
            <button
              ref={nextRef}
              type="button"
              onClick={() => (last ? finish() : setI(i + 1))}
              className="min-h-[44px] rounded-full bg-bahi px-5 font-display text-lg text-patra"
            >
              {last ? t.done : t.next}
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-neel-soft">
            <input type="checkbox" className="h-4 w-4 accent-bahi" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {t.auto}
          </label>
        </div>
      </div>
    </div>
  );
}

/** A small Sakhi button that can bring the tour back at any time. */
export function SakhiButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="no-print fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full bg-patra py-1 pl-1 pr-3 font-display text-bahi shadow-[0_6px_20px_rgba(0,0,0,.4)] ring-2 ring-haldi"
    >
      <span className="block h-12 w-12 overflow-hidden rounded-full bg-haldi/40">
        <Sakhi talking={false} size={48} />
      </span>
      {label}
    </button>
  );
}
