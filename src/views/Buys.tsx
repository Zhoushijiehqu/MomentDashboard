/* 待买清单：新增/买完/预算估算 */
import { useMemo, useState } from 'react';
import { useApp } from '../state';
import type { Buy, BuyPriority } from '../types';
import { BUY_CATS, BUY_PRIORITIES } from '../types';
import { fmtCN, todayKey, uid } from '../services/dates';
import { NumInput, Seg, Stat } from '../widgets';

const PRI_COLOR: Record<BuyPriority, string> = { 急需: 'var(--accent)', 有空买: 'var(--gold)', 等等再买: 'var(--sage)' };

export default function Buys() {
  const { db, setDb, toast } = useApp();
  const [tab, setTab] = useState<'待买' | '已买'>('待买');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [cat, setCat] = useState(BUY_CATS[0]);
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [priority, setPriority] = useState<BuyPriority>('有空买');

  const pending = useMemo(() => db.buys.filter((b) => b.status === '待买'), [db.buys]);
  const done = useMemo(() => db.buys.filter((b) => b.status === '已买'), [db.buys]);
  const list = tab === '待买' ? pending : done;
  const estTotal = pending.reduce((s, b) => s + b.price * b.qty, 0);

  const add = () => {
    const n = name.trim();
    if (!n) { toast('要买什么？', 'err'); return; }
    const item: Buy = { id: uid(), name: n, category: cat, qty: Math.max(1, qty || 1), price: price || 0, priority, note: '', status: '待买' };
    setDb((p) => ({ ...p, buys: [...p.buys, item] }));
    setName(''); setPrice(0); setQty(1);
    setAdding(false);
    toast('已加入待买清单');
  };

  const markBought = (id: string) => {
    setDb((p) => ({ ...p, buys: p.buys.map((b) => (b.id === id ? { ...b, status: '已买' as const, boughtDate: todayKey() } : b)) }));
    toast('已标记买完 ✓');
  };
  const backToPending = (id: string) => setDb((p) => ({ ...p, buys: p.buys.map((b) => (b.id === id ? { ...b, status: '待买' as const, boughtDate: undefined } : b)) }));
  const del = (id: string) => setDb((p) => ({ ...p, buys: p.buys.filter((b) => b.id !== id) }));
  const setPri = (id: string, pr: BuyPriority) => setDb((p) => ({ ...p, buys: p.buys.map((b) => (b.id === id ? { ...b, priority: pr } : b)) }));

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">待买清单</p>
          <h1 className="mt-1 text-[24px] font-semibold">想要什么，先记下来。</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>{adding ? '收起' : '＋ 记一个想买的'}</button>
      </div>

      {adding ? (
        <div className="card slide-up flex flex-wrap items-center gap-2 p-4">
          <input className="field !w-44" placeholder="物品，如 无线鼠标" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <select className="field !w-28" value={cat} onChange={(e) => setCat(e.target.value)}>{BUY_CATS.map((c) => <option key={c}>{c}</option>)}</select>
          <NumInput value={qty || ''} onValue={setQty} placeholder="数量" />
          <div className="flex items-center"><span className="mr-1" style={{ color: 'var(--muted)' }}>¥</span><NumInput value={price || ''} onValue={setPrice} placeholder="单价" step={0.01} /></div>
          <select className="field !w-28" value={priority} onChange={(e) => setPriority(e.target.value as BuyPriority)}>
            {BUY_PRIORITIES.map((x) => <option key={x}>{x}</option>)}
          </select>
          <button className="btn btn-primary" onClick={add}>加入清单</button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="待买" value={pending.length} unit="件" />
        <Stat label="预计要花" value={'¥' + estTotal.toFixed(0)} sub="未买合计（估）" tone="var(--accent)" />
        <Stat label="本月买到" value={done.length} unit="件" sub="已入手的快乐" tone="var(--sage)" />
        <Stat label="已买花费" value={'¥' + done.reduce((s, b) => s + b.price * b.qty, 0).toFixed(0)} sub="按单价估算" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-[15px] font-semibold">采购清单</h2>
          <Seg options={['待买', '已买'] as const} value={tab} onChange={setTab} />
        </div>
        {list.length ? (
          <ul className="divide-y divide-dashed">
            {list.map((b) => (
              <li key={b.id} className="group flex items-center gap-3 px-5 py-3 text-[13px]">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: PRI_COLOR[b.priority] }} title={b.priority} />
                <div className="w-40 min-w-0 flex-1 truncate">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{b.category} · {b.qty}件{b.boughtDate ? ' · ' + fmtCN(b.boughtDate) + ' 买' : ''}</p>
                </div>
                {tab === '待买' ? (
                  <select className="field !w-24 !py-1 text-[12px]" value={b.priority} onChange={(e) => setPri(b.id, e.target.value as BuyPriority)}>
                    {BUY_PRIORITIES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                ) : null}
                <span className="num w-16 flex-none text-right" style={{ color: b.status === '已买' ? 'var(--sage)' : 'var(--ink)' }}>
                  {b.price > 0 ? '¥' + (b.price * b.qty).toFixed(0) : '—'}
                </span>
                <div className="flex flex-none items-center gap-1.5">
                  {b.status === '待买' ? (
                    <button className="btn btn-soft !px-2.5 !py-1 text-[12px]" onClick={() => markBought(b.id)}>买到了</button>
                  ) : (
                    <button className="btn !px-2.5 !py-1 text-[12px]" onClick={() => backToPending(b.id)}>退回待买</button>
                  )}
                  <button className="btn btn-quiet !px-1.5 !py-0.5 text-[12px] opacity-0 transition group-hover:opacity-100" onClick={() => del(b.id)}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>
            {tab === '待买' ? '清单空空的。对它说“想买个鼠标，89 块”，它就记住了。' : '还没有买过的东西。'}
          </div>
        )}
      </div>
    </div>
  );
}
