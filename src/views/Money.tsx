/* 记账理财：手账录入 + 月度汇总 + 预算 + 结构 + 流水管理 */
import { useMemo, useState } from 'react';
import { useApp } from '../state';
import type { Flow, Tx } from '../types';
import { EXP_CATS, INC_CATS } from '../types';
import { addDays, fmtCN, monthCN, monthOf, todayKey, uid } from '../services/dates';
import { Donut, MiniBars, NumInput, Seg, Stat, fmtMoney } from '../widgets';

const PALETTE = ['#b85c38', '#7d8c6f', '#a5845a', '#7a5c6e', '#4f7580', '#9a7b4f', '#8a6d3b', '#5b7e8c', '#c2a06a', '#74695a'];

interface Budget { month: string; amount: number }

function loadBudget(): Budget | null {
  try {
    const raw = localStorage.getItem('richangji.budget.v1');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function Money() {
  const { db, setDb, toast } = useApp();
  const month = monthOf(todayKey());
  const [selMonth, setSelMonth] = useState(month);
  const [flow, setFlow] = useState<Flow>('支出');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState(EXP_CATS[0]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayKey());
  const [filter, setFilter] = useState<'全部' | Flow>('全部');
  const [budget, setBudget] = useState<Budget | null>(() => loadBudget());
  const [budgetVal, setBudgetVal] = useState('');

  const rows = useMemo(
    () =>
      db.txs
        .filter((t) => monthOf(t.date) === selMonth && (filter === '全部' || t.flow === filter))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [db.txs, selMonth, filter],
  );

  const sums = useMemo(() => {
    const mtx = db.txs.filter((t) => monthOf(t.date) === selMonth);
    const exp = mtx.filter((t) => t.flow === '支出').reduce((s, t) => s + t.amount, 0);
    const inc = mtx.filter((t) => t.flow === '收入').reduce((s, t) => s + t.amount, 0);
    const cat = new Map<string, number>();
    mtx.filter((t) => t.flow === '支出').forEach((t) => cat.set(t.category, (cat.get(t.category) || 0) + t.amount));
    return { exp, inc, cat };
  }, [db.txs, selMonth]);

  const daysIn = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); })();
  const daily = useMemo(() => {
    const out: number[] = [];
    const [y, m] = selMonth.split('-').map(Number);
    const dim = new Date(y, m, 0).getDate();
    for (let i = 1; i <= dim; i++) {
      const k = `${selMonth}-${String(i).padStart(2, '0')}`;
      out.push(db.txs.filter((t) => t.flow === '支出' && t.date === k).reduce((s, t) => s + t.amount, 0));
    }
    return out;
  }, [db.txs, selMonth]);

  const add = () => {
    if (!(amount > 0)) { toast('金额要大于 0', 'err'); return; }
    const t: Tx = { id: uid(), flow, amount: Math.round(amount * 100) / 100, category, date, note: note.trim() };
    setDb((p) => ({ ...p, txs: [t, ...p.txs] }));
    setAmount(0); setNote('');
    toast(`已记${flow} ¥${t.amount}`);
  };

  const del = (id: string) => setDb((p) => ({ ...p, txs: p.txs.filter((t) => t.id !== id) }));

  const catColor = (c: string) => PALETTE[Math.max(0, EXP_CATS.indexOf(c)) % PALETTE.length];

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">记账理财</p>
          <h1 className="mt-1 text-[24px] font-semibold">{monthCN(selMonth)}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="btn !px-2.5" onClick={() => setSelMonth(addDays(selMonth + '-15', -40).slice(0, 7))}>‹</button>
          <button className="btn btn-soft text-[12px]" onClick={() => setSelMonth(month)} disabled={selMonth === month}>本月</button>
          <button className="btn !px-2.5" onClick={() => setSelMonth(addDays(selMonth + '-15', 40).slice(0, 7))} disabled={selMonth >= month}>›</button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="支出" value={'¥' + sums.exp.toFixed(0)} tone="var(--accent)" />
        <Stat label="收入" value={'¥' + sums.inc.toFixed(0)} tone="var(--sage)" />
        <Stat label="结余" value={'¥' + (sums.inc - sums.exp).toFixed(0)} />
        <Stat label="笔数" value={rows.length} sub="本月流水" />
      </div>

      {/* 预算条 */}
      <div className="card p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold">月度预算</h2>
          {budget && budget.month === selMonth ? (
            <button className="btn btn-quiet !py-0.5 text-[12px]" onClick={() => { setBudget(null); localStorage.removeItem('richangji.budget.v1'); }}>清除预算</button>
          ) : (
            <div className="flex items-center gap-2">
              <input className="field !w-36 !py-1.5" type="number" min={0} placeholder="每月预算 ¥" value={budgetVal} onChange={(e) => setBudgetVal(e.target.value)} />
              <button className="btn btn-primary !py-1.5 text-[12px]" onClick={() => { const v = Number(budgetVal); if (v > 0) { setBudget({ month: selMonth, amount: v }); localStorage.setItem('richangji.budget.v1', JSON.stringify({ month: selMonth, amount: v })); setBudgetVal(''); toast('预算已设置'); } }}>设定</button>
            </div>
          )}
        </div>
        {budget && budget.month === selMonth ? (
          <>
            <div className="mb-1.5 flex justify-between text-[12px]" style={{ color: 'var(--muted)' }}>
              <span>已用 ¥{sums.exp.toFixed(0)} / ¥{budget.amount.toFixed(0)}</span>
              <span>{budget.amount > 0 ? Math.round((sums.exp / budget.amount) * 100) : 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(120,100,60,.14)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, budget.amount > 0 ? (sums.exp / budget.amount) * 100 : 0)}%`, background: sums.exp > budget.amount ? 'var(--accent)' : 'linear-gradient(90deg,var(--sage),#9db38f)' }} />
            </div>
            <p className="mt-1.5 text-[12px]" style={{ color: sums.exp > budget.amount ? 'var(--accent)' : 'var(--muted)' }}>
              {sums.exp > budget.amount ? `已超支 ¥${(sums.exp - budget.amount).toFixed(0)}，悠着点～` : `本月还可花 ¥${(budget.amount - sums.exp).toFixed(0)}`}
            </p>
          </>
        ) : <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>设一个月度预算，帮你盯着钱包。</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 手账 */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-3 text-[15px] font-semibold">记一笔</h2>
          <div className="space-y-2.5">
            <Seg options={['支出', '收入'] as const} value={flow} onChange={(v) => { setFlow(v); setCategory((v === '支出' ? EXP_CATS : INC_CATS)[0]); }} />
            <div className="flex items-center gap-2">
              <span className="text-[18px]" style={{ color: 'var(--muted)' }}>¥</span>
              <NumInput value={amount || ''} onValue={setAmount} placeholder="金额" step={0.01} />
            </div>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {(flow === '支出' ? EXP_CATS : INC_CATS).map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="field" placeholder="备注（可选）" value={note} onChange={(e) => setNote(e.target.value)} />
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn btn-primary w-full" onClick={add}>存入手账</button>
          </div>
        </div>

        {/* 结构 + 每日 */}
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <h2 className="mb-3 text-[15px] font-semibold">本月消费结构</h2>
            <Donut data={Array.from(sums.cat.entries()).map(([label, value]) => ({ label, value, color: catColor(label) }))} centerValue={'¥' + sums.exp.toFixed(0)} centerLabel="支出" />
          </div>
          <div className="card p-5">
            <p className="mb-1 text-[11px]" style={{ color: 'var(--muted)' }}>本月每日支出</p>
            <MiniBars values={daily.slice(0, Math.max(daysIn < 10 ? daysIn : new Date().getDate(), 10))} color="var(--accent)" />
          </div>
        </div>
      </div>

      {/* 流水列表 */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-[15px] font-semibold">流水明细</h2>
          <div className="flex gap-1.5">
            <Seg options={['全部', '支出', '收入'] as const} value={filter} onChange={setFilter} />
          </div>
        </div>
        {rows.length ? (
          <ul className="max-h-[430px] divide-y divide-dashed overflow-y-auto" style={{ ['--tw-divide-opacity' as any]: 1 }}>
            {rows.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 px-5 py-2.5 text-[13px] transition hover:bg-black/[.02]">
                <span className="w-20 flex-none" style={{ color: 'var(--muted)' }}>{fmtCN(t.date)}</span>
                <span className="pill flex-none" style={{ background: t.flow === '支出' ? 'rgba(184,92,56,.1)' : 'rgba(113,128,95,.13)', color: t.flow === '支出' ? 'var(--accent-deep)' : 'var(--sage)' }}>{t.category}</span>
                <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--ink-soft)' }}>{t.note}</span>
                <span className="num flex-none" style={{ color: t.flow === '支出' ? 'var(--accent)' : 'var(--sage)' }}>{t.flow === '支出' ? '-' : '+'}{fmtMoney(t.amount)}</span>
                <button className="btn btn-quiet !px-1.5 !py-0 text-[12px] opacity-0 transition group-hover:opacity-100" onClick={() => del(t.id)} title="删除">✕</button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>这个月还没有流水。让 AI 说一句，或手动画一笔。</div>
        )}
      </div>
    </div>
  );
}
