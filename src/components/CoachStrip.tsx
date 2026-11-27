import type { Hint } from '../lib/coach';

interface Props {
  hint: Hint;
  label: string;
  disabled: boolean;
  onSay: (phrase: string) => void;
}

/** "Now say: ..." One line of guidance and the exact words, always visible under the reply. */
export function CoachStrip({ hint, label, disabled, onSay }: Props) {
  return (
    <div key={hint.lead} data-tour="coach" className="animate-pop mt-4 flex gap-3 rounded-xl bg-neel/[0.06] p-3 ring-1 ring-neel/15" aria-live="polite">
      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-neel text-xl text-patra">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 5h16v10H9l-5 4z" />
          <path d="M8 9h8M8 12h5" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neel-soft">{label}</p>
        <p className="text-lg leading-snug text-neel">{hint.lead}</p>
        {hint.say.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {hint.say.map((phrase) => (
              <button
                key={phrase}
                type="button"
                disabled={disabled}
                onClick={() => onSay(phrase)}
                className="min-h-[44px] rounded-full bg-patra px-4 font-display text-lg text-bahi shadow-[0_0_0_2px_#9E1B1F] transition active:scale-95 disabled:opacity-50"
              >
                🗣️ “{phrase}”
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
