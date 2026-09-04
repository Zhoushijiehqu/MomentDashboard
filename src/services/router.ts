/* ============================================================
 * AI 路由：一句话 → 判断进哪个模块 → actions[] → 落库
 * 缺关键信息时让模型先输出 question 追问，一次只说一件事
 * ============================================================ */
import type { DB, HabitKind, MediaStatus, MediaType } from '../types';
import { HABIT_COLORS } from '../types';
import { monthOf, relCN, todayKey, uid } from './dates';

/* ---------- 动作类型 ---------- */
export type AiAction =
  | { kind: 'money'; flow: '支出' | '收入'; amount: number; category?: string; date?: string; note?: string }
  | { kind: 'habit'; name: string; hkind?: HabitKind; value?: number; unit?: string; date?: string }
  | { kind: 'media'; name: string; type?: MediaType; status?: MediaStatus; rating?: number; date?: string; review?: string }
  | { kind: 'fitness'; date?: string; weight?: number; bodyFat?: number; calories?: number; minutes?: number; note?: string }
  | { kind: 'buy'; name: string; category?: string; qty?: number; price?: number; priority?: '急需' | '有空买' | '等等再买'; date?: string; note?: string; bought?: boolean };

export interface AiReply {
  ok?: string;
  question?: string;
  actions?: AiAction[];
}

/* ---------- 系统提示词 ---------- */
export function buildSystemPrompt(db: DB, brand: string): string {
  const today = todayKey();
  const month = monthOf(today);
  const monthTx = db.txs.filter((t) => monthOf(t.date) === month);
  const exp = monthTx.filter((t) => t.flow === '支出').reduce((s, t) => s + t.amount, 0);
  const inc = monthTx.filter((t) => t.flow === '收入').reduce((s, t) => s + t.amount, 0);
  const habits = db.habits.map((h) => `${h.name}(${h.kind}${h.unit ? '·' + h.unit : ''})`).join('、') || '（无）';
  const media = db.media.map((m) => `${m.name}(${m.type}·${m.status})`).join('、') || '（无）';
  const buys = db.buys.filter((b) => b.status === '待买').map((b) => b.name).join('、') || '（无）';

  return `你是《${brand}》里的生活记录助手。用户会像聊天一样口述今天或过去的事，你要把它们整理成**可落库的结构化动作**，绝不写长篇日记。

【今天】${today}

【当前数据摘要】
- 本月收支：支出 ¥${exp.toFixed(0)} / 收入 ¥${inc.toFixed(0)}；流水分类有：餐饮/交通/日用/服饰/数码/娱乐/医疗/学习/人情/其他（支出），工资/兼职/理财/红包/其他（收入）
- 已有习惯：${habits}
- 书影音库：${media}
- 待买清单里有：${buys}

【规则】
1. 一句话里可能有多个动作（如"午饭18块，晚上练字2页"）→ 拆成多个 action 一次输出。
2. 金额单位默认元；日期未说默认今天，说"昨天"就用昨天的日期。
3. 关键信息缺失时要先追问，不要猜：例如只报分类说不出金额、书影音说不出是"书/电影/剧/番"、健身没给任何数值。
4. 已有的习惯/书影音/待买，**按名称对上就用它**（改状态/加数值），不要新建重复。
5. 待买：说"买了XX"默认是已买清单项（bought:true）；说"要买/想买XX"才是新增待买。**标记"已买"只需名称：没报价格/数量也直接置已买，不要为此追问金额。**
6. 严格只输出一个 JSON（不要输出 JSON 以外的任何文字）：
   - 全部缺关键信息、需要追问：{"question":"一句自然的追问"}
   - 全部可以落库：{"ok":"用一句话中文小结做了什么","actions":[{"kind":"money|habit|media|fitness|buy", ...}]}
   - 一句话里**部分能落库、部分缺关键信息**：把确定的放进 actions 落库，同时附 question 追问缺的那部分：{"ok":"小结已记下的内容","question":"追问缺失部分的一句话","actions":[...]}
   action 字段：
   money: {"kind":"money","flow":"支出|收入","amount":数字,"category":"餐饮等","date":"YYYY-MM-DD","note":"备注"}
   habit: {"kind":"habit","name":"习惯名","hkind":"check|count|number","value":数字,"unit":"页等","date":"YYYY-MM-DD"}
   media: {"kind":"media","name":"名称","type":"电影|剧集|书籍|番剧","status":"想看|在看|看完|弃了","rating":0-5,"date":"YYYY-MM-DD","review":"短评"}
   fitness: {"kind":"fitness","date":"YYYY-MM-DD","weight":69.5,"bodyFat":20.1,"calories":1800,"minutes":35,"note":"备注"}（体重单位kg，有哪个填哪个）
   buy: {"kind":"buy","name":"物品","category":"日用品","qty":1,"price":数字,"priority":"急需|有空买|等等再买","bought":true|false,"note":"备注"}
7. 不要输出 JSON 以外的任何文字。`;
}

/* ---------- JSON 提取与解析 ---------- */
export function parseReply(text: string): AiReply | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (!obj || typeof obj !== 'object') return null;
    return obj as AiReply;
  } catch {
    return null;
  }
}

/* ---------- 动作落库 ---------- */
export function applyActions(db: DB, actions: AiAction[]): { db: DB; logs: string[] } {
  const next: DB = {
    ...db,
    txs: db.txs.map((item) => ({ ...item })),
    habits: db.habits.map((item) => ({ ...item })),
    checks: db.checks.map((item) => ({ ...item })),
    goal: db.goal ? { ...db.goal } : null,
    fitness: db.fitness.map((item) => ({ ...item })),
    buys: db.buys.map((item) => ({ ...item })),
    media: db.media.map((item) => ({ ...item })),
  };
  const logs: string[] = [];
  const today = todayKey();
  const validDate = (d?: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d! : today);

  for (const a of actions) {
    if (!a) continue;
    try {
      if (a.kind === 'money') {
        if (!a.amount || a.amount <= 0) {
          logs.push(`⚠️ 跳过一笔流水：金额缺失（${a.flow}）`);
          continue;
        }
        next.txs.unshift({
          id: uid(),
          flow: a.flow,
          amount: Math.round(a.amount * 100) / 100,
          category: a.category || '其他',
          date: validDate(a.date),
          note: a.note || '',
        });
        logs.push(`✓ 记${a.flow} ¥${a.amount}${a.category ? '（' + a.category + '）' : ''}`);
      } else if (a.kind === 'habit') {
        const name = (a.name || '').trim();
        if (!name) continue;
        let habit = next.habits.find((h) => h.name === name || h.name.includes(name) || name.includes(h.name));
        const date = validDate(a.date);
        if (!habit) {
          habit = {
            id: uid(),
            name,
            kind: a.hkind === undefined ? (a.value !== undefined ? 'number' : 'check') : a.hkind,
            unit: a.unit || '',
            color: HABIT_COLORS[next.habits.length % HABIT_COLORS.length],
          };
          next.habits.push(habit);
          logs.push(`✓ 新建习惯「${name}」并打卡`);
        }
        const value = a.value !== undefined ? a.value : 1;
        const idx = next.checks.findIndex((c) => c.habitId === habit.id && c.date === date);
        if (idx >= 0) next.checks[idx] = { ...next.checks[idx], value };
        else next.checks.push({ id: uid(), habitId: habit.id, date, value });
        logs.push(`✓ 「${name}」${relCN(date)}${habit.kind === 'check' ? '完成打卡' : ` +${value}${habit.unit || ''}`}`);
      } else if (a.kind === 'media') {
        const name = (a.name || '').trim();
        if (!name) continue;
        const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
        let item = next.media.find((m) => m.name === name || norm(m.name) === norm(name) || norm(m.name).includes(norm(name)) || norm(name).includes(norm(m.name)));
        if (!item) {
          item = { id: uid(), name, type: a.type || '电影', status: a.status || '想看', rating: a.rating || 0, review: a.review || '', date: a.date };
          next.media.push(item);
          logs.push(`✓ 书影音新增《${name}》`);
        }
        if (a.type) item.type = a.type;
        if (a.status) item.status = a.status;
        if (a.rating !== undefined && a.rating !== null) item.rating = Math.max(0, Math.min(5, Number(a.rating) || 0));
        if (a.review) item.review = a.review;
        if (a.date) item.date = a.date;
        else if (a.status === '看完' && !item.date) item.date = today;
        logs.push(`✓ 《${name}》→ ${item.status}${item.rating ? ' · ' + item.rating + ' 星' : ''}${item.review ? '（' + item.review + '）' : ''}`);
      } else if (a.kind === 'fitness') {
        const date = validDate(a.date);
        const has = a.weight || a.bodyFat || a.calories || a.minutes;
        if (!has) {
          logs.push('⚠️ 身体日志：没有数值可记');
          continue;
        }
        const idx = next.fitness.findIndex((f) => f.date === date);
        if (idx >= 0) {
          next.fitness[idx] = {
            ...next.fitness[idx],
            ...(a.weight !== undefined ? { weight: a.weight } : {}),
            ...(a.bodyFat !== undefined ? { bodyFat: a.bodyFat } : {}),
            ...(a.calories !== undefined ? { calories: a.calories } : {}),
            ...(a.minutes !== undefined ? { minutes: a.minutes } : {}),
            note: a.note || next.fitness[idx].note,
          };
        } else {
          next.fitness.push({ id: uid(), date, weight: a.weight, bodyFat: a.bodyFat, calories: a.calories, minutes: a.minutes, note: a.note || '' });
        }
        const bits: string[] = [];
        if (a.weight !== undefined) bits.push(`${a.weight}kg`);
        if (a.bodyFat !== undefined) bits.push(`体脂${a.bodyFat}%`);
        if (a.minutes !== undefined) bits.push(`运动${a.minutes}min`);
        if (a.calories !== undefined) bits.push(`摄入${a.calories}kcal`);
        logs.push(`✓ 身体日志${relCN(date)}：${bits.join(' · ')}`);
        if (!next.goal && a.weight) next.goal = { start: a.weight, target: a.weight };
      } else if (a.kind === 'buy') {
        const name = (a.name || '').trim();
        if (!name) continue;
        const date = validDate(a.date);
        const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
        let item = next.buys.find((b) => norm(b.name) === norm(name) || norm(b.name).includes(norm(name)) || norm(name).includes(norm(b.name)));
        if (!item) {
          item = {
            id: uid(),
            name,
            category: a.category || '其他',
            qty: a.qty || 1,
            price: a.price || 0,
            priority: a.priority || '有空买',
            note: a.note || '',
            status: '待买',
          };
          next.buys.push(item);
          logs.push(`✓ 待买清单新增「${name}」`);
        }
        if (a.price) item.price = a.price;
        if (a.qty) item.qty = a.qty;
        if (a.priority) item.priority = a.priority;
        if (a.bought) {
          item.status = '已买';
          item.boughtDate = date;
          logs.push(`✓ 「${name}」已买到手（${date}）`);
        }
      }
    } catch (e: any) {
      logs.push('⚠️ 处理动作失败：' + String(e?.message || e));
    }
  }
  return { db: next, logs };
}
