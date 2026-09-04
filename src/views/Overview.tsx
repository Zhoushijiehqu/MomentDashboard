/* 今日总览：今日/本月聚合 + 最近动态 + 快捷入口 */
import { useMemo } from 'react';
import { useApp } from '../state';
import type { ViewKey } from '../App';
import { fmtCN, monthOf, relCN, todayISOWeekday, todayKey } from '../services/dates';
import { Donut, MiniBars, Stat } from '../widgets';
import { EXP_CATS } from '../types';

const PALETTE = ['#b85c38', '#7d8c6f', '#a5845a', '#7a5c6e', '#4f7580', '#9a7b4f', '#8a6d3b', '#5b7e8c', '#c2a06a', '#74695a'];

export default function Overview({ go }: { go: (v: ViewKey) => void }) {
  const { db, settings } = useApp();
  const today = todayKey();
  const month = monthOf(today);

  const m = useMemo(() => {
    const txs = db.txs.filter((t) => t.date === today);
    const spendToday = txs.filter((t) => t.flow === '支出').reduce((s, t) => s + t.amount, 0);
    const mtx = db.txs.filter((t) => monthOf(t.date) === month);
    const spendM = mtx.filter((t) => t.flow === '支出').reduce((s, t) => s + t.amount, 0);
    const incM = mtx.filter((t) => t.flow === '收入').reduce((s, t) => s + t.amount, 0);
    const habitIds = db.habits.map((h) => h.id);
    const todayChecks = db.checks.filter((c) => c.date === today && habitIds.includes(c.habitId));
    const weekStart = (() => { const d = new Date(); const x = d.getDay(); return x === 0 ? -6 : 1 - x; })();
    let best = 0;
    for (const h of db.habits) {
      const days = new Set(db.checks.filter((c) => c.habitId === h.id && c.value > 0).map((c) => c.date));
      let cur = 0, mx = 0;
      let d = new Date(today);
      for (let i = 0; i < 400; i++) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (days.has(k)) { cur++; mx = Math.max(mx, cur); } else cur = 0;
        d.setDate(d.getDate() - 1);
      }
      best = Math.max(best, mx);
    }
    const inProgress = db.media.filter((m2) => m2.status === '在看').length;
    const wantBuy = db.buys.filter((b) => b.status === '待买');
    const lastFit = [...db.fitness].sort((a, b) => b.date.localeCompare(a.date))[0];
    return { spendToday, spendM, incM, best, todayChecks, inProgress, wantBuy, lastFit };
  }, [db, today, month]);

  const recent = useMemo(
    () => [...db.txs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6),
    [db.txs],
  );
  const todayHabits = db.habits.map((h) => {
    const c = m.todayChecks.find((x) => x.habitId === h.id);
    return { habit: h, done: !!c && c.value > 0, value: c?.value ?? 0 };
  });

  // 本月支出按分类
  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    db.txs.filter((t) => t.flow === '支出' && monthOf(t.date) === month).forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return map;
  }, [db.txs, month]);

  const last14 = useMemo(() => {
    const out: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push(db.txs.filter((t) => t.flow === '支出' && t.date === k).reduce((s, t) => s + t.amount, 0));
    }
    return out;
  }, [db.txs]);

  const catColor = (c: string) => PALETTE[Math.max(0, EXP_CATS.indexOf(c)) % PALETTE.length];

  return (
    <div className="fade-in space-y-5">
      {/* 问候 */}
      <div>
        <p className="eyebrow">{fmtCN(today, true)} · {todayISOWeekday()}</p>
        <h1 className="mt-1 text-[24px] font-semibold" style={{ color: 'var(--ink)' }}>{settings.brandName}，今天，慢慢来。</h1>
      </div>

      {/* AI 快捷口述 */}
      <button
        className="card card-hover group flex w-full items-center gap-4 p-5 text-left"
        onClick={() => go('ai')}
        style={{ background: 'linear-gradient(120deg,#fdf9ee, #f7ead9)' }}
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-[20px] text-white shadow-lg" style={{ background: 'linear-gradient(135deg,var(--accent),#cf7a52)' }}>说</span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>把今天说给它听，自动记账、打卡、入库</span>
          <span className="mt-0.5 block text-[12.5px]" style={{ color: 'var(--muted)' }}>例如：“午饭 18 块”“《鼠疫》看完了，四星”“练字两页”“今天体重 69.2”</span>
        </span>
        <span className="text-[18px] opacity-40 transition group-hover:translate-x-1 group-hover:opacity-80">→</span>
      </button>

      {/* 今日核心数字 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="今日支出" value={'¥' + m.spendToday.toFixed(0)} sub={'本月 ¥' + m.spendM.toFixed(0)} tone="var(--accent)" />
        <Stat label="本月结余" value={'¥' + (m.incM - m.spendM).toFixed(0)} sub={'收入 ¥' + m.incM.toFixed(0)} />
        <Stat label="今日习惯" value={`${m.todayChecks.filter((c) => c.value > 0).length}/${db.habits.length}`} sub={`最长连续 ${m.best} 天`} tone="var(--sage)" />
        <Stat
          label="身体近况"
          value={m.lastFit?.weight !== undefined ? String(m.lastFit.weight) : '—'}
          unit="kg"
          sub={
            m.lastFit && m.lastFit.weight !== undefined
              ? `距目标 ${db.goal ? Math.abs(m.lastFit.weight - db.goal.target).toFixed(1) : '—'} kg`
              : '去记录一次体重'
          }
          tone="var(--plum)"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 今日习惯 */}
        <div className="card card-hover p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">今日习惯</h2>
            <button className="btn btn-soft !px-3 !py-1 text-[12px]" onClick={() => go('habits')}>去打卡 →</button>
          </div>
          {todayHabits.length ? (
            <div className="flex flex-wrap gap-2">
              {todayHabits.map(({ habit, done, value }) => (
                <span key={habit.id} className="chip !py-1.5" style={{ borderColor: done ? habit.color + '66' : undefined, background: done ? habit.color + '18' : undefined }}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: habit.color }} />
                  {habit.name}
                  {done ? <b style={{ color: habit.color }}>{habit.kind === 'check' ? '✓' : ` ${value}${habit.unit}`}</b> : <span className="opacity-50">未打</span>}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>还没有习惯，去「习惯健康」添加一个吧。</p>
          )}
          <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
            <p className="mb-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>近 14 日支出</p>
            <MiniBars values={last14} color="var(--accent)" />
          </div>
        </div>

        {/* 本月支出结构 */}
        <div className="card card-hover p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">本月支出结构</h2>
            <button className="btn btn-soft !px-3 !py-1 text-[12px]" onClick={() => go('money')}>去记账 →</button>
          </div>
          <Donut
            data={Array.from(byCat.entries()).map(([label, value]) => ({ label, value, color: catColor(label) }))}
            centerValue={'¥' + m.spendM.toFixed(0)}
            centerLabel="本月支出"
          />
        </div>
      </div>

      {/* 最近动态 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-hover p-5">
          <h2 className="mb-3 text-[15px] font-semibold">最近流水</h2>
          {recent.length ? (
            <ul className="space-y-2">
              {recent.map((t) => (
                <li key={t.id} className="kv text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="pill" style={{ background: t.flow === '支出' ? 'rgba(184,92,56,.12)' : 'rgba(113,128,95,.14)', color: t.flow === '支出' ? 'var(--accent-deep)' : 'var(--sage)' }}>{t.category}</span>
                    <span style={{ color: 'var(--ink-soft)' }}>{t.note || relCN(t.date)}</span>
                  </span>
                  <span className="num" style={{ color: t.flow === '支出' ? 'var(--accent)' : 'var(--sage)' }}>
                    {t.flow === '支出' ? '-' : '+'}{t.amount.toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>暂无流水。</p>}
        </div>

        <div className="card card-hover p-5">
          <h2 className="mb-3 text-[15px] font-semibold">进行中</h2>
          <ul className="space-y-2 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
            {db.media.filter((m2) => m2.status === '在看').slice(0, 3).map((m2) => (
              <li key={m2.id} className="kv"><span>📖 在看 · {m2.name}</span><button className="btn btn-quiet !py-0 text-[12px]" onClick={() => go('media')}>标记</button></li>
            ))}
            {m.wantBuy.slice(0, 3).map((b) => (
              <li key={b.id} className="kv"><span>🛒 待买 · {b.name}</span><button className="btn btn-quiet !py-0 text-[12px]" onClick={() => go('buys')}>去处理</button></li>
            ))}
            {!db.media.some((m2) => m2.status === '在看') && !m.wantBuy.length ? (
              <li style={{ color: 'var(--muted)' }}>暂无在看/待买。</li>
            ) : null}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
            <button className="btn !py-1.5 text-[12px]" onClick={() => go('money')}>💰 记一笔</button>
            <button className="btn !py-1.5 text-[12px]" onClick={() => go('fitness')}>⚖️ 记体重</button>
            <button className="btn !py-1.5 text-[12px]" onClick={() => go('buys')}>🛒 要买什么</button>
            <button className="btn !py-1.5 text-[12px]" onClick={() => go('media')}>📚 看完入库</button>
          </div>
        </div>
      </div>
    </div>
  );
}
