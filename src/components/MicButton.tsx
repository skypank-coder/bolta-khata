import type { Status } from '../useBoltaKhata';

interface Props {
  status: Status;
  level: number;
  label: string;
  /** What pressing it will do, for screen readers ("Stop", "Tap to talk"). */
  action: string;
  onClick: () => void;
}

/** The one control that matters. Big, centred, in thumb reach, and it shows it is hearing you. */
export function MicButton({ status, level, label, action, onClick }: Props) {
  const active = status !== 'idle';
  const ring = status === 'listening' ? 1 + level * 0.55 : 1;
  return (
    <div className="relative flex flex-col items-center gap-2" data-tour="mic">
      <div className="relative grid h-28 w-28 place-items-center">
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full transition-transform duration-75 ${
            status === 'listening' ? 'bg-haldi/35' : status === 'speaking' ? 'bg-mohar/25 animate-pulse' : 'bg-transparent'
          }`}
          style={{ transform: `scale(${ring})` }}
        />
        {status === 'thinking' && (
          <span aria-hidden className="absolute -inset-1 animate-spin rounded-full border-4 border-dashed border-haldi-light/80 [animation-duration:2.4s]" />
        )}
        <button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          aria-label={action}
          className={`relative grid h-24 w-24 place-items-center rounded-full shadow-[0_6px_0_#4a0a0c,0_14px_30px_rgba(0,0,0,.35)] transition active:translate-y-1 active:shadow-[0_2px_0_#4a0a0c] ${
            active ? 'bg-haldi text-bahi-dark' : 'bg-patra text-bahi'
          }`}
        >
          {active ? (
            <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
            </svg>
          )}
        </button>
      </div>
      <span className="font-display text-lg text-patra" aria-live="polite">{label}</span>
    </div>
  );
}
