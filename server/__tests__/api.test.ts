import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appendEntries } from '../../src/lib/ledger';
import { buildDemoData } from '../../src/lib/store';
import { createHandler, sweepGuests } from '../app';
import { normalisePhone } from '../auth';
import { openDb } from '../db';

let server: Server;
let base = '';
const db = openDb(':memory:');

beforeAll(async () => {
  server = createServer(createHandler(db, 'does-not-exist'));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

/** A tiny client that keeps its own session cookie, like one phone. */
function phone() {
  let cookie = '';
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, json: await res.json().catch(() => null) as any, setCookie: set };
  };
}

describe('accounts', () => {
  it('normalises Indian mobile numbers', () => {
    expect(normalisePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalisePhone('09876543210')).toBe('9876543210');
    expect(normalisePhone('12345')).toBeNull();
    expect(normalisePhone('5876543210')).toBeNull();
  });

  it('signs up with mobile + PIN, keeps the PIN out of every response, and logs in again', async () => {
    const a = phone();
    const s = await a('POST', '/api/auth/signup', { phone: '9876500001', name: 'Meena Devi', pin: '4321' });
    expect(s.status).toBe(201);
    expect(s.setCookie).toMatch(/HttpOnly/);
    expect(JSON.stringify(s.json)).not.toContain('4321');
    expect((await a('GET', '/api/me')).json.user.name).toBe('Meena Devi');
    expect((await a('POST', '/api/auth/signup', { phone: '9876500001', name: 'X', pin: '1111' })).status).toBe(409);
    await a('POST', '/api/auth/logout');
    expect((await a('GET', '/api/me')).status).toBe(401);
    expect((await a('POST', '/api/auth/login', { phone: '+91 98765 00001', pin: '4321' })).status).toBe(200);
  });

  it('rejects bad input and locks a number after five wrong PINs', async () => {
    const a = phone();
    expect((await a('POST', '/api/auth/signup', { phone: '123', name: 'A', pin: '1234' })).status).toBe(400);
    expect((await a('POST', '/api/auth/signup', { phone: '9876500002', name: 'A', pin: '12' })).status).toBe(400);
    await a('POST', '/api/auth/signup', { phone: '9876500003', name: 'Rekha', pin: '2468' });
    const b = phone();
    for (let i = 0; i < 5; i++) expect((await b('POST', '/api/auth/login', { phone: '9876500003', pin: '0000' })).status).toBe(401);
    expect((await b('POST', '/api/auth/login', { phone: '9876500003', pin: '2468' })).status).toBe(429);
  });

  it('refuses group data without a login', async () => {
    expect((await phone()('GET', '/api/groups')).status).toBe(401);
  });
});

describe('groups and the hash-chained ledger', () => {
  it('creates a group, syncs new entries, and shows live figures', async () => {
    const leader = phone();
    await leader('POST', '/api/auth/signup', { phone: '9876500010', name: 'Meena', pin: '1357' });
    const demo = await buildDemoData();
    const created = await leader('POST', '/api/groups', {
      name: demo.group.name, village: demo.group.village, members: demo.group.members, entries: demo.ledger,
    });
    expect(created.status).toBe(201);
    expect(created.json.joinCode).toMatch(/^[A-Z2-9]{6}$/);
    const id = created.json.id;

    const more = await appendEntries(demo.ledger, [
      { type: 'meeting_open', memberId: null, amount: 0, meetingId: 'm1' },
      { type: 'savings', memberId: 'm01', amount: 200, meetingId: 'm1' },
    ]);
    const sync = await leader('POST', `/api/groups/${id}/sync`, {
      baseSeq: demo.ledger.at(-1)!.seq, members: demo.group.members, entries: more.slice(demo.ledger.length),
    });
    expect(sync.status).toBe(200);
    expect(sync.json.lastSeq).toBe(more.at(-1)!.seq);

    const list = await leader('GET', '/api/groups');
    expect(list.json.groups[0]).toMatchObject({ id, role: 'owner', members: 12, cash: 20700, chainOk: true });
    const full = await leader('GET', `/api/groups/${id}`);
    expect(full.json.entries).toHaveLength(more.length);
  });

  it('refuses a tampered entry, a stale copy, and writes from a read-only follower', async () => {
    const leader = phone();
    await leader('POST', '/api/auth/signup', { phone: '9876500020', name: 'Leader', pin: '1111' });
    const demo = await buildDemoData();
    const { json } = await leader('POST', '/api/groups', { name: 'G', village: 'V', members: demo.group.members, entries: demo.ledger });
    const last = demo.ledger.at(-1)!.seq;

    const next = await appendEntries(demo.ledger, [{ type: 'savings', memberId: 'm01', amount: 100, meetingId: 'x' }]);
    const tampered = { ...next.at(-1)!, amount: 99999 };
    expect((await leader('POST', `/api/groups/${json.id}/sync`, { baseSeq: last, entries: [tampered] })).json.error).toBe('chain_broken');
    expect((await leader('POST', `/api/groups/${json.id}/sync`, { baseSeq: last - 1, entries: [] })).status).toBe(409);

    // A worker from the NGO follows the group with its code: can read, cannot write.
    const worker = phone();
    await worker('POST', '/api/auth/signup', { phone: '9876500021', name: 'CRP', pin: '2222' });
    expect((await worker('GET', `/api/groups/${json.id}`)).status).toBe(404);
    expect((await worker('POST', '/api/groups/join', { code: json.joinCode })).json.role).toBe('viewer');
    expect((await worker('GET', `/api/groups/${json.id}`)).json.role).toBe('viewer');
    expect((await worker('GET', '/api/groups')).json.groups[0].joinCode).toBeUndefined();
    expect((await worker('POST', `/api/groups/${json.id}/sync`, { baseSeq: last, entries: next.slice(-1) })).status).toBe(403);
    expect((await worker('POST', '/api/groups/join', { code: 'NOPE12' })).status).toBe(404);
  });

  it('serves a clear message when the app has not been built', async () => {
    const res = await fetch(base + '/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('API is running');
  });
});

describe('one-click guest trial', () => {
  it('creates a working account with no number, can own a group, and can be claimed later', async () => {
    const g = phone();
    const r = await g('POST', '/api/auth/guest', { name: 'अतिथि दीदी' });
    expect(r.status).toBe(201);
    expect(r.json.user).toMatchObject({ name: 'अतिथि दीदी', guest: true, phone: '' });
    const demo = await buildDemoData();
    expect((await g('POST', '/api/groups', { name: 'Trial', village: '', members: demo.group.members, entries: demo.ledger })).status).toBe(201);
    expect((await g('POST', '/api/auth/claim', { phone: '9876500099', name: 'Sunita', pin: '9999' })).json.user).toMatchObject({ guest: false, phone: '9876500099' });
    expect((await g('GET', '/api/groups')).json.groups).toHaveLength(1);
    // The claimed account now logs in like any other.
    expect((await phone()('POST', '/api/auth/login', { phone: '9876500099', pin: '9999' })).status).toBe(200);
  });

  it('sweeps guest accounts older than three days, with their groups', async () => {
    const g = phone();
    await g('POST', '/api/auth/guest', {});
    const demo = await buildDemoData();
    await g('POST', '/api/groups', { name: 'Old trial', village: '', members: demo.group.members, entries: demo.ledger });
    expect(sweepGuests(db, Date.now() + 4 * 86400_000)).toBeGreaterThanOrEqual(1);
    expect((await g('GET', '/api/me')).status).toBe(401);
  });
});
