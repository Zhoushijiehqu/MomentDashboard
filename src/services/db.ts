/* 本地存储：localStorage 单库 JSON + 导出/导入（含种子示例）
 * 最终 Electron 版替换为 electron-store，结构不变 */
import type { DB, Media, Settings } from '../types';
import { DEFAULT_API } from '../config/api';
import { HABIT_COLORS } from '../types';
import { addDays, todayKey, uid } from './dates';

const KEY = 'richangji.db.v1';
const SET = 'richangji.settings.v1';

export function emptyDB(): DB {
  return { txs: [], habits: [], checks: [], goal: null, fitness: [], buys: [], media: [] };
}

export function defaultSettings(): Settings {
  return { brandName: '个人工作台', ...DEFAULT_API };
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDB();
    const d = JSON.parse(raw);
    return { ...emptyDB(), ...d };
  } catch {
    return emptyDB();
  }
}

export function saveDB(db: DB): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('保存失败', e);
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SET);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SET, JSON.stringify(s));
}

export function exportJSON(db: DB, settings: Settings): void {
  const payload = {
    app: '日常集',
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: { brandName: settings.brandName, baseUrl: settings.baseUrl, model: settings.model },
    db,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `richangji-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 导入备份：兼容自身 v2 导出；其余结构给出失败原因 */
export function importJSON(text: string): { db: DB; ok: boolean; msg: string } {
  try {
    const data = JSON.parse(text);
    let db: DB;
    if (data && data.db && Array.isArray(data.db.txs)) {
      db = { ...emptyDB(), ...data.db };
    } else if (data && Array.isArray(data.txs) && Array.isArray(data.habits)) {
      db = { ...emptyDB(), ...data };
    } else {
      return { db: emptyDB(), ok: false, msg: '不是日常集备份格式（未识别）' };
    }
    // 缺数组字段兜底
    db = {
      ...emptyDB(),
      ...db,
      txs: db.txs || [],
      habits: db.habits || [],
      checks: db.checks || [],
      fitness: db.fitness || [],
      buys: db.buys || [],
      media: db.media || [],
    };
    return { db, ok: true, msg: `导入成功：${db.txs.length} 笔流水 · ${db.habits.length} 个习惯 · ${db.media.length} 条书影音` };
  } catch (e: any) {
    return { db: emptyDB(), ok: false, msg: 'JSON 解析失败：' + String(e?.message || e) };
  }
}

/* ---------------- 示例数据（首启/重置用） ---------------- */
let _seed = 7;
function rnd(): number {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export function sampleDB(): DB {
  const db = emptyDB();
  const today = todayKey();

  const h1 = { id: uid(), name: '阅读', kind: 'number' as const, unit: '页', color: HABIT_COLORS[2] };
  const h2 = { id: uid(), name: '练字', kind: 'number' as const, unit: '页', color: HABIT_COLORS[0] };
  const h3 = { id: uid(), name: '运动', kind: 'count' as const, unit: '分钟', color: HABIT_COLORS[1] };
  const h4 = { id: uid(), name: '早睡', kind: 'check' as const, unit: '', color: HABIT_COLORS[3] };
  const h5 = { id: uid(), name: '背单词', kind: 'count' as const, unit: '个', color: HABIT_COLORS[4] };
  db.habits = [h1, h2, h3, h4, h5];

  for (let i = 34; i >= 0; i--) {
    const date = addDays(today, -i);
    const wd = new Date(date).getDay();
    if (wd === 0 || wd === 6) {
      if (rnd() < 0.6) db.checks.push({ id: uid(), habitId: h4.id, date, value: 1 });
      if (rnd() < 0.4) db.checks.push({ id: uid(), habitId: h3.id, date, value: 30 });
      continue;
    }
    db.checks.push({ id: uid(), habitId: h1.id, date, value: Math.round(15 + rnd() * 35) });
    if (rnd() < 0.8) db.checks.push({ id: uid(), habitId: h2.id, date, value: 1 + Math.round(rnd() * 2) });
    if (rnd() < 0.7) db.checks.push({ id: uid(), habitId: h4.id, date, value: 1 });
    if (rnd() < 0.65) db.checks.push({ id: uid(), habitId: h5.id, date, value: Math.round(15 + rnd() * 25) });
    if (rnd() < 0.45) db.checks.push({ id: uid(), habitId: h3.id, date, value: Math.round(25 + rnd() * 30) });
  }

  // 健身趋势：70 → 68.4kg
  let w = 70;
  for (let i = 20; i >= 0; i--) {
    w -= 0.05 + rnd() * 0.1;
    db.fitness.push({
      id: uid(),
      date: addDays(today, -i),
      weight: Math.round(w * 10) / 10,
      bodyFat: Math.round((22 - (70 - w) * 0.6) * 10) / 10,
      calories: Math.round(1600 + rnd() * 400),
      minutes: Math.round(20 + rnd() * 40),
      note: '',
    });
  }
  db.goal = { start: 70, target: 65 };

  // 记账：近 35 天
  const expItems: [string, string, number][] = [
    ['餐饮', '食堂午饭', 18], ['交通', '地铁', 6], ['餐饮', '水果', 25], ['日用', '洗衣液', 39.9],
    ['餐饮', '咖啡', 18], ['娱乐', '电影票', 45], ['餐饮', '晚餐外卖', 42], ['服饰', '短袖T恤', 79],
    ['数码', '数据线', 29], ['学习', '买书', 58], ['医疗', '感冒药', 23.5], ['人情', '请客奶茶', 32],
  ];
  let budgetDay = 0;
  for (let i = 34; i >= 0; i--) {
    budgetDay++;
    const date = addDays(today, -i);
    const [c, note, base] = expItems[i % expItems.length];
    if (budgetDay % 2 === 0 || rnd() < 0.3) {
      db.txs.push({ id: uid(), flow: '支出', amount: Math.round(base * (0.8 + rnd() * 0.6) * 10) / 10, category: c, date, note });
    }
    if (budgetDay === 5 || budgetDay === 19 || budgetDay === 30) {
      db.txs.push({ id: uid(), flow: '收入', amount: [1200, 800, 300][Math.floor(rnd() * 3)], category: '兼职', date, note: '临时收入' });
    }
  }

  // 待买
  db.buys = [
    { id: uid(), name: '无线鼠标', category: '数码', qty: 1, price: 89, priority: '有空买', note: '', status: '待买' },
    { id: uid(), name: '抽纸一提', category: '日用品', qty: 1, price: 25, priority: '急需', note: '快用完了', status: '待买' },
    { id: uid(), name: '吐司面包', category: '食品', qty: 1, price: 12, priority: '有空买', note: '', status: '待买' },
    { id: uid(), name: '书架小夜灯', category: '家居', qty: 1, price: 49, priority: '等等再买', note: '', status: '已买', boughtDate: addDays(today, -6) },
    { id: uid(), name: '维C泡腾片', category: '药品', qty: 2, price: 18, priority: '有空买', note: '', status: '已买', boughtDate: addDays(today, -12) },
  ];

  // 书影音
  const mediaSeed: [string, Media['type'], Media['status'], number, string][] = [
    ['置身事内：中国政府与经济发展', '书籍', '看完', 4.5, '把地方政府和土地财政讲得很清楚'],
    ['思考，快与慢', '书籍', '在看', 0, ''],
    ['小城之春', '电影', '看完', 5, '含蓄克制，回味很久'],
    ['宇宙探索编辑部', '电影', '看完', 4, '荒诞又浪漫'],
    ['我的解放日志', '剧集', '看完', 4.5, ''],
    ['葬送的芙莉莲', '番剧', '在看', 5, ''],
    ['鼠疫', '书籍', '想看', 0, ''],
    ['奥本海默', '电影', '想看', 0, ''],
  ];
  db.media = mediaSeed.map(([name, type, status, rating, review], i) => ({
    id: uid(),
    name,
    type: type as Media['type'],
    status: status as Media['status'],
    rating,
    date: status === '看完' ? addDays(today, -Math.floor(rnd() * 30)) : undefined,
    review,
  }));
  return db;
}
