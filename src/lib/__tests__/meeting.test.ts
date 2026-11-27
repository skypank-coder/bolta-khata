import { describe, expect, it } from 'vitest';
import { appendEntries, computeBalances, memberBalance, verifyChain, type LedgerEntry } from '../ledger';
import { initialState, step, type MeetingState, type Reply } from '../meeting';
import { buildDemoData } from '../store';

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
    const over = await m.say('Kamla ki kist 1500');
    expect(over).toMatchObject({ key: 'readback', warn: 'overpay', stage: 1 });
    expect(await m.say('sahi')).toMatchObject({ key: 'readback', stage: 2 });
    expect((await m.say('sahi')).key).toBe('saved');
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
    'मेरा कितना जमा है?': 'querySelf', 'पिछली एंट्री हटाओ': 'undo', 'मीटिंग बंद करो': 'end',
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
