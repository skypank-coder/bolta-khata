import type { LedgerEntry } from './ledger';
import type { Group, Member } from './store';

/** Thin client for the Bolta Khata server. The session lives in an HttpOnly cookie. */

export interface User { id: string; phone: string; name: string }
export type Role = 'owner' | 'viewer';

export interface GroupSummary {
  id: string; name: string; village: string; role: Role; joinCode?: string;
  members: number; entries: number; lastSeq: number; cash: number; savings: number; outstanding: number;
  lastMeeting: string | null; chainOk: boolean; updatedAt: string;
}

export interface RemoteGroup { group: Group & { id: string }; role: Role; joinCode?: string; entries: LedgerEntry[] }

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? 'server_error');
  return json as T;
}

export const api = {
  me: () => call<{ user: User }>('GET', '/api/me'),
  signup: (phone: string, name: string, pin: string) => call<{ user: User }>('POST', '/api/auth/signup', { phone, name, pin }),
  login: (phone: string, pin: string) => call<{ user: User }>('POST', '/api/auth/login', { phone, pin }),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout'),
  groups: () => call<{ groups: GroupSummary[] }>('GET', '/api/groups'),
  createGroup: (g: { id: string; name: string; village: string; members: Member[]; entries: LedgerEntry[] }) =>
    call<{ id: string; joinCode: string; lastSeq: number }>('POST', '/api/groups', g),
  group: (id: string) => call<RemoteGroup>('GET', `/api/groups/${id}`),
  sync: (id: string, baseSeq: number, members: Member[], entries: LedgerEntry[]) =>
    call<{ lastSeq: number }>('POST', `/api/groups/${id}/sync`, { baseSeq, members, entries }),
  join: (code: string) => call<{ id: string; name: string; role: Role }>('POST', '/api/groups/join', { code }),
};
