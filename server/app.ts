import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { computeBalances, verifyChain, type LedgerEntry } from '../src/lib/ledger.ts';
import {
  hashPin, LoginLimiter, newId, newJoinCode, newToken, normalisePhone, tokenHash, validPin, verifyPin,
} from './auth.ts';
import type { DB } from './db.ts';

/**
 * The Bolta Khata API. Plain node:http so the container has no framework to patch.
 *
 *   POST /api/auth/signup   {phone, name, pin}
 *   POST /api/auth/login    {phone, pin}
 *   POST /api/auth/logout
 *   GET  /api/me
 *   POST /api/auth/guest  {name}         one-click trial account (expires after 3 days)
 *   POST /api/auth/claim  {phone, name, pin}   turn a guest account into a real one, keeping its groups
 *   GET  /api/groups                      every group this person owns or follows, with live figures
 *   POST /api/groups        {name, village, members, entries}
 *   GET  /api/groups/:id                  members + the full hash-chained ledger
 *   POST /api/groups/:id/sync {baseSeq, members, entries}   append-only, chain re-verified here
 *   POST /api/groups/join   {code}        follow a group read-only (NGO worker, bank officer)
 *   GET  /api/health
 */

const SESSION_DAYS = 30;
const MAX_BODY = 4 * 1024 * 1024;
const COOKIE = 'bk_session';

type Json = Record<string, unknown>;
interface User { id: string; phone: string; name: string }
interface Ctx { req: IncomingMessage; res: ServerResponse; db: DB; user: User | null; body: Json; params: string[] }

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function send(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<Json> {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'too_large');
    chunks.push(chunk as Buffer);
  }
  if (!size) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

function cookieToken(req: IncomingMessage): string | null {
  const m = /(?:^|;\s*)bk_session=([^;]+)/.exec(req.headers.cookie ?? '');
  return m ? decodeURIComponent(m[1]) : null;
}

function sessionCookie(token: string, maxAgeSec: number): string {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure}`;
}

function currentUser(db: DB, req: IncomingMessage): User | null {
  const token = cookieToken(req);
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id, u.phone, u.name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).get(tokenHash(token), Date.now()) as User | undefined;
  return row ?? null;
}

function startSession(db: DB, userId: string): string {
  const token = newToken();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(token), userId, Date.now() + SESSION_DAYS * 86400_000);
  return sessionCookie(token, SESSION_DAYS * 86400);
}

const needUser = (c: Ctx): User => {
  if (!c.user) throw new HttpError(401, 'login_required');
  return c.user;
};

function roleIn(db: DB, userId: string, groupId: string): 'owner' | 'viewer' | null {
  const row = db.prepare('SELECT role FROM memberships WHERE user_id = ? AND group_id = ?').get(userId, groupId) as
    { role: 'owner' | 'viewer' } | undefined;
  return row?.role ?? null;
}

function ledgerOf(db: DB, groupId: string): LedgerEntry[] {
  const rows = db.prepare('SELECT data FROM entries WHERE group_id = ? ORDER BY seq').all(groupId) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

/** Members are plain records; keep only the fields the app uses. */
function cleanMembers(raw: unknown): Json[] {
  if (!Array.isArray(raw)) throw new HttpError(400, 'bad_members');
  return raw.slice(0, 200).map((m) => {
    if (!m || typeof m !== 'object' || typeof (m as Json).id !== 'string' || typeof (m as Json).name !== 'string') {
      throw new HttpError(400, 'bad_members');
    }
    const { id, name, nameLocal, aliases, role, phone } = m as Json;
    return { id, name, nameLocal, aliases, role, phone };
  });
}

/**
 * New entries must continue the chain exactly where the server's copy ends, and every
 * hash must match its content. Even the server cannot accept a quietly edited entry.
 */
async function checkContinuation(existing: LedgerEntry[], incoming: unknown): Promise<LedgerEntry[]> {
  if (!Array.isArray(incoming)) throw new HttpError(400, 'bad_entries');
  const entries = incoming as LedgerEntry[];
  const report = await verifyChain([...existing, ...entries]);
  if (!report.ok) throw new HttpError(400, 'chain_broken');
  const lastSeq = existing.at(-1)?.seq ?? 0;
  entries.forEach((e, i) => {
    if (e.seq !== lastSeq + i + 1) throw new HttpError(400, 'bad_seq');
  });
  return entries;
}

function insertEntries(db: DB, groupId: string, entries: LedgerEntry[]) {
  const stmt = db.prepare('INSERT INTO entries (group_id, seq, id, hash, prev_hash, data) VALUES (?, ?, ?, ?, ?, ?)');
  for (const e of entries) stmt.run(groupId, e.seq, e.id, e.hash, e.prevHash, JSON.stringify(e));
}

function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const limiter = new LoginLimiter();
/** Guest trials per address per hour, so one-click accounts cannot be farmed. */
const guestLimiter = new LoginLimiter(30, 60 * 60 * 1000);
const GUEST_DAYS = 3;
const isGuest = (u: User) => u.phone.startsWith('guest:');
const publicUser = (u: User) => ({ id: u.id, name: u.name, phone: isGuest(u) ? '' : u.phone, guest: isGuest(u) });

/** Remove trial accounts older than three days, with their groups. */
export function sweepGuests(db: DB, now = Date.now()) {
  const cutoff = new Date(now - GUEST_DAYS * 86400_000).toISOString();
  const old = db.prepare("SELECT id FROM users WHERE phone LIKE 'guest:%' AND created_at < ?").all(cutoff) as { id: string }[];
  for (const { id } of old) {
    db.prepare('DELETE FROM groups WHERE owner_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
  return old.length;
}

type Handler = (c: Ctx) => Promise<void> | void;
const routes: Array<[string, RegExp, Handler]> = [
  ['GET', /^\/api\/health$/, ({ res }) => send(res, 200, { ok: true, time: new Date().toISOString() })],

  ['POST', /^\/api\/auth\/signup$/, async ({ db, res, body }) => {
    const phone = normalisePhone(body.phone);
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    if (!phone) throw new HttpError(400, 'bad_phone');
    if (!name) throw new HttpError(400, 'bad_name');
    if (!validPin(body.pin)) throw new HttpError(400, 'bad_pin');
    if (db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone)) throw new HttpError(409, 'phone_taken');
    const id = newId('u');
    db.prepare('INSERT INTO users (id, phone, name, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, phone, name, await hashPin(body.pin), new Date().toISOString());
    send(res, 201, { user: publicUser({ id, phone, name }) }, { 'Set-Cookie': startSession(db, id) });
  }],

  ['POST', /^\/api\/auth\/login$/, async ({ db, req, res, body }) => {
    const phone = normalisePhone(body.phone);
    if (!phone || typeof body.pin !== 'string') throw new HttpError(400, 'bad_login');
    const key = `${phone}|${req.socket.remoteAddress ?? ''}`;
    if (limiter.blocked(key)) throw new HttpError(429, 'too_many_tries');
    const row = db.prepare('SELECT id, phone, name, pin_hash FROM users WHERE phone = ?').get(phone) as
      (User & { pin_hash: string }) | undefined;
    if (!row || !(await verifyPin(body.pin, row.pin_hash))) {
      limiter.fail(key);
      throw new HttpError(401, 'wrong_pin');
    }
    limiter.clear(key);
    send(res, 200, { user: publicUser(row) }, { 'Set-Cookie': startSession(db, row.id) });
  }],

  ['POST', /^\/api\/auth\/logout$/, ({ db, req, res }) => {
    const token = cookieToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
    send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }],

  ['GET', /^\/api\/me$/, (c) => send(c.res, 200, { user: publicUser(needUser(c)) })],

  ['POST', /^\/api\/auth\/guest$/, async ({ db, req, res, body }) => {
    const ip = req.socket.remoteAddress ?? '';
    if (guestLimiter.blocked(ip)) throw new HttpError(429, 'too_many_tries');
    guestLimiter.fail(ip);
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 40) : 'Guest';
    const id = newId('u');
    const phone = `guest:${newToken().slice(0, 16)}`;
    // A random PIN nobody knows: a guest can only come back through this browser's session.
    db.prepare('INSERT INTO users (id, phone, name, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, phone, name, await hashPin(newToken()), new Date().toISOString());
    send(res, 201, { user: publicUser({ id, phone, name }) }, { 'Set-Cookie': startSession(db, id) });
  }],

  ['POST', /^\/api\/auth\/claim$/, async (c) => {
    const user = needUser(c);
    if (!isGuest(user)) throw new HttpError(400, 'not_guest');
    const phone = normalisePhone(c.body.phone);
    const name = typeof c.body.name === 'string' ? c.body.name.trim().slice(0, 80) : '';
    if (!phone) throw new HttpError(400, 'bad_phone');
    if (!name) throw new HttpError(400, 'bad_name');
    if (!validPin(c.body.pin)) throw new HttpError(400, 'bad_pin');
    if (c.db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone)) throw new HttpError(409, 'phone_taken');
    c.db.prepare('UPDATE users SET phone = ?, name = ?, pin_hash = ? WHERE id = ?').run(phone, name, await hashPin(c.body.pin), user.id);
    send(c.res, 200, { user: publicUser({ id: user.id, phone, name }) });
  }],

  ['GET', /^\/api\/groups$/, async (c) => {
    const user = needUser(c);
    const rows = c.db.prepare(
      `SELECT g.id, g.name, g.village, g.join_code, g.members_json, g.updated_at, m.role
       FROM memberships m JOIN groups g ON g.id = m.group_id WHERE m.user_id = ? ORDER BY g.updated_at DESC`,
    ).all(user.id) as Array<{ id: string; name: string; village: string; join_code: string; members_json: string; updated_at: string; role: string }>;
    const groups = await Promise.all(rows.map(async (g) => {
      const ledger = ledgerOf(c.db, g.id);
      const b = computeBalances(ledger);
      const lastMeeting = [...ledger].reverse().find((e) => e.type === 'meeting_close' || e.type === 'meeting_open');
      return {
        id: g.id, name: g.name, village: g.village, role: g.role,
        joinCode: g.role === 'owner' ? g.join_code : undefined,
        members: JSON.parse(g.members_json).length,
        entries: ledger.length,
        lastSeq: ledger.at(-1)?.seq ?? 0,
        cash: b.groupCash, savings: b.totalSavings, outstanding: b.totalOutstanding,
        lastMeeting: lastMeeting?.ts ?? null,
        chainOk: (await verifyChain(ledger)).ok,
        updatedAt: g.updated_at,
      };
    }));
    send(c.res, 200, { groups });
  }],

  ['POST', /^\/api\/groups$/, async (c) => {
    const user = needUser(c);
    const name = typeof c.body.name === 'string' ? c.body.name.trim().slice(0, 100) : '';
    if (!name) throw new HttpError(400, 'bad_name');
    const village = typeof c.body.village === 'string' ? c.body.village.trim().slice(0, 100) : '';
    const members = cleanMembers(c.body.members ?? []);
    const entries = await checkContinuation([], c.body.entries ?? []);
    const id = typeof c.body.id === 'string' && /^[\w-]{4,40}$/.test(c.body.id) ? c.body.id : newId('g');
    if (c.db.prepare('SELECT 1 FROM groups WHERE id = ?').get(id)) throw new HttpError(409, 'group_exists');
    const now = new Date().toISOString();
    let code = newJoinCode();
    while (c.db.prepare('SELECT 1 FROM groups WHERE join_code = ?').get(code)) code = newJoinCode();
    tx(c.db, () => {
      c.db.prepare('INSERT INTO groups (id, name, village, owner_id, join_code, members_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, village, user.id, code, JSON.stringify(members), now, now);
      c.db.prepare('INSERT INTO memberships (user_id, group_id, role) VALUES (?, ?, ?)').run(user.id, id, 'owner');
      insertEntries(c.db, id, entries);
    });
    send(c.res, 201, { id, joinCode: code, lastSeq: entries.at(-1)?.seq ?? 0 });
  }],

  ['POST', /^\/api\/groups\/join$/, (c) => {
    const user = needUser(c);
    const code = typeof c.body.code === 'string' ? c.body.code.trim().toUpperCase() : '';
    const g = c.db.prepare('SELECT id, name FROM groups WHERE join_code = ?').get(code) as { id: string; name: string } | undefined;
    if (!g) throw new HttpError(404, 'bad_code');
    if (!roleIn(c.db, user.id, g.id)) {
      c.db.prepare('INSERT INTO memberships (user_id, group_id, role) VALUES (?, ?, ?)').run(user.id, g.id, 'viewer');
    }
    send(c.res, 200, { id: g.id, name: g.name, role: roleIn(c.db, user.id, g.id) });
  }],

  ['GET', /^\/api\/groups\/([\w-]+)$/, (c) => {
    const user = needUser(c);
    const [id] = c.params;
    const role = roleIn(c.db, user.id, id);
    if (!role) throw new HttpError(404, 'not_found');
    const g = c.db.prepare('SELECT id, name, village, join_code, members_json FROM groups WHERE id = ?').get(id) as
      { id: string; name: string; village: string; join_code: string; members_json: string };
    send(c.res, 200, {
      group: { id: g.id, name: g.name, nameLocal: g.name, village: g.village, members: JSON.parse(g.members_json) },
      role, joinCode: role === 'owner' ? g.join_code : undefined,
      entries: ledgerOf(c.db, id),
    });
  }],

  ['POST', /^\/api\/groups\/([\w-]+)\/sync$/, async (c) => {
    const user = needUser(c);
    const [id] = c.params;
    const role = roleIn(c.db, user.id, id);
    if (!role) throw new HttpError(404, 'not_found');
    if (role !== 'owner') throw new HttpError(403, 'read_only');
    const existing = ledgerOf(c.db, id);
    const serverSeq = existing.at(-1)?.seq ?? 0;
    if (c.body.baseSeq !== serverSeq) {
      send(c.res, 409, { error: 'out_of_date', lastSeq: serverSeq });
      return;
    }
    const entries = await checkContinuation(existing, c.body.entries ?? []);
    const members = c.body.members === undefined ? null : cleanMembers(c.body.members);
    tx(c.db, () => {
      insertEntries(c.db, id, entries);
      if (members) c.db.prepare('UPDATE groups SET members_json = ? WHERE id = ?').run(JSON.stringify(members), id);
      c.db.prepare('UPDATE groups SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    });
    send(c.res, 200, { lastSeq: entries.at(-1)?.seq ?? serverSeq });
  }],
];

// ---------- Static site (the built app) ----------

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain',
};

function serveStatic(res: ServerResponse, distDir: string, urlPath: string) {
  const root = resolve(distDir);
  let file = normalize(join(root, decodeURIComponent(urlPath)));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html'); // single-page app
  if (!existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bolta Khata API is running. Build the app with `npm run build`.');
    return;
  }
  const immutable = urlPath.startsWith('/assets/');
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Permissions-Policy': 'microphone=(self)',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(readFileSync(file));
}

export function createHandler(db: DB, distDir = 'dist') {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      serveStatic(res, distDir, url.pathname);
      return;
    }
    try {
      for (const [method, pattern, handler] of routes) {
        const m = pattern.exec(url.pathname);
        if (!m || method !== req.method) continue;
        const body = await readBody(req);
        await handler({ req, res, db, user: currentUser(db, req), body, params: m.slice(1) });
        return;
      }
      send(res, 404, { error: 'not_found' });
    } catch (e) {
      if (e instanceof HttpError) send(res, e.status, { error: e.code });
      else {
        console.error(e);
        send(res, 500, { error: 'server_error' });
      }
    }
  };
}

