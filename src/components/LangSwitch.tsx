import { useDeviceLang } from '../lib/prefs';
import type { Lang } from '../lib/store';

const SHORT: Record<Lang, string> = { hi: 'हिं', mr: 'मरा', en: 'EN' };
const FULL: Record<Lang, string> = { hi: 'हिंदी', mr: 'मराठी', en: 'English' };

/** Hindi, Marathi or English for the whole site; remembered on this device. */
export function LangSwitch() {
  const [lang, setLang] = useDeviceLang();
  return (
    <div className="flex rounded-lg bg-bahi-dark/50 p-1 ring-1 ring-patra/25" role="radiogroup" aria-label="Language / भाषा" data-tour="lang">
      {(Object.keys(SHORT) as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          aria-label={FULL[l]}
          onClick={() => setLang(l)}
          className={`min-h-[36px] min-w-[44px] rounded-md px-2 text-sm font-semibold ${lang === l ? 'bg-patra text-bahi' : 'text-patra/85'}`}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
