import { useState } from 'react';
import { ApiError } from '../lib/api';
import { useDeviceLang } from '../lib/prefs';
import { SITE } from '../lib/site';

const MAKING: Record<string, string> = { hi: 'आपका समूह तैयार हो रहा है…', mr: 'तुमचा गट तयार होत आहे…', en: 'Setting up your group…' };

/** The one-click way in: a guest account and a ready group, no number, no form. */
export function TrialButton({ onTrial, label, className }: { onTrial: () => Promise<void>; label: string; className: string }) {
  const [lang] = useDeviceLang();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const errors = SITE[lang].auth.errors;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await onTrial();
          } catch (e) {
            setErr(errors[e instanceof ApiError ? e.code : 'default'] ?? errors.default);
            setBusy(false);
          }
        }}
        className={`${className} disabled:cursor-wait disabled:opacity-80`}
      >
        {busy ? MAKING[lang] : label}
      </button>
      {err && <p role="alert" className="rounded-lg bg-haldi px-3 py-2 font-semibold text-bahi-dark">{err}</p>}
    </div>
  );
}
