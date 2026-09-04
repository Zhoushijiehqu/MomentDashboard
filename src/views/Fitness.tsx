/* 减脂健身：体重/体脂趋势 + 目标进度 + 身体日志 */
import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { addDays, fmtCN, todayKey, uid } from '../services/dates';
import { NumInput, Stat } from '../widgets';

interface Pt { x: number; y: number; date: string }

export default function Fitness() {
  const { db, setDb, toast } = useApp();
  const today = todayKey();
  const [editing, setEditing] = useState(false);
  const [fWeight, setFWeight] = useState(0);
  const [fBodyFat, setFBodyFat] = useState(0);
  const [fCal, setFCal] = useState(0);
  const [fMin, setFMin] = useState(0);
  const [fDate, setFDate] = useState(today);
  const [goalStart, setGoalStart] = useState(db.goal?.start || 0);
  const [goalTarget, setGoalTarget] = useState(db.goal?.target || 0);

  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of [...db.fitness].sort((a, b) => a.date.localeCompare(b.date))) {
      if (f.weight !== undefined) map.set(f.date, f.weight);
    }
    return map;
  }, [db.fitness]);
  const last = [...db.fitness].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
  const current = last?.weight;
  const goal = db.goal;

  const donePct = useMemo(() => {
    if (!goal || current === undefined || goal.start === goal.target) return null;
    return Math.max(0, Math.min(100, ((goal.start - current) / (goal.start - goal.target)) * 100));
  }, [goal, current]);

  const curve = useMemo<Pt[]>(() => {
    const W = 42;
    const out: Pt[] = [];
    for (let i = W - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      const w = byDate.get(date);
      if (w !== undefined) out.push({ x: i, y: w, date });
    }
    return out;
  }, [byDate, today]);

  // 趋势图数据
  const chart = useMemo(() => {
    if (curve.length < 2) return null;
    const ys = [...curve.map((p) => p.y)];
    if (goal) { ys.push(goal.start, goal.target); }
    const lo = Math.floor(Math.min(...ys)) - 0.6;
    const hi = Math.ceil(Math.max(...ys)) + 0.6;
    const W = 100, H = 40, PAD = 2;
    const X = (i: number) => PAD + (i / (curve.length - 1)) * (W - PAD * 2);
    const Y = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - PAD * 2);
    const pts = curve.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`);
    const line = pts.join(' ');
    const area = `${line} ${X(curve[curve.length - 1].x).toFixed(1)},${H} ${X(curve[0].x).toFixed(1)},${H}`;
    return { line, area, targetY: goal ? Y(goal.target) : null };
  }, [curve, goal]);

  const save = () => {
    const has = fWeight > 0 || fBodyFat > 0 || fCal > 0 || fMin > 0;
    if (!has) { toast('至少填一项数值', 'err'); return; }
    setDb((p) => {
      const idx = p.fitness.findIndex((f) => f.date === fDate);
      const patch = {
        ...(fWeight > 0 ? { weight: fWeight } : {}),
        ...(fBodyFat > 0 ? { bodyFat: fBodyFat } : {}),
        ...(fCal > 0 ? { calories: fCal } : {}),
        ...(fMin > 0 ? { minutes: fMin } : {}),
      };
      if (idx >= 0) {
        const arr = [...p.fitness];
        arr[idx] = { ...arr[idx], ...patch };
        return { ...p, fitness: arr };
      }
      return { ...p, fitness: [...p.fitness, { id: uid(), date: fDate, note: '', ...patch }] };
    });
    setFWeight(0); setFBodyFat(0); setFCal(0); setFMin(0);
    setEditing(false);
    toast('身体日志已保存');
  };

  const saveGoal = () => {
    if (!(goalStart > 0) || !(goalTarget > 0)) { toast('目标数值要 > 0', 'err'); return; }
    setDb((p) => ({ ...p, goal: { start: goalStart, target: goalTarget } }));
    setEditing(false);
    toast('减脂目标已更新');
  };

  const del = (id: string) => setDb((p) => ({ ...p, fitness: p.fitness.filter((f) => f.id !== id) }));
  const bmi = current ? current / (1.75 * 1.75) : null;

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">减脂健身</p>
          <h1 className="mt-1 text-[24px] font-semibold">照顾好这具身体。</h1>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(true); setFDate(today); }}>＋ 记身体日志</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="当前体重" value={current !== undefined ? current.toFixed(1) : '—'} unit="kg" tone="var(--accent)" sub={last ? '最近 ' + fmtCN(last.date) : '还没有记录'} />
        <Stat label="目标进度" value={donePct !== null ? donePct.toFixed(0) + '%' : '—'} sub={goal ? `${goal.start} → ${goal.target} kg` : '先设个目标'} tone="var(--sage)" />
        <Stat label="BMI" value={bmi ? bmi.toFixed(1) : '—'} sub="按身高 1.75m 估算" />
        <Stat label="距目标" value={goal && current !== undefined ? (current - goal.target).toFixed(1) : '—'} unit="kg" sub={goal && current !== undefined && current <= goal.target ? '已达成 🎉' : '继续加油'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 目标 */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">目标设置</h2>
            {goal ? <button className="btn btn-quiet !py-0.5 text-[12px]" onClick={() => { setGoalStart(goal.start); setGoalTarget(goal.target); setEditing(true); }}>修改</button> : null}
          </div>
          {editing ? (
            <div className="space-y-2.5">
              <label className="block text-[12px]" style={{ color: 'var(--muted)' }}>起点体重 (kg)</label>
              <NumInput value={goalStart || ''} onValue={setGoalStart} step={0.1} />
              <label className="block text-[12px]" style={{ color: 'var(--muted)' }}>目标体重 (kg)</label>
              <NumInput value={goalTarget || ''} onValue={setGoalTarget} step={0.1} />
              <button className="btn btn-primary w-full" onClick={saveGoal}>保存目标</button>
            </div>
          ) : goal ? (
            <>
              <div className="mb-1.5 flex justify-between text-[12px]" style={{ color: 'var(--muted)' }}>
                <span>{goal.start} → {goal.target} kg</span>
                <span>{donePct !== null ? donePct.toFixed(0) : 0}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(120,100,60,.14)' }}>
                <div className="h-full rounded-full" style={{ width: `${donePct ?? 0}%`, background: 'linear-gradient(90deg,var(--gold),var(--accent))' }} />
              </div>
              {current !== undefined ? (
                <p className="mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>
                  已减 {Math.max(0, goal.start - current).toFixed(1)} kg，还需 {Math.max(0, current - goal.target).toFixed(1)} kg
                </p>
              ) : null}
            </>
          ) : (
            <button className="btn btn-soft w-full" onClick={() => setEditing(true)}>设定减脂目标</button>
          )}
          <div className="mt-4 border-t pt-3 text-[11.5px] leading-relaxed" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
            💡 每周约减 0.3–0.5kg 比较健康；记录后它会替你算进度。
          </div>
        </div>

        {/* 趋势 */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-2 text-[15px] font-semibold">体重趋势（近 6 周）</h2>
          {chart ? (
            <svg viewBox="0 0 100 42" className="w-full" preserveAspectRatio="none" style={{ height: 168 }}>
              <defs>
                <linearGradient id="wt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b85c38" stopOpacity=".28" />
                  <stop offset="100%" stopColor="#b85c38" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" x2="100" y1={42 * f} y2={42 * f} stroke="rgba(120,100,60,.09)" strokeDasharray="1.5 2.5" />
              ))}
              {chart.targetY !== null ? (
                <line x1="0" x2="100" y1={chart.targetY} y2={chart.targetY} stroke="rgba(113,128,95,.75)" strokeWidth="0.7" strokeDasharray="2.5 2.5" />
              ) : null}
              <polygon points={chart.area} fill="url(#wt)" />
              <polyline points={chart.line} fill="none" stroke="#b85c38" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <p className="py-10 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>记录几次体重后，这里会出现趋势曲线。</p>
          )}
          {goal ? <p className="mt-1 text-[11px]" style={{ color: 'var(--sage)' }}>绿色虚线 = 目标体重</p> : null}
        </div>
      </div>

      {/* 身体日志 */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-[15px] font-semibold">身体日志</h2>
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className="field !w-[124px] !py-1.5" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              <NumInput value={fWeight || ''} onValue={setFWeight} placeholder="体重kg" step={0.1} />
              <NumInput value={fBodyFat || ''} onValue={setFBodyFat} placeholder="体脂%" step={0.1} />
              <NumInput value={fCal || ''} onValue={setFCal} placeholder="热量kcal" />
              <NumInput value={fMin || ''} onValue={setFMin} placeholder="运动min" />
              <button className="btn btn-primary !py-1.5 text-[12px]" onClick={save}>保存</button>
              <button className="btn btn-quiet !py-1.5 text-[12px]" onClick={() => setEditing(false)}>取消</button>
            </div>
          ) : null}
        </div>
        {db.fitness.length ? (
          <ul className="max-h-[420px] divide-y divide-dashed overflow-y-auto">
            {[...db.fitness].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).map((f) => (
              <li key={f.id} className="group flex items-center gap-4 px-5 py-2.5 text-[13px]">
                <span className="w-20 flex-none" style={{ color: 'var(--muted)' }}>{fmtCN(f.date)}</span>
                <span className="flex flex-1 flex-wrap gap-x-4 gap-y-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {f.weight !== undefined ? <span><b className="num" style={{ color: 'var(--accent)' }}>{f.weight}</b> kg</span> : null}
                  {f.bodyFat !== undefined ? <span><b className="num">{f.bodyFat}</b>% 体脂</span> : null}
                  {f.minutes !== undefined ? <span>🏃 {f.minutes} min</span> : null}
                  {f.calories !== undefined ? <span>🍚 {f.calories} kcal</span> : null}
                  {f.note ? <span style={{ color: 'var(--muted)' }}>{f.note}</span> : null}
                </span>
                <button className="btn btn-quiet !px-1.5 !py-0 text-[12px] opacity-0 group-hover:opacity-100" onClick={() => del(f.id)}>✕</button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>
            还没有身体日志。可以每天对它说一句“体重 69.2，体脂 21”。
          </div>
        )}
      </div>
    </div>
  );
}
