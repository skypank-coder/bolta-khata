import type { MeetingState, Reply } from './meeting';
import type { Lang, Member } from './store';

/**
 * The coach: at every moment, one plain line saying what to do next, and the
 * exact words to say. Nobody has to remember how the app works.
 */

export interface Hint {
  /** What to do, in one short line. */
  lead: string;
  /** Exact words to say next (also a tap-to-say button). */
  say: string[];
}

type Names = { first: string; other: string };

const H: Record<Lang, {
  idle: Hint; idleEmpty: Hint; attendance: Hint; entries: Hint; closed: Hint;
  confirm: Hint; approveLoan: Hint; confirmClose: Hint; needType: Hint; needMember: Hint;
  needAmount: Hint; needNewName: Hint; confirmNewMember: Hint; pick: (n: Names) => Hint;
}> = {
  hi: {
    idle: { lead: 'माइक दबाइए और मीटिंग शुरू कीजिए', say: ['मीटिंग शुरू करो'] },
    idleEmpty: { lead: 'पहले समूह के सदस्य जोड़िए', say: ['नया सदस्य: पुष्पा देवी'] },
    attendance: { lead: 'हर सदस्य अपना नाम बोले। सब आ जाएँ तो बोलिए: हाज़िरी पूरी', say: ['मैं मीना हूँ', 'हाज़िरी पूरी'] },
    entries: { lead: 'नाम, रकम, और बचत या किस्त बोलिए', say: ['मैं मीना, सौ रुपये बचत', 'मेरा कितना जमा है?', 'मीटिंग बंद करो'] },
    closed: { lead: 'मीटिंग बंद है। रिपोर्ट देखिए, या अगली मीटिंग शुरू कीजिए', say: ['मीटिंग शुरू करो'] },
    confirm: { lead: 'सब ध्यान से सुनें। सही हो तो बोलिए: सही है', say: ['सही है', 'ग़लत है'] },
    approveLoan: { lead: 'लोन के लिए नेता जी बोलें: मंज़ूर', say: ['मंज़ूर', 'नहीं'] },
    confirmClose: { lead: 'नकद गिनकर बोलिए कितना है, फिर: सही है', say: ['हाथ में बीस हज़ार है', 'सही है'] },
    needType: { lead: 'यह पैसा बचत है या किस्त?', say: ['बचत', 'किस्त'] },
    needMember: { lead: 'किसका पैसा है? नाम बोलिए', say: [] },
    needAmount: { lead: 'कितने रुपये? रकम बोलिए', say: ['सौ रुपये', 'पाँच सौ'] },
    needNewName: { lead: 'नए सदस्य का पूरा नाम बोलिए', say: [] },
    confirmNewMember: { lead: 'नाम सही हो तो बोलिए: सही है', say: ['सही है', 'ग़लत है'] },
    pick: (n) => ({ lead: `दो सदस्यों का नाम मिलता है। पूरा नाम बोलिए: ${n.first} या ${n.other}`, say: [] }),
  },
  mr: {
    idle: { lead: 'माइक दाबा आणि मीटिंग सुरू करा', say: ['मीटिंग सुरू करा'] },
    idleEmpty: { lead: 'आधी गटाचे सदस्य जोडा', say: ['नवीन सदस्य: पुष्पा'] },
    attendance: { lead: 'प्रत्येकीने आपलं नाव सांगावं. सगळ्या आल्या की सांगा: हजेरी पूर्ण', say: ['मी मीना', 'हजेरी पूर्ण'] },
    entries: { lead: 'नाव, रक्कम, आणि बचत किंवा हप्ता सांगा', say: ['मी मीना, शंभर रुपये बचत', 'माझी किती बचत आहे?', 'मीटिंग बंद करा'] },
    closed: { lead: 'मीटिंग बंद आहे. अहवाल पाहा, किंवा पुढची मीटिंग सुरू करा', say: ['मीटिंग सुरू करा'] },
    confirm: { lead: 'सगळ्यांनी नीट ऐका. बरोबर असेल तर सांगा: बरोबर', say: ['बरोबर', 'चूक'] },
    approveLoan: { lead: 'कर्जासाठी अध्यक्षांनी सांगा: मंजूर', say: ['मंजूर', 'नाही'] },
    confirmClose: { lead: 'रोख मोजून किती आहेत ते सांगा, मग: बरोबर', say: ['रोख वीस हजार', 'बरोबर'] },
    needType: { lead: 'हे पैसे बचत की हप्ता?', say: ['बचत', 'हप्ता'] },
    needMember: { lead: 'कोणाचे पैसे? नाव सांगा', say: [] },
    needAmount: { lead: 'किती रुपये? रक्कम सांगा', say: ['शंभर रुपये', 'पाचशे'] },
    needNewName: { lead: 'नवीन सदस्याचं पूर्ण नाव सांगा', say: [] },
    confirmNewMember: { lead: 'नाव बरोबर असेल तर सांगा: बरोबर', say: ['बरोबर', 'चूक'] },
    pick: (n) => ({ lead: `दोन सदस्यांचं नाव जुळतं. पूर्ण नाव सांगा: ${n.first} की ${n.other}`, say: [] }),
  },
  en: {
    idle: { lead: 'Tap the mic and start the meeting', say: ['Start the meeting'] },
    idleEmpty: { lead: 'First add the group\'s members', say: ['Add member Pushpa Devi'] },
    attendance: { lead: 'Each member says her name. When all are here, say: attendance done', say: ['I am Meena', 'Attendance done'] },
    entries: { lead: 'Say a name, an amount, and savings or repayment', say: ['Meena, 100 rupees savings', 'How much have I saved?', 'End the meeting'] },
    closed: { lead: 'The meeting is closed. See the report, or start the next meeting', say: ['Start the meeting'] },
    confirm: { lead: 'Everyone listens. If it is right, say: yes', say: ['yes', 'no'] },
    approveLoan: { lead: 'For a loan, the leader says: approve', say: ['approve', 'no'] },
    confirmClose: { lead: 'Count the cash and say how much, then: yes', say: ['Cash in hand 20000', 'yes'] },
    needType: { lead: 'Is this money savings or repayment?', say: ['savings', 'repayment'] },
    needMember: { lead: 'Whose money is it? Say the name', say: [] },
    needAmount: { lead: 'How much? Say the amount', say: ['100 rupees', '500'] },
    needNewName: { lead: 'Say the new member\'s full name', say: [] },
    confirmNewMember: { lead: 'If the name is right, say: yes', say: ['yes', 'no'] },
    pick: (n) => ({ lead: `Two members have that name. Say the full name: ${n.first} or ${n.other}`, say: [] }),
  },
};

export function nextHint(state: MeetingState, members: Member[], lang: Lang): Hint {
  const h = H[lang];
  const label = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? (lang === 'en' ? m.name : m.nameLocal ?? m.name) : id;
  };
  const p = state.pending;
  if (p) {
    switch (p.kind) {
      case 'confirm': return h.confirm;
      case 'approveLoan': return h.approveLoan;
      case 'confirmClose': return h.confirmClose;
      case 'needType': return h.needType;
      case 'needMember': return h.needMember;
      case 'needAmount': return h.needAmount;
      case 'needNewName': return h.needNewName;
      case 'confirmNewMember': return h.confirmNewMember;
      case 'pickMember': return h.pick({ first: label(p.options[0]), other: label(p.options[1]) });
    }
  }
  if (state.phase === 'idle') return members.length ? h.idle : h.idleEmpty;
  if (state.phase === 'attendance') return h.attendance;
  if (state.phase === 'closed') return h.closed;
  return h.entries;
}

/** The five things a new group learns, ticked off as they happen in a real meeting. */
export type Milestone = 'started' | 'attendance' | 'saved' | 'asked' | 'closed';
export const MILESTONES: Milestone[] = ['started', 'attendance', 'saved', 'asked', 'closed'];

export function milestoneOf(r: Reply): Milestone | null {
  switch (r.key) {
    case 'started': return 'started';
    case 'present':
    case 'attendanceDone': return 'attendance';
    case 'saved':
    case 'loanSaved': return 'saved';
    case 'selfBalance':
    case 'groupBalance': return 'asked';
    case 'closed': return 'closed';
    default: return null;
  }
}

export const MILESTONE_TEXT: Record<Lang, Record<Milestone, string>> = {
  hi: { started: 'मीटिंग शुरू की', attendance: 'हाज़िरी लगाई', saved: 'पहली एंट्री सही करवाई', asked: 'अपना हिसाब पूछा', closed: 'मीटिंग बंद की' },
  mr: { started: 'मीटिंग सुरू केली', attendance: 'हजेरी लावली', saved: 'पहिली नोंद बरोबर केली', asked: 'आपला हिशोब विचारला', closed: 'मीटिंग बंद केली' },
  en: { started: 'Started a meeting', attendance: 'Took attendance', saved: 'Confirmed a first entry', asked: 'Asked a balance', closed: 'Closed the meeting' },
};
