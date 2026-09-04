/* 习惯健康：打卡 + 连续/完成率 + 近12周热力图 + 习惯管理 */
import { useMemo, useState } from 'react';
import { useApp } from '../state';
import type { Habit, HabitKind } from '../types';
import { HABIT_COLORS } from '../types';
import { addDays, todayKey, uid } from '../services/dates';
import { MiniBars, Stat } from '../widgets';

const KINDS: { key: HabitKind; label: string }[] = [
  { key: 'check', label: '✓ 做了没' },
  { key: 'count', label: '♯ 计数' },
  { key: 'number', label: '# 数值' },
];

export default function Habits() {
  const { db, setDb, toast } = useApp();
  const today = todayKey();
  const [selId, setSelId] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [fName, setFName] = useState('');
  const [fKind, setFKind] = useState<HabitKind>('check');
  const [fUnit, setFUnit] = useState('');
  const [fColor, setFColor] = useState(HABIT_COLORS[0]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const selected: Habit | 'all' = selId === 'all' ? 'all' : db.habits.find((h) => h.id === selId) || 'all';

  const checksOf = (hid: string) => db.checks.filter((c) => c.habitId === hid);
  const valueOn = (hid: string, date: string) => db.checks.find((c) => c.habitId === hid && c.date === date)?.value ?? 0;

  const stats = useMemo(() => {
    let doneToday = 0, streakBest = 0;
    for (const h of db.habits) {
      const days = new Set(checksOf(h.id).filter((c) => c.value > 0).map((c) => c.date));
      if (days.has(today)) doneToday++;
      let cur = 0;
      const d = new Date();
      for (let i = 0; i < 500; i++) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (days.has(k)) { cur++; streakBest = Math.max(streakBest, cur); } else cur = 0;
        d.setDate(d.getDate() - 1);
      }
    }
    return { doneToday, streakBest };
  }, [db, today]);

  const addHabit = () => {
    const name = fName.trim();
    if (!name) { toast('给习惯起个名字', 'err'); return; }
    setDb((p) => ({
      ...p,
      habits: [...p.habits, { id: uid(), name, kind: fKind, unit: fUnit.trim(), color: fColor }],
    }));
    setFName(''); setFUnit(''); setAdding(false);
    toast('已添加习惯「' + name + '」');
  };

  const delHabit = (id: string) => {
    setDb((p) => ({ ...p, habits: p.habits.filter((h) => h.id !== id), checks: p.checks.filter((c) => c.habitId !== id) }));
    if (selId === id) setSelId('all');
    setConfirmDel(null);
    toast('已删除该习惯及其打卡记录');
  };

  const check = (h: Habit, addValue: number) => {
    const date = today;
    setDb((p) => {
      const cur = p.checks.find((c) => c.habitId === h.id && c.date === date);
      const others = p.checks.filter((c) => !(c.habitId === h.id && c.date === date));
      const nextVal =
        h.kind === 'check' ? (cur ? 0 : 1) : addValue !== 0 ? Math.max(0, (cur?.value ?? 0) + addValue) : cur?.value ? 0 : 1;
      return { ...p, checks: [...others, ...(nextVal > 0 ? [{ id: uid(), habitId: h.id, date, value: nextVal }] : [])] };
    });
  };

  const weeks = 12;
  const grid = useMemo(() => {
    const days = addDays(today, -(weeks * 7 - 1));
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < weeks * 7; i++) {
      const dd = new Date(days);
      dd.setDate(dd.getDate() + i);
      out.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`);
    }
    return out;
  }, [today]);

  const heat = (hid: string, date: string) => valueOn(hid, date);

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">习惯健康</p>
          <h1 className="mt-1 text-[24px] font-semibold">日拱一卒，慢慢成林。</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>{adding ? '收起' : '＋ 新增习惯'}</button>
      </div>

      {adding ? (
        <div className="card slide-up flex flex-wrap items-center gap-2 p-4">
          <input className="field !w-44" placeholder="习惯名，如 练字" value={fName} onChange={(e) => setFName(e.target.value)} />
          <select className="field !w-32" value={fKind} onChange={(e) => setFKind(e.target.value as HabitKind)}>
            {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          {fKind !== 'check' ? <input className="field !w-24" placeholder="单位 页/次" value={fUnit} onChange={(e) => setFUnit(e.target.value)} /> : null}
          <div className="flex items-center gap-1.5">
            {HABIT_COLORS.map((c) => (
              <button key={c} className="h-6 w-6 rounded-full transition" style={{ background: c, outline: fColor === c ? '2px solid var(--ink)' : 'none', outlineOffset: 2 }} onClick={() => setFColor(c)} />
            ))}
          </div>
          <button className="btn btn-primary" onClick={addHabit}>保存习惯</button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="今日完成" value={`${stats.doneToday}/${db.habits.length}`} sub="今日打卡" tone="var(--accent)" />
        <Stat label="最佳连续" value={stats.streakBest} unit="天" sub="任意习惯最长连续" tone="var(--sage)" />
        <Stat label="习惯总数" value={db.habits.length} sub="在坚持的习惯" />
        <Stat label="近30天完成率" value={compute30(db)} unit="%" sub="按天·任一习惯" tone="var(--gold)" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 今日打卡 */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-3 text-[15px] font-semibold">今日打卡</h2>
          <div className="space-y-2">
            {db.habits.map((h) => {
              const v = valueOn(h.id, today);
              return (
                <div key={h.id} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: v > 0 ? h.color + '55' : 'var(--line)', background: v > 0 ? h.color + '0d' : undefined }}>
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[15px]" style={{ background: h.color + '22' }}>{h.kind === 'check' ? '✓' : '↗'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{h.name}</p>
                    <p className="text-[11px]" style={{ color: v > 0 ? h.color : 'var(--muted)' }}>
                      {h.kind === 'check' ? (v > 0 ? '已完成' : '待打卡') : `今日 ${v}${h.unit || ''}`}
                    </p>
                  </div>
                  {h.kind === 'check' ? (
                    <button className="btn !px-2.5 !py-1.5 text-[12px]" style={v > 0 ? { background: h.color, border: 'none', color: '#fff' } : {}} onClick={() => check(h, 0)}>{v > 0 ? '✓' : '打卡'}</button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button className="btn btn-quiet !px-2 !py-1 text-[13px]" onClick={() => check(h, -1)}>−</button>
                      <button className="btn btn-soft !px-2.5 !py-1 text-[12px]" onClick={() => check(h, 1)}>＋</button>
                    </div>
                  )}
                </div>
              );
            })}
            {!db.habits.length ? <p className="py-6 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>还没有习惯，点右上角添加。</p> : null}
          </div>
        </div>

        {/* 热力图 + 列表 */}
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">近 12 周热力图</h2>
              <select className="field !w-40 !py-1.5" value={selId} onChange={(e) => setSelId(e.target.value)}>
                <option value="all">全部习惯</option>
                {db.habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="flex gap-[3px]">
              {Array.from({ length: weeks }).map((_, w) => (
                <div key={w} className="flex flex-1 flex-col gap-[3px]">
                  {grid.slice(w * 7, w * 7 + 7).map((date, di) => {
                    const isAll = selected === 'all';
                    const val = isAll ? (db.habits.some((h) => heat(h.id, date) > 0) ? 1 : 0) : heat((selected as Habit).id, date);
                    const isToday = date === today;
                    let bg = 'rgba(120,100,60,.08)';
                    if (isAll) {
                      if (val > 0) bg = 'rgba(113,128,95,.75)';
                    } else {
                      const s = selected as Habit;
                      const raw = val;
                      if (s.kind === 'check') { if (raw > 0) bg = s.color; }
                      else {
                        const max = Math.max(...checksOf(s.id).map((c) => c.value), 1);
                        const r = Math.min(1, raw / max);
                        if (r > 0) bg = s.color + Math.round(30 + r * 60).toString(16).padStart(2, '0');
                      }
                    }
                    return <div key={di} className="aspect-square w-full rounded-[3px]" style={{ background: bg, outline: isToday ? '1.5px solid var(--accent)' : 'none', outlineOffset: 1 }} title={date} />;
                  })}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>一格 = 一天；{selected === 'all' ? '颜色深=当天完成过任一习惯' : '颜色深浅 = 当日完成量'}</p>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
              <h2 className="text-[15px] font-semibold">习惯管理</h2>
            </div>
            <ul className="divide-y divide-dashed">
              {db.habits.map((h) => {
                const cs = checksOf(h.id);
                const days = new Set(cs.filter((c) => c.value > 0).map((c) => c.date));
                const last7 = Array.from({ length: 7 }).map((_, i) => {
                  const date = addDays(today, -(6 - i));
                  return cs.find((c) => c.date === date)?.value ?? 0;
                });
                const best = bestStreak(days);
                const monthDays = cs.filter((c) => c.date.slice(0, 7) === today.slice(0, 7) && c.value > 0).length;
                return (
                  <li key={h.id} className="group flex items-center gap-3 px-5 py-3">
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: h.color }} />
                    <div className="w-24 flex-none">
                      <p className="truncate text-[13.5px] font-medium">{h.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{kindLabel(h)}</p>
                    </div>
                    <div className="w-24 flex-none text-[12px]" style={{ color: 'var(--muted)' }}>
                      本月 {monthDays} 天 · 连{best}天
                    </div>
                    <div className="min-w-[70px] flex-1"><MiniBars values={last7} color={h.color} /></div>
                    {confirmDel === h.id ? (
                      <button className="btn !py-1 text-[12px]" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => delHabit(h.id)}>确认删除</button>
                    ) : (
                      <button className="btn btn-quiet !px-2 !py-1 text-[12px] opacity-0 transition group-hover:opacity-100" onClick={() => { setConfirmDel(h.id); setTimeout(() => setConfirmDel(null), 3000); }}>删除</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function kindLabel(h: Habit): string {
  if (h.kind === 'check') return '每日打卡';
  if (h.kind === 'count') return `累计 · ${h.unit || '次'}`;
  return `数值 · ${h.unit || ''}`;
}

function compute30(db: ReturnType<typeof useApp>['db']): number {
  const today = todayKey();
  let done = 0, total = 0;
  const ids = db.habits.map((h) => h.id);
  for (let i = 29; i >= 0; i--) {
    const date = addDays(today, -i);
    const set = new Set(db.checks.filter((c) => c.date === date && ids.includes(c.habitId) && c.value > 0).map((c) => c.habitId));
    total++;
    if (set.size > 0) done++;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

function bestStreak(days: Set<string>): number {
  let best = 0, cur = 0;
  const d = new Date();
  for (let i = 0; i < 500; i++) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (days.has(k)) { cur++; best = Math.max(best, cur); } else cur = 0;
    d.setDate(d.getDate() - 1);
  }
  return best;
}
