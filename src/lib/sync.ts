import type { LedgerEntry } from './ledger';

export interface Merge {
  ledger: LedgerEntry[];
  /** Entries this phone has that the server does not, to send next. */
  toPush: LedgerEntry[];
  /** The phone and the server disagree on history; the server's copy was kept. */
  conflict: boolean;
}

/**
 * Bring this phone's copy and the server's copy together. Both are append-only hash chains,
 * so one is either a prefix of the other (take the longer), or they split at some entry
 * (keep the server's, which every other phone already trusts, and flag it).
 */
export function mergeLedgers(local: LedgerEntry[], server: LedgerEntry[]): Merge {
  const common = Math.min(local.length, server.length);
  const same = common === 0 || local[common - 1].hash === server[common - 1].hash;
  if (same && local.length >= server.length) return { ledger: local, toPush: local.slice(server.length), conflict: false };
  if (same) return { ledger: server, toPush: [], conflict: false };
  return { ledger: server, toPush: [], conflict: true };
}
