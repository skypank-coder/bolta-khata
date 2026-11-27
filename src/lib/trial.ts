import { api, type User } from './api';
import { newId } from './ledger';
import { buildDemoData, saveData, type Lang } from './store';

const NAMES: Record<Lang, { user: string; group: string; village: string }> = {
  hi: { user: 'अतिथि दीदी', group: 'दुर्गा महिला समूह', village: 'रामपुर, सीतापुर' },
  mr: { user: 'पाहुण्या ताई', group: 'दुर्गा महिला गट', village: 'रामपूर, सातारा' },
  en: { user: 'Guest', group: 'Durga Mahila Samooh', village: 'Rampur, Sitapur' },
};

/**
 * One click from the website to a real, saved group: a guest account on the server,
 * a group with 12 members and 14 months of history, opened straight in the meeting.
 */
export async function startTrial(lang: Lang): Promise<{ user: User; groupId: string }> {
  const n = NAMES[lang];
  const { user } = await api.guest(n.user);
  const data = await buildDemoData(lang);
  data.group = { ...data.group, name: n.group, nameLocal: n.group, village: n.village };
  data.settings = { ...data.settings, lang, welcomed: true };
  const r = await api.createGroup({ id: newId('g'), name: n.group, village: n.village, members: data.group.members, entries: data.ledger });
  await saveData({ ...data, syncedSeq: r.lastSeq }, `g:${r.id}`);
  return { user, groupId: r.id };
}
