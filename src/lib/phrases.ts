import type { MoneyType } from './intent';
import type { Draft, Reply } from './meeting';
import { formatRupees } from './numbers';
import type { Lang, Member } from './store';

/**
 * Everything the app says out loud. Short sentences, one idea each, the way a
 * didi would read the register back to the group. Hindi and Marathi are written
 * in Devanagari so the phone's own Hindi/Marathi voice pronounces them properly.
 */

export const SPEECH_LANG: Record<Lang, string> = { hi: 'hi-IN', mr: 'mr-IN', en: 'en-IN' };

const TYPE: Record<Lang, Record<MoneyType, string>> = {
  hi: { savings: 'बचत', repayment: 'किस्त', loan: 'लोन' },
  mr: { savings: 'बचत', repayment: 'हप्ता', loan: 'कर्ज' },
  en: { savings: 'savings', repayment: 'repayment', loan: 'loan' },
};

export function typeLabel(t: MoneyType, lang: Lang): string {
  return TYPE[lang][t];
}

export interface Rendered {
  /** Text for the voice. */
  say: string;
  /** Text for the screen (₹ and Indian digit grouping). */
  show: string;
}

type Fmt = { money: (n: number) => string; name: (id: string) => string; list: (ids: string[]) => string };

function makeFmt(lang: Lang, members: Member[], forScreen: boolean): Fmt {
  const byId = new Map(members.map((m) => [m.id, m]));
  const name = (id: string) => {
    const m = byId.get(id);
    if (!m) return id;
    return lang === 'en' ? m.name : m.nameLocal || m.name;
  };
  const money = (n: number) => {
    if (forScreen) return formatRupees(n);
    return lang === 'en' ? `${Math.round(n)} rupees` : `${Math.round(n)} रुपये`;
  };
  const and = lang === 'en' ? ' and ' : lang === 'mr' ? ' आणि ' : ' और ';
  const list = (ids: string[]) => {
    const names = ids.map(name);
    if (names.length <= 1) return names.join('');
    return names.slice(0, -1).join(', ') + and + names[names.length - 1];
  };
  return { money, name, list };
}

function lines(drafts: Draft[], lang: Lang, f: Fmt): string {
  const byMember = new Map<string, Draft[]>();
  for (const d of drafts) byMember.set(d.memberId, [...(byMember.get(d.memberId) ?? []), d]);
  return [...byMember.entries()]
    .map(([id, ds]) => `${f.name(id)}: ${ds.map((d) => `${TYPE[lang][d.type]} ${f.money(d.amount)}`).join(', ')}`)
    .join('. ');
}

function hi(r: Reply, f: Fmt): string {
  switch (r.key) {
    case 'started': return 'मीटिंग शुरू। हाज़िरी के लिए सब अपना नाम बोलिए।';
    case 'notStarted': return 'पहले बोलिए: मीटिंग शुरू करो।';
    case 'present': return `${f.name(r.member)}, हाज़िर।`;
    case 'alreadyPresent': return `${f.name(r.member)} की हाज़िरी पहले से लगी है।`;
    case 'attendanceDone':
      return `${r.presentCount} लोग हाज़िर।${r.absent.length ? ` ${f.list(r.absent)} नहीं आईं।` : ' सब आ गईं।'} अब अपना नाम, बचत और किस्त बोलिए।`;
    case 'readback': {
      const after = Object.entries(r.after).filter(() => r.drafts.some((d) => d.type === 'repayment')).map(([id, v]) =>
        ` ${f.name(id)} का बाकी लोन ${f.money(Math.max(v, 0))}।`).join('');
      const loan = r.loanAfter ? ` फिर ${f.money(r.loanAfter.amount)} का लोन।` : '';
      if (r.stage === 2) return `ध्यान से सुनिए। ${lines(r.drafts, 'hi', f)}।${after} पक्का सही है?`;
      const warn = r.warn === 'overpay' ? ' किस्त बाकी लोन से ज़्यादा थी, इसलिए लोन पूरा चुका और बाकी पैसा बचत में गया।' : r.warn === 'large' ? ' रकम बड़ी है।' : '';
      return `${lines(r.drafts, 'hi', f)}।${after}${loan}${warn} सही है?`;
    }
    case 'saved': return 'लिख लिया।';
    case 'rejected': return 'ठीक है, नहीं लिखा। दोबारा बोलिए।';
    case 'loanAsk':
      return `${f.name(r.draft.memberId)} को ${f.money(r.draft.amount)} का लोन। ग्रुप के पास ${f.money(r.cash)} से ${f.money(r.cash - r.draft.amount)} बचेंगे। नेता जी, मंज़ूर?`;
    case 'loanNoCash': return `ग्रुप के पास सिर्फ़ ${f.money(r.cash)} हैं। इतना लोन नहीं दे सकते।`;
    case 'loanSaved': return `लोन मंज़ूर। ${f.name(r.draft.memberId)} को ${f.money(r.draft.amount)} लिख लिया।`;
    case 'loanWaiting': return 'लोन के लिए नेता जी बोलें: मंज़ूर। या बोलें: नहीं।';
    case 'noLoanToRepay': return `${f.name(r.member)} का कोई लोन बाकी नहीं है। क्या यह बचत है?`;
    case 'needMember': return 'किसका पैसा है? नाम बोलिए।';
    case 'pick': return `${f.name(r.options[0])} या ${f.name(r.options[1])}?`;
    case 'needAmount': return `${f.name(r.member)}, ${TYPE.hi[r.type]} कितने रुपये?`;
    case 'needType': return `${f.name(r.member)}, ${f.money(r.amount)}: बचत है या किस्त?`;
    case 'askEntry': return `${f.name(r.member)}, बोलिए: कितनी बचत, कितनी किस्त?`;
    case 'selfBalance':
      return `${f.name(r.member)}, आपकी कुल बचत ${f.money(r.savings)}।${r.loan > 0 ? ` बाकी लोन ${f.money(r.loan)}।` : ' कोई लोन बाकी नहीं।'}`;
    case 'groupBalance':
      return `ग्रुप के पास नकद ${f.money(r.cash)}। कुल बचत ${f.money(r.savings)}। बाहर दिया लोन ${f.money(r.outstanding)}।`;
    case 'undone':
      return `पिछली एंट्री हटाई: ${f.name(r.entry.memberId)}, ${TYPE.hi[r.entry.type]} ${f.money(r.entry.amount)}। खाते में यह भी लिखा गया।`;
    case 'nothingToUndo': return 'आज की कोई एंट्री हटाने को नहीं है।';
    case 'summary':
      return `आज ${r.presentCount} लोग हाज़िर। बचत ${f.money(r.savings)}, किस्त ${f.money(r.repayments)}, नया लोन ${f.money(r.loans)}। ग्रुप के पास ${f.money(r.cash)} होने चाहिए।${r.notPaid.length ? ` ${f.list(r.notPaid)} ने आज कुछ जमा नहीं किया।` : ''} नकद गिनकर बोलिए: हाथ में कितना है। फिर बोलिए: सही है।`;
    case 'closed': return 'मीटिंग बंद। रिपोर्ट और सबकी रसीद तैयार है।';
    case 'stillOpen': return 'ठीक है, मीटिंग चालू है।';
    case 'confirmWaiting': return 'पहले बताइए: सही है या ग़लत?';
    case 'notHeard': return r.repeated ? 'आवाज़ साफ़ नहीं आई। फ़ोन के पास आकर बोलिए, या नीचे बटन दबाइए।' : 'आवाज़ साफ़ नहीं आई। दोबारा बोलिए।';
    case 'notUnderstood': return 'समझ नहीं आया। ऐसे बोलिए: मैं मीना, सौ रुपये बचत।';
    case 'help': return 'नाम, रकम और बचत या किस्त बोलिए। जैसे: मैं मीना, सौ रुपये बचत, पाँच सौ किस्त। अपना हिसाब सुनने के लिए: मेरा कितना जमा है?';
    case 'alreadyClosed': return 'आज की मीटिंग बंद हो चुकी है। नई मीटिंग के लिए बोलिए: मीटिंग शुरू करो।';
    case 'addMemberAsk': return `नया सदस्य: ${r.name}। सही है?`;
    case 'memberAdded': return `${r.name} समूह में जुड़ गईं। स्वागत है! अब ${r.count} सदस्य हैं।`;
    case 'memberExists': return `${f.name(r.member)} पहले से समूह में हैं।`;
    case 'needNewName': return 'नए सदस्य का पूरा नाम बोलिए।';
    case 'noMembers': return 'समूह में अभी कोई सदस्य नहीं है। पहले बोलिए: नया सदस्य, और नाम।';
    case 'cashCount': {
      const d = r.counted - r.expected;
      if (d === 0) return `नकद ${f.money(r.counted)}। खाते से पूरा मिलता है।`;
      return `नकद ${f.money(r.counted)}, पर खाते के हिसाब से ${f.money(r.expected)} होने चाहिए। ${f.money(Math.abs(d))} ${d < 0 ? 'कम' : 'ज़्यादा'} है। यह गिनती खाते में दर्ज हो गई।`;
    }
  }
}

function mr(r: Reply, f: Fmt): string {
  switch (r.key) {
    case 'started': return 'मीटिंग सुरू. हजेरीसाठी सगळ्यांनी आपलं नाव सांगा.';
    case 'notStarted': return 'आधी सांगा: मीटिंग सुरू करा.';
    case 'present': return `${f.name(r.member)}, हजर.`;
    case 'alreadyPresent': return `${f.name(r.member)} यांची हजेरी आधीच लागली आहे.`;
    case 'attendanceDone':
      return `${r.presentCount} जणी हजर.${r.absent.length ? ` ${f.list(r.absent)} आल्या नाहीत.` : ' सगळ्या आल्या.'} आता नाव, बचत आणि हप्ता सांगा.`;
    case 'readback': {
      const after = Object.entries(r.after).filter(() => r.drafts.some((d) => d.type === 'repayment')).map(([id, v]) =>
        ` ${f.name(id)} यांचं बाकी कर्ज ${f.money(Math.max(v, 0))}.`).join('');
      const loan = r.loanAfter ? ` नंतर ${f.money(r.loanAfter.amount)} कर्ज.` : '';
      if (r.stage === 2) return `नीट ऐका. ${lines(r.drafts, 'mr', f)}.${after} नक्की बरोबर?`;
      const warn = r.warn === 'overpay' ? ' हप्ता बाकी कर्जापेक्षा जास्त होता, म्हणून कर्ज पूर्ण फिटलं आणि उरलेले पैसे बचतीत गेले.' : r.warn === 'large' ? ' रक्कम मोठी आहे.' : '';
      return `${lines(r.drafts, 'mr', f)}.${after}${loan}${warn} बरोबर आहे का?`;
    }
    case 'saved': return 'लिहिलं.';
    case 'rejected': return 'ठीक आहे, लिहिलं नाही. पुन्हा सांगा.';
    case 'loanAsk':
      return `${f.name(r.draft.memberId)} यांना ${f.money(r.draft.amount)} कर्ज. गटाकडे ${f.money(r.cash)} पैकी ${f.money(r.cash - r.draft.amount)} उरतील. अध्यक्ष, मंजूर?`;
    case 'loanNoCash': return `गटाकडे फक्त ${f.money(r.cash)} आहेत. एवढं कर्ज देता येणार नाही.`;
    case 'loanSaved': return `कर्ज मंजूर. ${f.name(r.draft.memberId)} यांना ${f.money(r.draft.amount)} लिहिलं.`;
    case 'loanWaiting': return 'कर्जासाठी अध्यक्षांनी सांगा: मंजूर. किंवा: नाही.';
    case 'noLoanToRepay': return `${f.name(r.member)} यांचं कोणतंही कर्ज बाकी नाही. ही बचत आहे का?`;
    case 'needMember': return 'कोणाचे पैसे? नाव सांगा.';
    case 'pick': return `${f.name(r.options[0])} की ${f.name(r.options[1])}?`;
    case 'needAmount': return `${f.name(r.member)}, ${TYPE.mr[r.type]} किती रुपये?`;
    case 'needType': return `${f.name(r.member)}, ${f.money(r.amount)}: बचत की हप्ता?`;
    case 'askEntry': return `${f.name(r.member)}, सांगा: किती बचत, किती हप्ता?`;
    case 'selfBalance':
      return `${f.name(r.member)}, तुमची एकूण बचत ${f.money(r.savings)}.${r.loan > 0 ? ` बाकी कर्ज ${f.money(r.loan)}.` : ' कर्ज बाकी नाही.'}`;
    case 'groupBalance':
      return `गटाकडे रोख ${f.money(r.cash)}. एकूण बचत ${f.money(r.savings)}. दिलेलं कर्ज ${f.money(r.outstanding)}.`;
    case 'undone':
      return `मागची नोंद रद्द: ${f.name(r.entry.memberId)}, ${TYPE.mr[r.entry.type]} ${f.money(r.entry.amount)}. ही नोंदही खात्यात राहील.`;
    case 'nothingToUndo': return 'आजची कोणतीही नोंद रद्द करायला नाही.';
    case 'summary':
      return `आज ${r.presentCount} जणी हजर. बचत ${f.money(r.savings)}, हप्ते ${f.money(r.repayments)}, नवीन कर्ज ${f.money(r.loans)}. गटाकडे ${f.money(r.cash)} असायला हवेत.${r.notPaid.length ? ` ${f.list(r.notPaid)} यांनी आज काही जमा केलं नाही.` : ''} रोख मोजून सांगा: हातात किती आहेत. मग सांगा: बरोबर.`;
    case 'closed': return 'मीटिंग बंद. अहवाल आणि सगळ्यांच्या पावत्या तयार आहेत.';
    case 'stillOpen': return 'ठीक आहे, मीटिंग चालू आहे.';
    case 'confirmWaiting': return 'आधी सांगा: बरोबर की चूक?';
    case 'notHeard': return r.repeated ? 'आवाज स्पष्ट आला नाही. फोनजवळ येऊन बोला, किंवा खालचं बटण दाबा.' : 'आवाज स्पष्ट आला नाही. पुन्हा सांगा.';
    case 'notUnderstood': return 'समजलं नाही. असं सांगा: मी मीना, शंभर रुपये बचत.';
    case 'help': return 'नाव, रक्कम आणि बचत किंवा हप्ता सांगा. उदा: मी मीना, शंभर रुपये बचत. आपला हिशोब ऐकायला: माझी किती बचत आहे?';
    case 'alreadyClosed': return 'आजची मीटिंग बंद झाली आहे. नवीन मीटिंगसाठी सांगा: मीटिंग सुरू करा.';
    case 'addMemberAsk': return `नवीन सदस्य: ${r.name}. बरोबर आहे का?`;
    case 'memberAdded': return `${r.name} गटात सामील झाल्या. स्वागत! आता ${r.count} सदस्य आहेत.`;
    case 'memberExists': return `${f.name(r.member)} आधीच गटात आहेत.`;
    case 'needNewName': return 'नवीन सदस्याचं पूर्ण नाव सांगा.';
    case 'noMembers': return 'गटात अजून कोणी सदस्य नाही. आधी सांगा: नवीन सदस्य, आणि नाव.';
    case 'cashCount': {
      const d = r.counted - r.expected;
      if (d === 0) return `रोख ${f.money(r.counted)}. खात्याशी पूर्ण जुळते.`;
      return `रोख ${f.money(r.counted)}, पण खात्याप्रमाणे ${f.money(r.expected)} हवेत. ${f.money(Math.abs(d))} ${d < 0 ? 'कमी' : 'जास्त'} आहेत. ही मोजणी खात्यात नोंदली.`;
    }
  }
}

function en(r: Reply, f: Fmt): string {
  switch (r.key) {
    case 'started': return 'Meeting started. Everyone, please say your name for attendance.';
    case 'notStarted': return 'First say: start the meeting.';
    case 'present': return `${f.name(r.member)}, present.`;
    case 'alreadyPresent': return `${f.name(r.member)} is already marked present.`;
    case 'attendanceDone':
      return `${r.presentCount} present.${r.absent.length ? ` ${f.list(r.absent)} did not come.` : ' Everyone is here.'} Now say your name, savings and repayment.`;
    case 'readback': {
      const after = Object.entries(r.after).filter(() => r.drafts.some((d) => d.type === 'repayment')).map(([id, v]) =>
        ` ${f.name(id)} still owes ${f.money(Math.max(v, 0))}.`).join('');
      const loan = r.loanAfter ? ` Then a loan of ${f.money(r.loanAfter.amount)}.` : '';
      if (r.stage === 2) return `Listen carefully. ${lines(r.drafts, 'en', f)}.${after} Are you sure?`;
      const warn = r.warn === 'overpay' ? ' That is more than the loan left, so the loan is closed and the rest goes to savings.' : r.warn === 'large' ? ' This is a large amount.' : '';
      return `${lines(r.drafts, 'en', f)}.${after}${loan}${warn} Is that right?`;
    }
    case 'saved': return 'Saved.';
    case 'rejected': return 'Okay, not saved. Please say it again.';
    case 'loanAsk':
      return `Loan of ${f.money(r.draft.amount)} to ${f.name(r.draft.memberId)}. Group cash goes from ${f.money(r.cash)} to ${f.money(r.cash - r.draft.amount)}. Leader, approve?`;
    case 'loanNoCash': return `The group only has ${f.money(r.cash)}. It cannot give this loan.`;
    case 'loanSaved': return `Loan approved. ${f.money(r.draft.amount)} to ${f.name(r.draft.memberId)} is recorded.`;
    case 'loanWaiting': return 'For a loan, the leader must say: approve. Or say: no.';
    case 'noLoanToRepay': return `${f.name(r.member)} has no loan to repay. Is this savings?`;
    case 'needMember': return 'Whose money is this? Say the name.';
    case 'pick': return `${f.name(r.options[0])} or ${f.name(r.options[1])}?`;
    case 'needAmount': return `${f.name(r.member)}, how much ${TYPE.en[r.type]}?`;
    case 'needType': return `${f.name(r.member)}, ${f.money(r.amount)}: savings or repayment?`;
    case 'askEntry': return `${f.name(r.member)}, say how much savings and how much repayment.`;
    case 'selfBalance':
      return `${f.name(r.member)}, your total savings are ${f.money(r.savings)}.${r.loan > 0 ? ` Loan left: ${f.money(r.loan)}.` : ' No loan left.'}`;
    case 'groupBalance':
      return `The group holds ${f.money(r.cash)} in cash. Total savings ${f.money(r.savings)}. Loans out ${f.money(r.outstanding)}.`;
    case 'undone':
      return `Last entry cancelled: ${f.name(r.entry.memberId)}, ${TYPE.en[r.entry.type]} ${f.money(r.entry.amount)}. The cancellation is also recorded.`;
    case 'nothingToUndo': return 'There is no entry from today to cancel.';
    case 'summary':
      return `${r.presentCount} present today. Savings ${f.money(r.savings)}, repayments ${f.money(r.repayments)}, new loans ${f.money(r.loans)}. The group should hold ${f.money(r.cash)}.${r.notPaid.length ? ` ${f.list(r.notPaid)} paid nothing today.` : ''} Count the cash and say how much is in hand. Then say: right.`;
    case 'closed': return 'Meeting closed. The report and everyone\'s receipts are ready.';
    case 'stillOpen': return 'Okay, the meeting is still open.';
    case 'confirmWaiting': return 'First tell me: right or wrong?';
    case 'notHeard': return r.repeated ? 'I could not hear clearly. Come closer to the phone, or use the buttons below.' : 'I could not hear clearly. Please say it again.';
    case 'notUnderstood': return 'I did not understand. Say it like this: I am Meena, one hundred rupees savings.';
    case 'help': return 'Say a name, an amount, and savings or repayment. For example: I am Meena, one hundred savings, five hundred repayment. To hear your balance: how much have I saved?';
    case 'alreadyClosed': return 'Today\'s meeting is closed. To start a new one, say: start the meeting.';
    case 'addMemberAsk': return `New member: ${r.name}. Is that right?`;
    case 'memberAdded': return `${r.name} has joined the group. Welcome! There are now ${r.count} members.`;
    case 'memberExists': return `${f.name(r.member)} is already in the group.`;
    case 'needNewName': return 'Say the new member\'s full name.';
    case 'noMembers': return 'The group has no members yet. First say: add member, and her name.';
    case 'cashCount': {
      const d = r.counted - r.expected;
      if (d === 0) return `Cash counted: ${f.money(r.counted)}. It matches the ledger exactly.`;
      return `Cash counted: ${f.money(r.counted)}, but the ledger says ${f.money(r.expected)}. That is ${f.money(Math.abs(d))} ${d < 0 ? 'short' : 'extra'}. The count is recorded.`;
    }
  }
}

const RENDER: Record<Lang, (r: Reply, f: Fmt) => string> = { hi, mr, en };

export function render(r: Reply, lang: Lang, members: Member[]): Rendered {
  return {
    say: RENDER[lang](r, makeFmt(lang, members, false)),
    show: RENDER[lang](r, makeFmt(lang, members, true)),
  };
}

/** Example phrases shown as tappable chips: say them, or tap to try without a mic. */
export const EXAMPLES: Record<Lang, Record<'idle' | 'attendance' | 'entries' | 'closed', string[]>> = {
  hi: {
    idle: ['मीटिंग शुरू करो', 'नया सदस्य: पुष्पा देवी'],
    attendance: ['मैं मीना हूँ', 'राधा हाज़िर', 'सुनीता यादव', 'हाज़िरी पूरी'],
    entries: ['मैं मीना, सौ रुपये बचत', 'रेखा की किस्त पाँच सौ', 'राधा को डेढ़ हज़ार लोन', 'मेरा कितना जमा है?', 'पिछली एंट्री हटाओ', 'मीटिंग बंद करो', 'हाथ में बीस हज़ार है'],
    closed: ['मीटिंग शुरू करो'],
  },
  mr: {
    idle: ['मीटिंग सुरू करा', 'नवीन सदस्य: पुष्पा'],
    attendance: ['मी मीना', 'राधा हजर', 'हजेरी पूर्ण'],
    entries: ['मी मीना, शंभर रुपये बचत', 'रेखा हप्ता पाचशे', 'राधाला दीड हजार कर्ज', 'माझी किती बचत आहे?', 'मीटिंग बंद करा'],
    closed: ['मीटिंग सुरू करा'],
  },
  en: {
    idle: ['Start the meeting', 'Add member Pushpa Devi'],
    attendance: ['I am Meena', 'Radha present', 'Attendance done'],
    entries: ['Meena, 100 rupees savings', 'Rekha repayment 500', 'Radha loan 1500', 'How much have I saved?', 'Undo', 'End the meeting'],
    closed: ['Start the meeting'],
  },
};

/**
 * A whole meeting the app can play by itself: attendance, two Sunitas, a read-back,
 * an overpaid loan, a loan approval, a balance question, closing and a short cash box.
 * Run through the real engine in tests, so it can never silently break.
 */
export const DEMO_SCRIPT: Record<Lang, string[]> = {
  hi: [
    'मीटिंग शुरू करो', 'मैं मीना हूँ', 'राधा हाज़िर', 'रेखा हाज़िर', 'सुनीता', 'यादव', 'हाज़िरी पूरी',
    'मैं मीना, दो सौ रुपये बचत', 'हाँ सही है', 'रेखा की किस्त दो हज़ार', 'सही है',
    'राधा को ढाई हज़ार लोन', 'मंज़ूर', 'मेरा कितना जमा है?', 'मीटिंग बंद करो', 'हाथ में बीस हज़ार एक सौ है', 'सही है',
  ],
  mr: [
    'मीटिंग सुरू करा', 'मी मीना', 'राधा हजर', 'रेखा हजर', 'सुनीता', 'यादव', 'हजेरी पूर्ण',
    'मी मीना, दोनशे रुपये बचत', 'बरोबर', 'रेखा हप्ता दोन हजार', 'हो',
    'राधाला अडीच हजार कर्ज', 'मंजूर', 'माझी किती बचत आहे?', 'मीटिंग बंद करा', 'रोख वीस हजार शंभर', 'बरोबर',
  ],
  en: [
    'Start the meeting', 'I am Meena', 'Radha present', 'Rekha present', 'Sunita', 'Yadav', 'Attendance done',
    'Meena, two hundred rupees savings', 'yes', 'Rekha repayment two thousand', 'right',
    'Radha loan two thousand five hundred', 'approve', 'How much have I saved?', 'End the meeting',
    'Cash in hand twenty thousand one hundred', 'yes',
  ],
};
