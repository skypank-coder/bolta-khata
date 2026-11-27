import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appendEntries, computeBalances, verifyChain, type ChainReport, type LedgerEntry } from './lib/ledger';
import { initialState, resumeState, step, type MeetingState, type Reply } from './lib/meeting';
import { DEMO_SCRIPT, render, SPEECH_LANG, type Rendered } from './lib/phrases';
import { milestoneOf } from './lib/coach';
import {
  cueError, cueListen, cueSaved, cueStamp, listen, micLevel, speak, stopSpeaking, sttSupported,
  type Heard, type ListenError, type ListenHandle,
} from './lib/speech';
import { buildDemoData, buildNewGroup, loadData, saveData, type AppData, type Lang } from './lib/store';
import { api, type Role } from './lib/api';
import { mergeLedgers } from './lib/sync';
import { getDeviceLang, setDeviceLang } from './lib/prefs';

export type Status = 'idle' | 'listening' | 'thinking' | 'speaking';
export type SyncStatus = 'local' | 'saved' | 'syncing' | 'offline' | 'error';

export interface KhataOptions {
  /** Where this group's copy lives on the phone. */
  storageKey?: string;
  /** A group saved in the cloud for a signed-in account. Without it, a local demo group. */
  remoteId?: string;
}

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

export function useBoltaKhata(opts: KhataOptions = {}) {
  const storageKey = opts.storageKey ?? 'app';
  const remoteId = opts.remoteId;
  const [data, setData] = useState<AppData | null>(null);
  const [mstate, setMstate] = useState<MeetingState>(initialState);
  const [status, setStatus] = useState<Status>('idle');
  const [interim, setInterim] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [error, setError] = useState<ListenError | null>(null);
  const [level, setLevel] = useState(0);
  const [chain, setChain] = useState<ChainReport>({ ok: true, brokenAt: null, checked: 0 });
  const [stampKey, setStampKey] = useState(0);
  const [petalKey, setPetalKey] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(remoteId ? 'syncing' : 'local');
  const [role, setRole] = useState<Role>('owner');
  const [joinCode, setJoinCode] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const dataRef = useRef<AppData | null>(null);
  const stateRef = useRef<MeetingState>(initialState);
  const loopRef = useRef(false);
  const listenRef = useRef<ListenHandle | null>(null);
  const exchangeId = useRef(0);
  const demoRef = useRef(false);

  const syncedRef = useRef(0);
  const membersRef = useRef('');
  const pushingRef = useRef(false);
  const pushAgainRef = useRef(false);
  const roleRef = useRef<Role>('owner');

  const commitData = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
    void saveData(next, storageKey);
  }, [storageKey]);

  /** Bring in the server's copy; keep anything this phone wrote that the server has not seen. */
  const pull = useCallback(async (local: AppData | null): Promise<AppData | null> => {
    if (!remoteId) return local;
    const r = await api.group(remoteId);
    roleRef.current = r.role;
    setRole(r.role);
    setJoinCode(r.joinCode);
    const settings = local?.settings ?? { lang: getDeviceLang(), handsFree: true, welcomed: true };
    const serverSeq = r.entries.at(-1)?.seq ?? 0;
    syncedRef.current = serverSeq;
    if (!local) {
      membersRef.current = JSON.stringify(r.group.members);
      return { group: r.group, ledger: r.entries, settings, syncedSeq: serverSeq, role: r.role };
    }
    const m = mergeLedgers(local.ledger, r.entries);
    setConflict(m.conflict);
    const keepLocalMembers = m.toPush.length > 0 || local.group.members.length > r.group.members.length;
    membersRef.current = JSON.stringify(r.group.members);
    return {
      ...local,
      group: { ...r.group, members: keepLocalMembers ? local.group.members : r.group.members },
      ledger: m.ledger,
      syncedSeq: serverSeq,
      role: r.role,
      tamperBackup: undefined,
    };
  }, [remoteId]);

  /** Send new entries (and member changes) to the server. Append-only; the server re-checks the chain. */
  const push = useCallback(async (): Promise<void> => {
    const d = dataRef.current;
    if (!remoteId || !d || roleRef.current !== 'owner' || d.tamperBackup) return;
    if (pushingRef.current) { pushAgainRef.current = true; return; }
    const entries = d.ledger.filter((e) => e.seq > syncedRef.current);
    const members = JSON.stringify(d.group.members);
    if (!entries.length && members === membersRef.current) { setSyncStatus('saved'); return; }
    pushingRef.current = true;
    setSyncStatus('syncing');
    try {
      const r = await api.sync(remoteId, syncedRef.current, d.group.members, entries);
      syncedRef.current = r.lastSeq;
      membersRef.current = members;
      const latest = dataRef.current;
      if (latest) { latest.syncedSeq = r.lastSeq; void saveData(latest, storageKey); }
      setSyncStatus('saved');
    } catch (e) {
      const err = e as { status?: number };
      if (err.status === 409) {
        // Another phone wrote first: take its entries, then try again.
        const merged = await pull(dataRef.current).catch(() => null);
        if (merged) { commitData(merged); pushAgainRef.current = true; }
      } else {
        setSyncStatus(err.status === 0 ? 'offline' : 'error');
      }
    } finally {
      pushingRef.current = false;
      if (pushAgainRef.current) { pushAgainRef.current = false; void push(); }
    }
  }, [commitData, pull, remoteId, storageKey]);

  // Load this group: the phone's copy first (works offline), then the server's.
  useEffect(() => {
    (async () => {
      let d = await loadData(storageKey);
      if (remoteId) {
        syncedRef.current = d?.syncedSeq ?? 0;
        // Until the server answers, trust the role this phone saw last time (offline followers stay view-only).
        if (d?.role) { roleRef.current = d.role; setRole(d.role); }
        try {
          d = await pull(d);
        } catch (e) {
          const code = (e as { code?: string }).code ?? 'error';
          if (!d) { setLoadError(code); return; }
          setSyncStatus(code === 'offline' ? 'offline' : 'error');
        }
      }
      d ??= await buildDemoData(getDeviceLang());
      d = { ...d, settings: { ...d.settings, lang: getDeviceLang(), ...(remoteId ? { welcomed: true } : {}) } };
      dataRef.current = d;
      const resumed = resumeState(d.ledger);
      stateRef.current = resumed;
      setMstate(resumed);
      setData(d);
      void saveData(d, storageKey);
      if (remoteId) void push();
    })();
  }, [pull, push, remoteId, storageKey]);

  // Every change is sent shortly after it is written; and again when the phone comes back online.
  useEffect(() => {
    if (!remoteId || !data) return;
    const t = setTimeout(() => void push(), 600);
    return () => clearTimeout(t);
  }, [data, push, remoteId]);
  // Followers (NGO, bank) watch live: new entries appear every few seconds, coins and all.
  useEffect(() => {
    if (!remoteId || role !== 'viewer') return;
    const tick = async () => {
      const before = dataRef.current;
      const merged = await pull(before).catch(() => null);
      if (!merged || !before || merged.ledger.length === before.ledger.length) return;
      const fresh = merged.ledger.slice(before.ledger.length);
      commitData(merged);
      const resumed = resumeState(merged.ledger);
      stateRef.current = resumed;
      setMstate(resumed);
      if (fresh.some((e) => ['savings', 'repayment', 'loan'].includes(e.type))) setStampKey((k) => k + 1);
      if (fresh.some((e) => e.type === 'meeting_close' || e.type === 'member_join')) setPetalKey((k) => k + 1);
    };
    const every = setInterval(() => void tick(), 4000);
    return () => clearInterval(every);
  }, [commitData, pull, remoteId, role]);

  useEffect(() => {
    if (!remoteId) return;
    const on = () => void push();
    window.addEventListener('online', on);
    const every = setInterval(on, 20000);
    return () => { window.removeEventListener('online', on); clearInterval(every); };
  }, [push, remoteId]);

  // Re-check the hash chain whenever the khata changes.
  useEffect(() => {
    if (!data) return;
    let live = true;
    verifyChain(data.ledger).then((r) => live && setChain(r));
    return () => { live = false; };
  }, [data]);

  // Show the live mic level only while listening.
  useEffect(() => {
    // The demo only pretends to listen: never ask for the microphone during it.
    if (status !== 'listening' || demoPlaying) { setLevel(0); return; }
    let stop: (() => void) | null = null;
    let live = true;
    micLevel((l) => live && setLevel(l)).then((s) => { if (live) stop = s; else s(); });
    return () => { live = false; stop?.(); };
  }, [status, demoPlaying]);

  const lang: Lang = data?.settings.lang ?? 'hi';

  /**
   * Understand and write one turn. Turns are queued one after another: two quick taps
   * must never both read the same ledger and overwrite each other's entry.
   */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const understand = useCallback((heard: { text: string; alternatives?: string[]; confidence?: number }) => {
    const run = queueRef.current.then(async () => {
      const current = dataRef.current;
      if (!current) return null;
      if (remoteId && roleRef.current === 'viewer') return null; // view-only: never write
      const r = step(stateRef.current, heard, { members: current.group.members, ledger: current.ledger });
      stateRef.current = r.state;
      setMstate(r.state);
      let next = current;
      if (r.newMember) {
        next = { ...next, group: { ...next.group, members: [...next.group.members, r.newMember] } };
      }
      if (r.drafts.length) {
        next = { ...next, ledger: await appendEntries(next.ledger, r.drafts) };
      }
      const ms = milestoneOf(r.reply);
      if (ms && !demoRef.current && !next.settings.learned?.includes(ms)) {
        next = { ...next, settings: { ...next.settings, learned: [...(next.settings.learned ?? []), ms] } };
      }
      if (next !== current) commitData(next);
      return { r, next };
    });
    queueRef.current = run.catch(() => undefined);
    return run;
  }, [commitData, remoteId]);

  /** One turn of the conversation: understand, write, answer out loud. */
  const process = useCallback(async (heard: { text: string; alternatives?: string[]; confidence?: number }, shownAs?: string) => {
    setStatus('thinking');
    const done = await understand(heard);
    if (!done) return null;
    const { r, next } = done;
    const rendered = render(r.reply, next.settings.lang, next.group.members);
    const id = ++exchangeId.current;
    setExchanges((xs) => [...xs.slice(-30), { id, heard: shownAs ?? heard.text, reply: r.reply, rendered }]);
    if (r.reply.key === 'closed' || r.reply.key === 'memberAdded') setPetalKey((k) => k + 1);
    if (SAVED_KEYS.has(r.reply.key)) {
      cueSaved();
      if (r.reply.key === 'saved' || r.reply.key === 'loanSaved') {
        setStampKey((k) => k + 1);
        setTimeout(cueStamp, 260); // lands with the stamp animation
      }
    } else if (ERROR_KEYS.has(r.reply.key)) {
      cueError();
    }
    setStatus('speaking');
    await speak(rendered.say, SPEECH_LANG[next.settings.lang]);
    return r;
  }, [understand]);

  const stopLoop = useCallback(() => {
    loopRef.current = false;
    demoRef.current = false;
    setDemoPlaying(false);
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
      // "Your turn" note only after the app has spoken, not again after every quiet pause.
      if (silent === 0) cueListen();
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
    if (loopRef.current || demoRef.current || status !== 'idle') { stopLoop(); return; }
    if (remoteId && roleRef.current === 'viewer') return;
    if (!sttSupported()) { setError('unsupported'); return; }
    setError(null);
    loopRef.current = true;
    void runLoop();
  }, [remoteId, runLoop, status, stopLoop]);

  /** Typed text or a tapped example: goes through exactly the same engine. */
  const say = useCallback(async (text: string, shownAs?: string) => {
    if (loopRef.current) stopLoop();
    await process({ text }, shownAs);
    setStatus('idle');
  }, [process, stopLoop]);

  const updateSettings = useCallback((patch: Partial<AppData['settings']>) => {
    if (patch.lang) setDeviceLang(patch.lang);
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

  /** Start a real group of your own; members are then added by voice. */
  const startNewGroup = useCallback(async (name: string, village: string, openingCash: number) => {
    stopLoop();
    const settings = dataRef.current?.settings ?? { lang: 'hi' as Lang, handsFree: true };
    const fresh = await buildNewGroup(name, village, openingCash, settings);
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

  /**
   * Play a whole meeting by itself on a fresh demo group: each member line is typed out
   * and spoken in a higher voice, then answered by the app, exactly as in a live meeting.
   */
  const playDemo = useCallback(async () => {
    stopLoop();
    const lang = dataRef.current?.settings.lang ?? 'hi';
    const fresh = await buildDemoData(lang);
    fresh.settings = { ...fresh.settings, ...dataRef.current?.settings };
    stateRef.current = initialState;
    setMstate(initialState);
    setExchanges([]);
    commitData(fresh);
    demoRef.current = true;
    setDemoPlaying(true);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (const line of DEMO_SCRIPT[lang]) {
      if (!demoRef.current) break;
      setStatus('listening');
      for (let i = 1; i <= line.length && demoRef.current; i += 2) {
        setInterim(line.slice(0, i));
        await wait(28);
      }
      setInterim(line);
      await speak(line, SPEECH_LANG[lang], 1.02, 1.35);
      if (!demoRef.current) break;
      setInterim('');
      await process({ text: line });
      await wait(450);
    }
    demoRef.current = false;
    setDemoPlaying(false);
    setInterim('');
    setStatus('idle');
  }, [commitData, process, stopLoop]);

  const balances = useMemo(() => (data ? computeBalances(data.ledger) : null), [data]);

  return {
    data, lang, mstate, status, interim, exchanges, error, level, chain, balances, stampKey, petalKey,
    toggleTalk, say, updateSettings, resetDemo, tamper, undoTamper, stopLoop, playDemo, demoPlaying, startNewGroup,
    isDemo: !remoteId, syncStatus, role, readOnly: !!remoteId && role === 'viewer', joinCode, loadError, conflict,
    syncNow: push,
    lastExchange: exchanges[exchanges.length - 1] ?? null,
  };
}
