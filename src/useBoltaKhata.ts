import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appendEntries, computeBalances, verifyChain, type ChainReport, type LedgerEntry } from './lib/ledger';
import { initialState, resumeState, step, type MeetingState, type Reply } from './lib/meeting';
import { render, SPEECH_LANG, type Rendered } from './lib/phrases';
import {
  cueError, cueListen, cueSaved, listen, micLevel, speak, stopSpeaking, sttSupported,
  type Heard, type ListenError, type ListenHandle,
} from './lib/speech';
import { buildDemoData, loadData, saveData, type AppData, type Lang } from './lib/store';

export type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

const SAVED_KEYS = new Set<Reply['key']>(['saved', 'loanSaved', 'present', 'closed', 'undone']);
const ERROR_KEYS = new Set<Reply['key']>(['notHeard', 'notUnderstood', 'loanNoCash', 'noLoanToRepay']);
/** In hands-free mode, silent turns before the app stops listening on its own. */
const MAX_SILENT_TURNS = 4;

export interface Exchange {
  id: number;
  heard: string;
  reply: Reply;
  rendered: Rendered;
}

export function useBoltaKhata() {
  const [data, setData] = useState<AppData | null>(null);
  const [mstate, setMstate] = useState<MeetingState>(initialState);
  const [status, setStatus] = useState<Status>('idle');
  const [interim, setInterim] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [error, setError] = useState<ListenError | null>(null);
  const [level, setLevel] = useState(0);
  const [chain, setChain] = useState<ChainReport>({ ok: true, brokenAt: null, checked: 0 });
  const [stampKey, setStampKey] = useState(0);

  const dataRef = useRef<AppData | null>(null);
  const stateRef = useRef<MeetingState>(initialState);
  const loopRef = useRef(false);
  const listenRef = useRef<ListenHandle | null>(null);
  const exchangeId = useRef(0);

  const commitData = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
    void saveData(next);
  }, []);

  // Load from the phone, or seed the demo group on first run.
  useEffect(() => {
    (async () => {
      const stored = (await loadData()) ?? (await buildDemoData());
      dataRef.current = stored;
      const resumed = resumeState(stored.ledger);
      stateRef.current = resumed;
      setMstate(resumed);
      setData(stored);
      void saveData(stored);
    })();
  }, []);

  // Re-check the hash chain whenever the khata changes.
  useEffect(() => {
    if (!data) return;
    let live = true;
    verifyChain(data.ledger).then((r) => live && setChain(r));
    return () => { live = false; };
  }, [data]);

  // Show the live mic level only while listening.
  useEffect(() => {
    if (status !== 'listening') { setLevel(0); return; }
    let stop: (() => void) | null = null;
    let live = true;
    micLevel((l) => live && setLevel(l)).then((s) => { if (live) stop = s; else s(); });
    return () => { live = false; stop?.(); };
  }, [status]);

  const lang: Lang = data?.settings.lang ?? 'hi';

  /** One turn of the conversation: understand, write, answer out loud. */
  const process = useCallback(async (heard: { text: string; alternatives?: string[]; confidence?: number }) => {
    const current = dataRef.current;
    if (!current) return null;
    setStatus('thinking');
    const r = step(stateRef.current, heard, { members: current.group.members, ledger: current.ledger });
    stateRef.current = r.state;
    setMstate(r.state);

    let next = current;
    if (r.drafts.length) {
      next = { ...current, ledger: await appendEntries(current.ledger, r.drafts) };
      commitData(next);
    }
    const rendered = render(r.reply, next.settings.lang, next.group.members);
    const id = ++exchangeId.current;
    setExchanges((xs) => [...xs.slice(-30), { id, heard: heard.text, reply: r.reply, rendered }]);
    if (SAVED_KEYS.has(r.reply.key)) {
      cueSaved();
      if (r.reply.key === 'saved' || r.reply.key === 'loanSaved') setStampKey((k) => k + 1);
    } else if (ERROR_KEYS.has(r.reply.key)) {
      cueError();
    }
    setStatus('speaking');
    await speak(rendered.say, SPEECH_LANG[next.settings.lang]);
    return r;
  }, [commitData]);

  const stopLoop = useCallback(() => {
    loopRef.current = false;
    listenRef.current?.abort();
    listenRef.current = null;
    stopSpeaking();
    setInterim('');
    setStatus('idle');
  }, []);

  /** Hands-free conversation: listen, answer, listen again, until stopped. */
  const runLoop = useCallback(async () => {
    let silent = 0;
    while (loopRef.current) {
      const d = dataRef.current;
      if (!d) break;
      setStatus('listening');
      setInterim('');
      cueListen();
      const handle = listen(SPEECH_LANG[d.settings.lang], setInterim);
      listenRef.current = handle;
      let heard: Heard;
      try {
        heard = await handle.result;
      } catch (e) {
        const err = e as ListenError;
        if (err !== 'aborted') { setError(err); cueError(); }
        loopRef.current = false;
        break;
      }
      if (!loopRef.current) break;
      setInterim('');
      if (!heard.text) {
        // Pauses between speakers are normal. Only give up after a long quiet stretch.
        if (++silent >= MAX_SILENT_TURNS) { loopRef.current = false; break; }
        continue;
      }
      silent = 0;
      setError(null);
      const r = await process(heard);
      const handsFree = dataRef.current?.settings.handsFree ?? true;
      if (!r || !handsFree || r.state.phase === 'closed') loopRef.current = false;
    }
    listenRef.current = null;
    setStatus('idle');
  }, [process]);

  const toggleTalk = useCallback(() => {
    if (loopRef.current || status !== 'idle') { stopLoop(); return; }
    if (!sttSupported()) { setError('unsupported'); return; }
    setError(null);
    loopRef.current = true;
    void runLoop();
  }, [runLoop, status, stopLoop]);

  /** Typed text or a tapped example: goes through exactly the same engine. */
  const say = useCallback(async (text: string) => {
    if (loopRef.current) stopLoop();
    await process({ text });
    setStatus('idle');
  }, [process, stopLoop]);

  const updateSettings = useCallback((patch: Partial<AppData['settings']>) => {
    const d = dataRef.current;
    if (d) commitData({ ...d, settings: { ...d.settings, ...patch } });
  }, [commitData]);

  const resetDemo = useCallback(async () => {
    stopLoop();
    const fresh = await buildDemoData(dataRef.current?.settings.lang);
    stateRef.current = initialState;
    setMstate(initialState);
    setExchanges([]);
    commitData(fresh);
  }, [commitData, stopLoop]);

  /** Show what happens if someone quietly changes an old amount in the khata. */
  const tamper = useCallback((index: number) => {
    const d = dataRef.current;
    if (!d || d.tamperBackup) return;
    const original = d.ledger[index];
    const ledger = d.ledger.map((e, i) => (i === index ? { ...e, amount: Math.max(0, e.amount - 1000) } : e));
    commitData({ ...d, ledger, tamperBackup: { index, entry: original } });
  }, [commitData]);

  const undoTamper = useCallback(() => {
    const d = dataRef.current;
    if (!d?.tamperBackup) return;
    const { index, entry } = d.tamperBackup;
    const ledger: LedgerEntry[] = d.ledger.map((e, i) => (i === index ? entry : e));
    commitData({ ...d, ledger, tamperBackup: undefined });
  }, [commitData]);

  const balances = useMemo(() => (data ? computeBalances(data.ledger) : null), [data]);

  return {
    data, lang, mstate, status, interim, exchanges, error, level, chain, balances, stampKey,
    toggleTalk, say, updateSettings, resetDemo, tamper, undoTamper, stopLoop,
    lastExchange: exchanges[exchanges.length - 1] ?? null,
  };
}
