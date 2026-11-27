import { describe, expect, it } from 'vitest';
import { appendEntries, computeBalances, memberBalance, verifyChain, type LedgerEntry } from '../ledger';
import { initialState, step, type MeetingState, type Reply } from '../meeting';
import { buildDemoData, DEMO_GROUP } from '../store';

const DEMO_GROUP_MEMBERS = DEMO_GROUP.members;

/** Drive a whole meeting the way the app does: hear -> step -> append drafts. */
async function meeting() {
  const data = await buildDemoData();
  let ledger: LedgerEntry[] = data.ledger;
  let state: MeetingState = initialState;
  const replies: Reply[] = [];
  const say = async (text: string, extra: { confidence?: number; alternatives?: string[] } = {}) => {
    const r = step(state, { text, ...extra }, { members: data.group.members, ledger });
    state = r.state;
    ledger = await appendEntries(ledger, r.drafts);
    replies.push(r.reply);
    return r.reply;
  };
  return { say, get state() { return state; }, get ledger() { return ledger; }, members: data.group.members, replies };
}

describe('voice meeting, end to end', () => {
  it('runs attendance, entries with read-back, a loan, and close', async () => {
    const m = await meeting();
    expect((await m.say('Durga samooh ki meeting shuru karo')).key).toBe('started');
    expect(await m.say('Main Meena hoon')).toEqual({ key: 'present', member: 'm01' });
    expect(await m.say('राधा')).toEqual({ key: 'present', member: 'm06' });
    expect((await m.say('Rekha haazir')).key).toBe('present');
    const done = await m.say('haazri poori');
    expect(done).toMatchObject({ key: 'attendanceDone', presentCount: 3 });

    const rb = await m.say('Main Meena, 100 rupaye bachat');
    expect(rb).toMatchObject({ key: 'readback', drafts: [{ type: 'savings', memberId: 'm01', amount: 100 }] });
    expect((await m.say('sahi hai')).key).toBe('saved');

    const rk = await m.say('Rekha ki kist paanch sau aur bachat sau');
    expect(rk).toMatchObject({ key: 'readback', after: { m04: 1000 } });
    expect((await m.say('हाँ सही है')).key).toBe('saved');

    const loan = await m.say('Radha ko dedh hazaar loan');
    expect(loan).toMatchObject({ key: 'loanAsk', draft: { amount: 1500 } });
    expect((await m.say('haan')).key).toBe('loanWaiting');
    expect((await m.say('manzoor')).key).toBe('loanSaved');

    const b = memberBalance(computeBalances(m.ledger), 'm04');
    expect(b.loanOutstanding).toBe(1000);

    const sum = await m.say('meeting band karo');
    expect(sum).toMatchObject({ key: 'summary', savings: 200, repayments: 500, loans: 1500, presentCount: 3 });
    expect((await m.say('sahi hai')).key).toBe('closed');
    expect((await verifyChain(m.ledger)).ok).toBe(true);
  });

  it('rejects and corrects without editing history', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    await m.say('Geeta 200 bachat');
    expect((await m.say('galat hai')).key).toBe('rejected');
    const fixed = await m.say('galat, Geeta 300 bachat');
    expect(fixed).toMatchObject({ key: 'readback', drafts: [{ amount: 300 }] });
    await m.say('sahi');
    expect((await m.say('pichli entry hatao')).key).toBe('undone');
    expect(memberBalance(computeBalances(m.ledger), 'm07').savings).toBe(2700);
    expect(m.ledger.filter((e) => e.type === 'reversal')).toHaveLength(1);
  });

  it('asks which Sunita when two members share a name', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    expect(await m.say('Sunita 100 bachat')).toEqual({ key: 'pick', options: expect.arrayContaining(['m02', 'm03']) });
    expect(await m.say('Yadav')).toMatchObject({ key: 'readback', drafts: [{ memberId: 'm03', amount: 100 }] });
  });

  it('asks for what is missing', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    await m.say('haazri poori');
    expect(await m.say('Farida 500')).toEqual({ key: 'needType', member: 'm09', amount: 500 });
    expect((await m.say('bachat')).key).toBe('readback');
    await m.say('sahi');
    expect(await m.say('Kamla ki kist')).toEqual({ key: 'needAmount', member: 'm08', type: 'repayment' });
    expect(await m.say('do sau')).toMatchObject({ key: 'readback', drafts: [{ amount: 200, type: 'repayment' }] });
    expect((await m.say('300 bachat')).key).toBe('needMember');
  });

  it('guards money: no loan to repay, overpayment twice, not enough cash', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    expect((await m.say('Anjali 200 kist')).key).toBe('noLoanToRepay');
    // Kamla owes 1000 and pays 1500: loan closes, 500 goes to her savings.
    const over = await m.say('Kamla ki kist 1500');
    expect(over).toMatchObject({
      key: 'readback', warn: 'overpay', after: { m08: 0 },
      drafts: [{ type: 'repayment', amount: 1000 }, { type: 'savings', amount: 500 }],
    });
    expect((await m.say('sahi')).key).toBe('saved');
    expect(memberBalance(computeBalances(m.ledger), 'm08')).toMatchObject({ loanOutstanding: 0, savings: 3000 });
    expect((await m.say('Parvati ko ek lakh loan')).key).toBe('loanNoCash');
  });

  it('answers balance questions by voice', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    expect(await m.say('Meena ki kitni bachat hai')).toEqual({ key: 'selfBalance', member: 'm01', savings: 3100, loan: 0 });
    expect((await m.say('group ke paas kitna paisa hai')).key).toBe('groupBalance');
    expect(await m.say('Main Radha')).toMatchObject({ key: 'present', member: 'm06' });
    expect(await m.say('mera kitna jama hai')).toMatchObject({ key: 'selfBalance', member: 'm06', savings: 3000, loan: 3000 });
  });

  it('handles silence and noise, then recovers with alternatives', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    expect(await m.say('')).toEqual({ key: 'notHeard', repeated: false });
    expect(await m.say('', {})).toEqual({ key: 'notHeard', repeated: true });
    expect(await m.say('mmm', { alternatives: ['Meena 100 bachat'] })).toMatchObject({ key: 'readback' });
  });

  it('will not record money before the meeting starts', async () => {
    const m = await meeting();
    expect((await m.say('Meena 100 bachat')).key).toBe('notStarted');
    expect(m.state.phase).toBe('idle');
  });
});

describe('examples shown on screen are understood', async () => {
  const { EXAMPLES } = await import('../phrases');
  const { parseIntent } = await import('../intent');
  const { DEMO_GROUP } = await import('../store');
  const expected: Record<string, string> = {
    'मीटिंग शुरू करो': 'start', 'मैं मीना हूँ': 'name', 'राधा हाज़िर': 'name', 'सुनीता यादव': 'name', 'हाज़िरी पूरी': 'attendanceDone',
    'मैं मीना, सौ रुपये बचत': 'entry', 'रेखा की किस्त पाँच सौ': 'entry', 'राधा को डेढ़ हज़ार लोन': 'entry',
    'मेरा कितना जमा है?': 'querySelf', 'पिछली एंट्री हटाओ': 'undo', 'मीटिंग बंद करो': 'end', 'हाथ में बीस हज़ार है': 'cashCount',
    'मीटिंग सुरू करा': 'start', 'मी मीना': 'name', 'राधा हजर': 'name', 'हजेरी पूर्ण': 'attendanceDone',
    'मी मीना, शंभर रुपये बचत': 'entry', 'रेखा हप्ता पाचशे': 'entry', 'राधाला दीड हजार कर्ज': 'entry',
    'माझी किती बचत आहे?': 'querySelf', 'मीटिंग बंद करा': 'end',
    'Start the meeting': 'start', 'I am Meena': 'name', 'Radha present': 'name', 'Attendance done': 'attendanceDone',
    'Meena, 100 rupees savings': 'entry', 'Rekha repayment 500': 'entry', 'Radha loan 1500': 'entry',
    'How much have I saved?': 'querySelf', 'Undo': 'undo', 'End the meeting': 'end',
  };
  for (const lang of ['hi', 'mr', 'en'] as const) {
    for (const list of Object.values(EXAMPLES[lang])) {
      for (const ex of list) {
        it(`${lang}: ${ex}`, () => {
          const intent = parseIntent(ex, DEMO_GROUP.members);
          expect(intent.kind).toBe(expected[ex]);
          if (ex === 'सुनीता यादव' && intent.kind === 'name') expect(intent.member.best?.memberId).toBe('m03');
          if (ex === 'राधाला दीड हजार कर्ज' && intent.kind === 'entry') {
            expect(intent.member.best?.memberId).toBe('m06');
            expect(intent.items).toEqual([{ type: 'loan', amount: 1500 }]);
          }
        });
      }
    }
  }
});

describe('same meeting in Marathi and in English', () => {
  it('runs a Marathi meeting in Devanagari', async () => {
    const m = await meeting();
    expect((await m.say('मीटिंग सुरू करा')).key).toBe('started');
    expect(await m.say('मी मीना')).toEqual({ key: 'present', member: 'm01' });
    expect(await m.say('राधा हजर')).toEqual({ key: 'present', member: 'm06' });
    expect((await m.say('हजेरी पूर्ण')).key).toBe('attendanceDone');
    expect(await m.say('मी मीना, शंभर रुपये बचत')).toMatchObject({ key: 'readback', drafts: [{ amount: 100, type: 'savings' }] });
    expect((await m.say('बरोबर')).key).toBe('saved');
    expect(await m.say('रेखा हप्ता पाचशे')).toMatchObject({ key: 'readback', drafts: [{ amount: 500, type: 'repayment' }] });
    expect((await m.say('हो')).key).toBe('saved');
    expect(await m.say('राधाला दीड हजार कर्ज')).toMatchObject({ key: 'loanAsk', draft: { amount: 1500, memberId: 'm06' } });
    expect((await m.say('मंजूर')).key).toBe('loanSaved');
    expect((await m.say('मीटिंग बंद करा')).key).toBe('summary');
    expect((await m.say('बरोबर')).key).toBe('closed');
  });

  it('runs an English meeting', async () => {
    const m = await meeting();
    expect((await m.say('Start the meeting')).key).toBe('started');
    expect((await m.say('I am Meena')).key).toBe('present');
    expect((await m.say('Attendance done')).key).toBe('attendanceDone');
    expect(await m.say('Meena, five hundred rupees savings')).toMatchObject({ key: 'readback', drafts: [{ amount: 500 }] });
    expect((await m.say('yes')).key).toBe('saved');
    expect((await m.say('Undo')).key).toBe('undone');
    expect((await m.say('End the meeting')).key).toBe('summary');
    expect((await m.say('no')).key).toBe('stillOpen');
  });

  it('a repeated question gets the same answer', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    const first = await m.say('Geeta 200 bachat');
    expect(await m.say('phir se bolo')).toEqual(first);
  });

  it('a large amount is read back twice', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    expect(await m.say('Meena 12000 bachat')).toMatchObject({ key: 'readback', warn: 'large', stage: 1 });
    expect(await m.say('haan')).toMatchObject({ key: 'readback', stage: 2 });
    expect((await m.say('haan')).key).toBe('saved');
  });

  it('cancelling a loan puts the cash back', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    const before = computeBalances(m.ledger).groupCash;
    await m.say('Anjali ko 1000 loan');
    await m.say('manzoor');
    expect(computeBalances(m.ledger).groupCash).toBe(before - 1000);
    await m.say('pichli entry hatao');
    expect(computeBalances(m.ledger).groupCash).toBe(before);
  });
});

describe('a meeting does not get stuck', () => {
  it('moves on when someone speaks instead of approving a loan', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    expect((await m.say('Farida ko 200 loan')).key).toBe('loanAsk');
    expect((await m.say('xyz')).key).toBe('loanWaiting');
    expect((await m.say('Rekha 500 bachat')).key).toBe('readback');
    expect(m.ledger.some((e) => e.type === 'loan' && e.memberId === 'm09' && e.meetingId !== 'history')).toBe(false);
  });

  it('answers a balance question while a confirmation waits', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    await m.say('Geeta 200 bachat');
    expect(await m.say('Meena ki kitni bachat hai')).toMatchObject({ key: 'selfBalance', member: 'm01' });
    expect((await m.say('sahi hai')).key).toBe('saved');
  });
});

describe('counting the cash box by voice', () => {
  it('compares the count with the khata and records it in the chain', async () => {
    const m = await meeting();
    await m.say('meeting shuru karo');
    const expected = computeBalances(m.ledger).groupCash;
    expect(await m.say('meeting band karo')).toMatchObject({ key: 'summary' });
    expect(await m.say(`haath mein ${expected - 100} hai`)).toEqual({ key: 'cashCount', counted: expected - 100, expected });
    expect(m.ledger.at(-1)).toMatchObject({ type: 'cash_count', amount: expected - 100, note: String(expected) });
    expect(computeBalances(m.ledger).groupCash).toBe(expected);
    // Still waiting to close after the count.
    expect((await m.say('sahi hai')).key).toBe('closed');
    expect((await verifyChain(m.ledger)).ok).toBe(true);
  });

  it('understands the count in Devanagari Hindi and Marathi', async () => {
    const { parseIntent } = await import('../intent');
    expect(parseIntent('हाथ में बीस हज़ार एक सौ है', DEMO_GROUP_MEMBERS)).toEqual({ kind: 'cashCount', amount: 20100 });
    expect(parseIntent('रोख वीस हजार', DEMO_GROUP_MEMBERS)).toEqual({ kind: 'cashCount', amount: 20000 });
    expect(parseIntent('nakad gina 19500', DEMO_GROUP_MEMBERS)).toEqual({ kind: 'cashCount', amount: 19500 });
    expect(parseIntent('Meena 500 bachat', DEMO_GROUP_MEMBERS).kind).toBe('entry');
  });
});

describe('understood-as highlighting', () => {
  it('marks the name, amounts and types in the speaker\'s own words', async () => {
    const { annotate } = await import('../intent');
    const marks = (t: string) => annotate(t, DEMO_GROUP_MEMBERS).filter((p) => p.word.trim()).map((p) => `${p.word}:${p.mark}`);
    expect(marks('मैं मीना, सौ रुपये बचत, पाँच सौ किस्त')).toEqual([
      'मैं:null', 'मीना,:name', 'सौ:amount', 'रुपये:null', 'बचत,:savings', 'पाँच:amount', 'सौ:amount', 'किस्त:repayment',
    ]);
    expect(marks('Radha ko dedh hazaar loan')).toEqual(['Radha:name', 'ko:null', 'dedh:amount', 'hazaar:amount', 'loan:loan']);
    expect(marks('हाँ सही है')).toEqual(['हाँ:yes', 'सही:yes', 'है:null']);
  });
});
