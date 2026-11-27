import type { Lang } from './store';

/** A step of Sakhi's tour: what she points at (a data-tour target) and what she says. */
export interface TourStep {
  target?: string;
  say: Record<Lang, string>;
}

export const SITE_TOUR: TourStep[] = [
  {
    say: {
      hi: 'नमस्ते! मैं सखी हूँ। चलिए, मैं आपको एक मिनट में बोलता खाता दिखाती हूँ।',
      mr: 'नमस्कार! मी सखी. चला, मी तुम्हाला एका मिनिटात बोलता खाता दाखवते.',
      en: 'Namaste! I am Sakhi. Let me show you Bolta Khata in one minute.',
    },
  },
  {
    target: 'hero-demo',
    say: {
      hi: 'यह देखिए। दीदी बोलती है, खाता उसके शब्द पहचानता है, और पूरे समूह को पढ़कर सुनाता है। सही है बोलने पर ही लिखा जाता है।',
      mr: 'हे पाहा. ताई बोलते, खाते तिचे शब्द ओळखते, आणि संपूर्ण गटाला वाचून ऐकवते. बरोबर म्हटल्यावरच लिहिलं जातं.',
      en: 'Look here. A member speaks, the khata recognises her words and reads them back to the whole group. It is written only when they say sahi hai.',
    },
  },
  {
    target: 'trial',
    say: {
      hi: 'सबसे आसान रास्ता: यह बटन दबाइए। बिना नंबर के, बारह सदस्यों वाला समूह तैयार मिलेगा।',
      mr: 'सर्वात सोपा मार्ग: हे बटण दाबा. नंबरशिवाय, बारा सदस्यांचा गट तयार मिळेल.',
      en: 'The easiest way in: press this button. No number needed, and a twelve-member group is ready.',
    },
  },
  {
    target: 'signup',
    say: {
      hi: 'अपना असली समूह चलाना है? मोबाइल नंबर और PIN से मुफ़्त खाता बनाइए।',
      mr: 'आपला खरा गट चालवायचा आहे? मोबाइल नंबर आणि PIN ने मोफत खाते तयार करा.',
      en: 'Want to run your real group? Create a free account with your mobile number and a PIN.',
    },
  },
  {
    target: 'lang',
    say: {
      hi: 'भाषा यहाँ बदलिए: हिंदी, मराठी या अंग्रेज़ी।',
      mr: 'भाषा इथे बदला: हिंदी, मराठी किंवा इंग्रजी.',
      en: 'Change the language here: Hindi, Marathi or English.',
    },
  },
  {
    target: 'how',
    say: {
      hi: 'मीटिंग चार कदम में चलती है: बोलिए, सुनिए, सही है, और ताला। बस इतना ही।',
      mr: 'मीटिंग चार पायऱ्यांत चालते: बोला, ऐका, बरोबर, आणि कुलूप. इतकंच.',
      en: 'A meeting runs in four steps: speak, listen, sahi hai, and locked. That is all.',
    },
  },
];

export const MEETING_TOUR: TourStep[] = [
  {
    say: {
      hi: 'नमस्ते! मैं सखी हूँ। यह आपके समूह की मीटिंग है। चलिए, सब कुछ दिखाती हूँ।',
      mr: 'नमस्कार! मी सखी. ही तुमच्या गटाची मीटिंग आहे. चला, सगळं दाखवते.',
      en: 'Namaste! I am Sakhi. This is your group\'s meeting. Let me show you around.',
    },
  },
  {
    target: 'mic',
    say: {
      hi: 'यह माइक है। एक बार दबाइए और बोलते रहिए। हर जवाब के बाद यह फिर से सुनता है।',
      mr: 'हा माइक आहे. एकदा दाबा आणि बोलत राहा. प्रत्येक उत्तरानंतर तो पुन्हा ऐकतो.',
      en: 'This is the mic. Press it once and keep talking. After every reply it listens again.',
    },
  },
  {
    target: 'reply',
    say: {
      hi: 'खाता जो सुनता है, यहाँ लिखकर दिखाता है, और बोलकर सुनाता है।',
      mr: 'खाते जे ऐकते, ते इथे लिहून दाखवते आणि बोलून ऐकवते.',
      en: 'What the khata hears is written here, and spoken back to everyone.',
    },
  },
  {
    target: 'coach',
    say: {
      hi: 'यहाँ हमेशा लिखा रहेगा कि अब क्या बोलना है। चाहें तो बटन दबाकर भी कर सकते हैं।',
      mr: 'इथे नेहमी लिहिलेलं असेल की आता काय बोलायचं. हवं तर बटण दाबूनही करू शकता.',
      en: 'This line always tells you what to say next. You can also just tap the buttons.',
    },
  },
  {
    target: 'circle',
    say: {
      hi: 'यह आपका समूह है, दरी पर बैठा हुआ। जो हाज़िर है उसकी जगह भरती है, और जिसका पैसा लिखा जा रहा है वह चमकती है।',
      mr: 'हा तुमचा गट आहे, सतरंजीवर बसलेला. जी हजर आहे तिची जागा भरते, आणि जिचे पैसे लिहिले जात आहेत ती चमकते.',
      en: 'This is your group, sitting on the durrie. Present members fill their seat, and the one whose money is being written glows.',
    },
  },
  {
    target: 'tabs',
    say: {
      hi: 'खाता टैब में हर एंट्री का ताला दिखता है। रिपोर्ट टैब में बैंक की रिपोर्ट और सबकी रसीदें।',
      mr: 'खाते टॅबमध्ये प्रत्येक नोंदीचं कुलूप दिसतं. अहवाल टॅबमध्ये बँकेचा अहवाल आणि सगळ्यांच्या पावत्या.',
      en: 'The ledger tab shows the lock on every entry. The report tab has the bank report and everyone\'s receipts.',
    },
  },
  {
    target: 'help',
    say: {
      hi: 'कभी भी अटकें, तो मदद दबाइए। चलिए, अब माइक दबाइए और बोलिए: मीटिंग शुरू करो।',
      mr: 'कधीही अडकलात तर मदत दाबा. चला, आता माइक दाबा आणि सांगा: मीटिंग सुरू करा.',
      en: 'If you ever get stuck, press help. Now press the mic and say: start the meeting.',
    },
  },
];

const KEY = (id: string) => `bk.tour.${id}`;
export function tourSeen(id: string): boolean {
  try { return localStorage.getItem(KEY(id)) === '1'; } catch { return true; }
}
export function markTourSeen(id: string): void {
  try { localStorage.setItem(KEY(id), '1'); } catch { /* ignore */ }
}
