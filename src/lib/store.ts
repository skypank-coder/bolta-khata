import { appendEntries, type EntryDraft, type LedgerEntry } from './ledger';
import type { NamedMember } from './phonetic';

/**
 * Everything lives on the phone in IndexedDB, so a meeting under a tree with no
 * signal still works. Nothing is sent to a server.
 */

export type Lang = 'hi' | 'mr' | 'en';

export interface Member extends NamedMember {
  role?: 'leader' | 'member';
  phone?: string;
}

export interface Group {
  name: string;
  nameLocal: string;
  village: string;
  members: Member[];
}

export interface Settings {
  lang: Lang;
  handsFree: boolean;
  geminiKey?: string;
  /** Has seen the first-run welcome. */
  welcomed?: boolean;
  /** What this group has already done once (shown as a learning ladder). */
  learned?: string[];
}

export interface AppData {
  group: Group;
  ledger: LedgerEntry[];
  settings: Settings;
  /** Set only during the tamper demo, so the original entry can be put back. */
  tamperBackup?: { index: number; entry: LedgerEntry };
}

const DB_NAME = 'bolta-khata';
const STORE = 'kv';
const KEY = 'app';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function loadData(): Promise<AppData | null> {
  try {
    return (await idb<AppData | undefined>('readonly', (s) => s.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function saveData(data: AppData): Promise<void> {
  try {
    await idb('readwrite', (s) => s.put(data, KEY));
  } catch {
    // Private mode or storage blocked: the app keeps working in memory.
  }
}

export const DEMO_GROUP: Group = {
  name: 'Durga Mahila Samooh',
  nameLocal: 'दुर्गा महिला समूह',
  village: 'Rampur, Sitapur (UP)',
  members: [
    { id: 'm01', name: 'Meena Devi', nameLocal: 'मीना देवी', role: 'leader' },
    { id: 'm02', name: 'Sunita Kumari', nameLocal: 'सुनीता कुमारी', aliases: ['Kumari'] },
    { id: 'm03', name: 'Sunita Yadav', nameLocal: 'सुनीता यादव', aliases: ['Yadav'] },
    { id: 'm04', name: 'Rekha', nameLocal: 'रेखा' },
    { id: 'm05', name: 'Lakshmi Bai', nameLocal: 'लक्ष्मी बाई', aliases: ['Munni'] },
    { id: 'm06', name: 'Radha', nameLocal: 'राधा' },
    { id: 'm07', name: 'Geeta Verma', nameLocal: 'गीता वर्मा' },
    { id: 'm08', name: 'Kamla Devi', nameLocal: 'कमला देवी' },
    { id: 'm09', name: 'Farida Bano', nameLocal: 'फ़रीदा बानो' },
    { id: 'm10', name: 'Savitri', nameLocal: 'सावित्री' },
    { id: 'm11', name: 'Anjali', nameLocal: 'अंजलि' },
    { id: 'm12', name: 'Parvati', nameLocal: 'पार्वती' },
  ],
};

/** Carry-over from the paper register so balances look like a real 14-month-old group. */
const HISTORY: Array<[string, number, number]> = [
  // memberId, savings so far, loan outstanding
  ['m01', 3100, 0], ['m02', 2800, 2000], ['m03', 2600, 0], ['m04', 2900, 1500],
  ['m05', 1400, 0], ['m06', 3000, 3000], ['m07', 2700, 0], ['m08', 2500, 1000],
  ['m09', 2800, 0], ['m10', 2200, 2500], ['m11', 1900, 0], ['m12', 2600, 0],
];

export async function buildDemoData(lang: Lang = 'hi'): Promise<AppData> {
  const drafts: EntryDraft[] = [
    { type: 'opening', memberId: null, amount: 0, meetingId: 'history', note: 'Paper register carried over' },
  ];
  for (const [id, savings, loan] of HISTORY) {
    drafts.push({ type: 'savings', memberId: id, amount: savings, meetingId: 'history', note: 'Carried over' });
    if (loan) drafts.push({ type: 'loan', memberId: id, amount: loan, meetingId: 'history', note: 'Carried over' });
  }
  const ledger = await appendEntries([], drafts, () => new Date('2026-11-20T10:00:00+05:30'));
  return { group: DEMO_GROUP, ledger, settings: { lang, handsFree: true } };
}

/** A real group of your own: a name, a village, the cash carried over, and no members yet (add them by voice). */
export async function buildNewGroup(name: string, village: string, openingCash: number, settings: Settings): Promise<AppData> {
  const ledger = await appendEntries([], [
    { type: 'opening', memberId: null, amount: Math.max(0, Math.round(openingCash)), meetingId: 'history', note: 'Opening cash' },
  ]);
  return { group: { name, nameLocal: name, village, members: [] }, ledger, settings };
}
