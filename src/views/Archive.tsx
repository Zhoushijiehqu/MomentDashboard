/* 时光档案：挑一天，回看那一天的生活 */
import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { addDays, fmtCN, relCN, todayKey } from '../services/dates';

export default function Archive() {
  const { db } = useApp();
  const today = todayKey();
  const [sel, setSel] = useState(today);

  const day = useMemo(() => {
    const habitName = new Map(db.habits.map((h) => [h.id, h]));
    const checks = db.checks
      .filter((c) => c.date === sel)
      .map((c) => ({ habit: habitName.get(c.habitId), value: c.value }))
      .filter((x) => x.habit);
    return {
      txs: db.txs.filter((t) => t.date === sel).sort((a, b) => a.flow === b.flow ? 0 : a.flow === '收入' ? 1 : -1),
      checks,
      fitness: db.fitness.filter((f) => f.date === sel),
      buys: db.buys.filter((b) => b.boughtDate === sel),
      media: db.media.filter((m) => m.date === sel && m.status === '看完'),
    };
  }, [db, sel]);

  const exp = day.txs.filter((t) => t.flow === '支出').reduce((s, t) => s + t.amount, 0);
  const inc = day.txs.filter((t) => t.flow === '收入').reduce((s, t) => s + t.amount, 0);
  const empty = !day.txs.length && !day.checks.length && !day.fitness.length && !day.buys.length && !day.media.length;

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">时光档案</p>
          <h1 className="mt-1 text-[24px] font-semibold">{sel === today ? '今天，值得被记住' : fmtCN(sel)}</h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--muted)' }}>{relCN(sel)} · 每一天都是藏品</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="btn !px-2.5" onClick={() => setSel(addDays(sel, -1))}>‹ 前一天</button>
          <input type="date" className="field !w-[150px] !py-1.5" value={sel} max={today} onChange={(e) => e.target.value && setSel(e.target.value)} />
          <button className="btn btn-soft text-[12px]" onClick={() => setSel(today)} disabled={sel === today}>今天</button>
          <button className="btn !px-2.5" onClick={() => setSel(addDays(sel, 1))} disabled={sel >= today}>后一天 ›</button>
        </div>
      </div>

      {empty ? (
        <div className="card py-14 text-center">
          <p className="text-[30px] opacity-60">🕰️</p>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>这一天还没有留下记录。</p>
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>往后认真生活的每一天，都会被收进这里。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 财务 */}
          {day.txs.length ? (
            <section className="card p-5">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-[14px] font-semibold">💰 账目</h2>
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  支出 ¥{exp.toFixed(0)} · 收入 ¥{inc.toFixed(0)} · 共 {day.txs.length} 笔
                </span>
              </div>
              <ul className="space-y-1.5">
                {day.txs.map((t) => (
                  <li key={t.id} className="kv text-[13px]">
                    <span className="flex items-center gap-2">
                      <span className="pill" style={{ background: t.flow === '支出' ? 'rgba(184,92,56,.1)' : 'rgba(113,128,95,.13)', color: t.flow === '支出' ? 'var(--accent-deep)' : 'var(--sage)' }}>{t.category}</span>
                      {t.note ? <span style={{ color: 'var(--ink-soft)' }}>{t.note}</span> : null}
                    </span>
                    <span className="num" style={{ color: t.flow === '支出' ? 'var(--accent)' : 'var(--sage)' }}>{t.flow === '支出' ? '-' : '+'}{t.amount.toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 习惯 */}
          {day.checks.length ? (
            <section className="card p-5">
              <h2 className="mb-2 text-[14px] font-semibold">⭐ 习惯</h2>
              <div className="flex flex-wrap gap-2">
                {day.checks.map((c, i) => (
                  <span key={i} className="chip" style={{ background: c.habit!.color + '14', borderColor: c.habit!.color + '44' }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: c.habit!.color }} />
                    {c.habit!.name}
                    {c.habit!.kind === 'check' ? ' ✓' : ` ${c.value}${c.habit!.unit || ''}`}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {/* 身体 */}
          {day.fitness.map((f) => (
            <section key={f.id} className="card p-5">
              <h2 className="mb-2 text-[14px] font-semibold">⚖️ 身体</h2>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                {f.weight !== undefined ? <span>体重 <b className="num" style={{ color: 'var(--accent)' }}>{f.weight}</b> kg</span> : null}
                {f.bodyFat !== undefined ? <span>体脂 <b className="num">{f.bodyFat}</b>%</span> : null}
                {f.minutes !== undefined ? <span>运动 {f.minutes} min</span> : null}
                {f.calories !== undefined ? <span>摄入 {f.calories} kcal</span> : null}
              </div>
            </section>
          ))}

          {/* 待买买到了 + 看完 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {day.buys.length ? (
              <section className="card p-5">
                <h2 className="mb-2 text-[14px] font-semibold">🛒 这天买到了</h2>
                <div className="flex flex-wrap gap-2">
                  {day.buys.map((b) => <span key={b.id} className="chip">✓ {b.name}{b.qty > 1 ? ` ×${b.qty}` : ''}</span>)}
                </div>
              </section>
            ) : null}
            {day.media.length ? (
              <section className="card p-5">
                <h2 className="mb-2 text-[14px] font-semibold">📚 这天看完</h2>
                <div className="space-y-1.5">
                  {day.media.map((m) => (
                    <p key={m.id} className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                      《{m.name}》 {m.rating > 0 ? '· '.concat('★'.repeat(Math.round(m.rating))) : ''}
                      {m.review ? <em className="ml-1 text-[12px]" style={{ color: 'var(--muted)' }}>“{m.review}”</em> : null}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
