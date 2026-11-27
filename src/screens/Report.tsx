import { useMemo, useState } from 'react';
import { computeBalances, memberBalance, meetingTotals, reversedIds } from '../lib/ledger';
import { formatRupees } from '../lib/numbers';
import { SPEECH_LANG } from '../lib/phrases';
import { speak } from '../lib/speech';
import type { AppData, Lang, Member } from '../lib/store';
import { UI } from '../lib/ui';
import type { useBoltaKhata } from '../useBoltaKhata';

type App = ReturnType<typeof useBoltaKhata>;

interface Row {
  member: Member;
  present: boolean;
  savingsToday: number;
  repayToday: number;
  loanToday: number;
  totalSavings: number;
  loanLeft: number;
}

function buildRows(data: AppData, meetingId: string): { rows: Row[]; lastSeq: number; lastHash: string } {
  const t = meetingTotals(data.ledger, meetingId);
  const reversed = reversedIds(data.ledger);
  const meetingEntries = t.entries.filter((e) => !reversed.has(e.id));
  const lastSeq = Math.max(...t.entries.map((e) => e.seq));
  // Balances as they stood at the end of this meeting.
  const balances = computeBalances(data.ledger, lastSeq);
  const sum = (id: string, type: string) =>
    meetingEntries.filter((e) => e.memberId === id && e.type === type).reduce((s, e) => s + e.amount, 0);
  const rows = data.group.members.map((m) => {
    const b = memberBalance(balances, m.id);
    return {
      member: m,
      present: t.present.includes(m.id),
      savingsToday: sum(m.id, 'savings'),
      repayToday: sum(m.id, 'repayment'),
      loanToday: sum(m.id, 'loan'),
      totalSavings: b.savings,
      loanLeft: b.loanOutstanding,
    };
  });
  const last = data.ledger.find((e) => e.seq === lastSeq)!;
  return { rows, lastSeq, lastHash: last.hash };
}

function receiptText(lang: Lang, data: AppData, r: Row, date: string, lock: string): string {
  const name = lang === 'en' ? r.member.name : r.member.nameLocal ?? r.member.name;
  const group = lang === 'en' ? data.group.name : data.group.nameLocal;
  const m = formatRupees;
  if (lang === 'en') {
    return `Bolta Khata receipt\n${group}, ${date}\n${name}: savings ${m(r.savingsToday)}, repayment ${m(r.repayToday)}${r.loanToday ? `, loan taken ${m(r.loanToday)}` : ''}.\nTotal savings ${m(r.totalSavings)}. Loan left ${m(r.loanLeft)}.\nLedger lock ${lock}`;
  }
  if (lang === 'mr') {
    return `बोलता खाता पावती\n${group}, ${date}\n${name}: बचत ${m(r.savingsToday)}, हप्ता ${m(r.repayToday)}${r.loanToday ? `, कर्ज घेतलं ${m(r.loanToday)}` : ''}.\nएकूण बचत ${m(r.totalSavings)}. बाकी कर्ज ${m(r.loanLeft)}.\nखाते कुलूप ${lock}`;
  }
  return `बोलता खाता रसीद\n${group}, ${date}\n${name}: बचत ${m(r.savingsToday)}, किस्त ${m(r.repayToday)}${r.loanToday ? `, लोन लिया ${m(r.loanToday)}` : ''}।\nकुल बचत ${m(r.totalSavings)}। बाकी लोन ${m(r.loanLeft)}।\nखाता ताला ${lock}`;
}

function spokenReceipt(lang: Lang, r: Row): string {
  const name = lang === 'en' ? r.member.name : r.member.nameLocal ?? r.member.name;
  const rs = (n: number) => (lang === 'en' ? `${n} rupees` : `${n} रुपये`);
  if (lang === 'en') return `${name}. Today: savings ${rs(r.savingsToday)}, repayment ${rs(r.repayToday)}. Total savings ${rs(r.totalSavings)}. Loan left ${rs(r.loanLeft)}.`;
  if (lang === 'mr') return `${name}. आज बचत ${rs(r.savingsToday)}, हप्ता ${rs(r.repayToday)}. एकूण बचत ${rs(r.totalSavings)}. बाकी कर्ज ${rs(r.loanLeft)}.`;
  return `${name}। आज बचत ${rs(r.savingsToday)}, किस्त ${rs(r.repayToday)}। कुल बचत ${rs(r.totalSavings)}। बाकी लोन ${rs(r.loanLeft)}।`;
}

function downloadCsv(data: AppData, rows: Row[], date: string) {
  const head = ['Member', 'Name (local)', 'Present', 'Savings today', 'Repayment today', 'Loan given today', 'Total savings', 'Loan outstanding'];
  const body = rows.map((r) => [
    r.member.name, r.member.nameLocal ?? '', r.present ? 'Yes' : 'No',
    r.savingsToday, r.repayToday, r.loanToday, r.totalSavings, r.loanLeft,
  ]);
  const total = (k: keyof Row) => rows.reduce((s, r) => s + (r[k] as number), 0);
  body.push(['Total', '', String(rows.filter((r) => r.present).length), total('savingsToday'), total('repayToday'), total('loanToday'), total('totalSavings'), total('loanLeft')]);
  const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '﻿' + [[`${data.group.name}, ${data.group.village}, ${date}`], head, ...body].map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `bolta-khata-${date.replace(/\W+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Report({ app }: { app: App }) {
  const { data, lang, chain } = app;
  const t = UI[lang];
  const r = t.report;
  const meetingIds = useMemo(
    () => (data ? [...new Set(data.ledger.filter((e) => e.type === 'meeting_open').map((e) => e.meetingId!))].reverse() : []),
    [data],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const meetingId = chosen ?? meetingIds[0] ?? null;
  const built = useMemo(() => (data && meetingId ? buildRows(data, meetingId) : null), [data, meetingId]);

  if (!data) return null;
  if (!meetingId || !built) {
    return <p className="mx-auto max-w-3xl px-4 pt-10 font-display text-2xl text-patra">{r.none}</p>;
  }

  const opened = data.ledger.find((e) => e.meetingId === meetingId && e.type === 'meeting_open')!;
  const dateOf = (id: string) => {
    const e = data.ledger.find((x) => x.meetingId === id && x.type === 'meeting_open')!;
    return new Date(e.ts).toLocaleString(lang === 'en' ? 'en-IN' : 'hi-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };
  const date = dateOf(meetingId);
  const { rows, lastHash } = built;
  const lock = lastHash.slice(0, 10);
  const totals = meetingTotals(data.ledger, meetingId);
  const cash = computeBalances(data.ledger, built.lastSeq).groupCash;
  const name = (m: Member) => (lang === 'en' ? m.name : m.nameLocal ?? m.name);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-16 pt-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        {meetingIds.length > 1 && (
          <label className="flex items-center gap-2 text-patra">
            {r.pick}
            <select
              value={meetingId}
              onChange={(e) => setChosen(e.target.value)}
              className="rounded-lg bg-patra px-3 py-2 text-neel"
            >
              {meetingIds.map((id) => <option key={id} value={id}>{dateOf(id)}</option>)}
            </select>
          </label>
        )}
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-haldi px-4 py-2.5 font-semibold text-bahi-dark">{r.print}</button>
        <button type="button" onClick={() => downloadCsv(data, rows, date)} className="rounded-lg px-4 py-2.5 font-semibold text-patra ring-1 ring-patra/40">{r.csv}</button>
      </div>

      <article className="ledger-paper rounded-lg p-5 pl-16 shadow-lg print:shadow-none">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-bahi/30 pb-3">
          <div>
            <h1 className="font-display text-3xl text-bahi">{r.title}</h1>
            <p className="text-lg">{lang === 'en' ? data.group.name : data.group.nameLocal}, {data.group.village}</p>
            <p className="text-neel-soft">{date}. {r.bankNote}</p>
          </div>
          <p className={`rounded-md border-2 px-2 py-1 text-sm ${chain.ok ? 'border-mohar text-mohar' : 'border-bahi text-bahi'}`}>
            {chain.ok ? r.chainOk : r.chainBad}: {lock}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
          {[
            [r.presentOf(totals.present.length, data.group.members.length), null],
            [r.collected, totals.savings],
            [r.repaid, totals.repayments],
            [r.lent, totals.loans],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-neel-soft">{label}</dt>
              {value !== null && <dd className="font-display text-2xl num">{formatRupees(value as number)}</dd>}
            </div>
          ))}
        </dl>
        <p className="pb-3 text-lg">{r.cashNow}: <strong className="font-display text-2xl num">{formatRupees(cash)}</strong></p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-neel/30 text-neel-soft">
                {Object.values(r.cols).map((c) => <th key={c} className="py-2 pr-3 font-semibold">{c}</th>)}
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((row) => (
                <tr key={row.member.id} className="h-11 border-b border-neel/10">
                  <td className="pr-3 font-semibold">{name(row.member)}</td>
                  <td className="pr-3">{row.present ? r.yes : r.no}</td>
                  <td className="pr-3">{row.savingsToday ? formatRupees(row.savingsToday) : '—'}</td>
                  <td className="pr-3">{row.repayToday ? formatRupees(row.repayToday) : '—'}</td>
                  <td className="pr-3">{row.loanToday ? formatRupees(row.loanToday) : '—'}</td>
                  <td className="pr-3">{formatRupees(row.totalSavings)}</td>
                  <td className="pr-3">{formatRupees(row.loanLeft)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="print-only pt-6 text-sm">Bolta Khata, {opened.meetingId}. Ledger lock {lastHash}</p>
      </article>

      <section className="no-print">
        <h2 className="font-display text-2xl text-patra">{r.receipts}</h2>
        <p className="mb-3 text-patra/80">{r.receiptsHint}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.filter((row) => row.present || row.savingsToday || row.repayToday || row.loanToday).map((row) => (
            <li key={row.member.id} className="flex items-center justify-between gap-2 rounded-lg bg-patra px-3 py-2 text-neel">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{name(row.member)}</span>
                <span className="text-sm text-neel-soft num">
                  +{formatRupees(row.savingsToday + row.repayToday)}{row.loanToday ? `, −${formatRupees(row.loanToday)}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => speak(spokenReceipt(lang, row), SPEECH_LANG[lang])}
                  className="rounded-md bg-neel px-3 py-1.5 text-patra"
                >
                  {r.play}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(receiptText(lang, data, row, date, lock))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-mohar px-3 py-1.5 text-patra"
                >
                  {r.whatsapp}
                </a>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
