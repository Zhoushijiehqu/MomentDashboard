/* ============================================================
 * 「日常集」核心数据模型（纯本地 JSON）
 * ============================================================ */

export type Flow = '支出' | '收入';

/** 记账流水 */
export interface Tx {
  id: string;
  flow: Flow;
  amount: number;
  category: string;
  /** YYYY-MM-DD */
  date: string;
  note: string;
}

export type HabitKind = 'check' | 'count' | 'number';

/** 习惯定义 */
export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  /** count/number 时单位，如 次/分钟/页 */
  unit: string;
  /** number 型单次目标值（提示用，可不设） */
  target?: number;
  color: string;
}

/** 打卡记录：date 每日一条（check=1；count/number=当日累计值） */
export interface Check {
  id: string;
  habitId: string;
  date: string;
  value: number;
}

/** 减脂目标 */
export interface FitnessGoal {
  start: number;
  target: number;
}

/** 身体日志（体重单位 kg；热量 kcal；运动分钟） */
export interface FitnessEntry {
  id: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  calories?: number;
  minutes?: number;
  note: string;
}

export type BuyPriority = '急需' | '有空买' | '等等再买';

/** 待买清单项 */
export interface Buy {
  id: string;
  name: string;
  category: string;
  qty: number;
  /** 预计单价 ¥ */
  price: number;
  priority: BuyPriority;
  note: string;
  status: '待买' | '已买';
  boughtDate?: string;
}

export type MediaType = '电影' | '剧集' | '书籍' | '番剧';
export type MediaStatus = '想看' | '在看' | '看完' | '弃了';

/** 书影音条目 */
export interface Media {
  id: string;
  name: string;
  type: MediaType;
  status: MediaStatus;
  /** 0-5，未评 0 */
  rating: number;
  /** 看完/入手日期 */
  date?: string;
  review: string;
}

/** 整体数据库 */
export interface DB {
  txs: Tx[];
  habits: Habit[];
  checks: Check[];
  goal: FitnessGoal | null;
  fitness: FitnessEntry[];
  buys: Buy[];
  media: Media[];
}

/* ---- 分类常量 ---- */
export const EXP_CATS = ['餐饮', '交通', '日用', '服饰', '数码', '娱乐', '医疗', '学习', '人情', '其他'];
export const INC_CATS = ['工资', '兼职', '理财', '红包', '其他'];
export const BUY_CATS = ['食品', '日用品', '家居', '数码', '药品', '其他'];
export const BUY_PRIORITIES: BuyPriority[] = ['急需', '有空买', '等等再买'];
export const MEDIA_TYPES: MediaType[] = ['电影', '剧集', '书籍', '番剧'];
export const MEDIA_STATUSES: MediaStatus[] = ['想看', '在看', '看完', '弃了'];
export const HABIT_COLORS = ['#c1664f', '#7d8c6f', '#a5845a', '#7a5c6e', '#5b7e8c', '#9a7b4f'];

export interface Settings {
  brandName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: number;
  kind?: 'question' | 'done';
}
