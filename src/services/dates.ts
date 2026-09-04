/* ============================================================
 * 日期/ID 工具 —— 一律用本地时区，避免 UTC 偏移造成跨天错位
 * ============================================================ */
const pad = (n: number) => String(n).padStart(2, '0');

/** 短随机 ID */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** 本地时区 'YYYY-MM-DD' */
export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 把 'YYYY-MM-DD'（或 'YYYY-MM'）解析成本地 Date */
function toLocal(key: string): Date {
  const [y, m, d] = key.split('-').map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 日期加减 n 天，返回 'YYYY-MM-DD' */
export function addDays(key: string, n: number): string {
  const dt = toLocal(key);
  dt.setDate(dt.getDate() + n);
  return todayKey(dt);
}

/** 取月份 'YYYY-MM' */
export function monthOf(key: string): string {
  return key.slice(0, 7);
}

const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/** 'YYYY-MM' → '2026年9月' */
export function monthCN(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${y}年${CN_NUM[Number(m)] || m}月`;
}

/** 友好日期：跨年或 withYear → '2026年9月4日'，否则 '9月4日' */
export function fmtCN(key: string, withYear = false): string {
  const [y, m, d] = key.split('-').map((x) => Number(x));
  const cur = new Date().getFullYear();
  const showYear = withYear || y !== cur;
  return `${showYear ? y + '年' : ''}${m}月${d}日`;
}

/** 相对说法：今天 / 昨天 / 前天 → 退回 fmtCN */
export function relCN(key: string): string {
  const t = todayKey();
  const diff = Math.round(
    (new Date(`${t}T00:00:00`).getTime() - new Date(`${key}T00:00:00`).getTime()) / 86400000,
  );
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  return fmtCN(key);
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

/** 今天星期几 → '星期五' */
export function todayISOWeekday(d: Date = new Date()): string {
  return `星期${WEEK_CN[d.getDay()]}`;
}
