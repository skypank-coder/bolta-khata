import { useEffect, useState } from 'react';
import type { Lang } from './store';

/** The language is this person's choice on this device, not the group's. Hindi by default. */
const KEY = 'bk.lang';
const EVENT = 'bk-lang';

export function getDeviceLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'hi' || v === 'mr' || v === 'en') return v;
  } catch {
    // storage blocked
  }
  return 'hi';
}

export function setDeviceLang(lang: Lang): void {
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useDeviceLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(getDeviceLang);
  useEffect(() => {
    const on = () => setLang(getDeviceLang());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [lang, setDeviceLang];
}
