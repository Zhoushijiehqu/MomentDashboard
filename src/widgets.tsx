/* 共享控件与轻量 SVG 图表 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from './state';

/* ---------- 模态 ---------- */
export function Modal({
  title, onClose, children, footer, width = 640,
}: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card fade-in flex max-h-[88vh] w-full flex-col overflow-hidden" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-3.5" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
          <button className="btn btn-quiet !px-2 !py-0.5 text-[15px]" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--line)' }}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
      className="relative h-[22px] w-[42px] rounded-full transition-colors"
      style={{ background: on ? 'var(--sage)' : 'rgba(120,100,60,.2)' }}>
      <span className="absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all shadow"
        style={{ left: on ? 22 : 3 }} />
    </button>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="inline-block animate-spin rounded-full" style={{ width: size, height: size, border: '2px solid rgba(184,92,56,.2)', borderTopColor: 'var(--accent)' }} />;
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="fade-in flex items-center gap-2 rounded-full px-4 py-2 text-[13px] shadow-lg"
          style={{ background: t.kind === 'err' ? '#7d2f22' : '#57472f', color: '#faf5ea' }}>
          {t.kind === 'err' ? '⚠️' : '✓'} {t.text}
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, unit, sub, tone }: { label: string; value: ReactNode; unit?: string; sub?: string; tone?: string }) {
  return (
    <div className="card card-hover p-4">
      <p className="eyebrow mb-1">{label}</p>
      <p className="flex items-baseline gap-1">
        <span className="num text-[24px] leading-none" style={{ color: tone || 'var(--ink)' }}>{value}</span>
        {unit ? <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{unit}</span> : null}
      </p>
      {sub ? <p className="mt-1 text-[11.5px]" style={{ color: 'var(--muted)' }}>{sub}</p> : null}
    </div>
  );
}

/* ---------- 环形占比图（消费结构） ---------- */
export function Donut({ data, centerLabel, centerValue, height = 150 }: { data: { label: string; value: number; color: string }[]; centerLabel?: string; centerValue?: string; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 40, cx = 60, cy = 60;
  const P = Math.PI * 2 * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <svg viewBox="0 0 120 120" style={{ width: 130, height: 130 }} className="flex-none">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(120,100,60,.12)" strokeWidth="13" />
        {total > 0
          ? data.filter((d) => d.value > 0).map((d, i) => {
              const frac = d.value / total;
              const dash = frac * P;
              const off = -acc * P - P * 0.25;
              acc += frac;
              return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="13" strokeDasharray={`${Math.max(dash - 1.5, 0.6)} ${P - dash + 1.5}`} strokeDashoffset={off} strokeLinecap="butt" />;
            })
          : null}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">{centerValue ?? ''}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8" fill="var(--muted)">{centerLabel ?? ''}</text>
      </svg>
      {data.filter((d) => d.value > 0).length ? (
        <ul className="min-w-[120px] space-y-1.5">
          {data.filter((d) => d.value > 0).map((d, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-soft)' }}>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              <span className="flex-1">{d.label}</span>
              <span className="num" style={{ color: 'var(--ink)' }}>{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------- 7 日柱状/面积小图 ---------- */
export function MiniBars({ values, color, labels }: { values: number[]; color: string; labels?: string[] }) {
  const max = Math.max(...values, 1);
  const n = values.length;
  return (
    <div className="flex h-[54px] items-end gap-[5px]">
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(4, (v / max) * 48) : 2;
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end" title={labels?.[i] ?? ''}>
            <div className="w-full rounded-t-[5px] transition-all" style={{ height: h, background: `linear-gradient(180deg, ${color}, ${color}66)` }} />
          </div>
        );
      })}
    </div>
  );
}

/* 数字输入受控 */
export function NumInput({ value, onValue, placeholder, min = 0, step }: { value: number | ''; onValue: (n: number) => void; placeholder?: string; min?: number; step?: number }) {
  const [txt, setTxt] = useState(value === '' ? '' : String(value));
  useEffect(() => setTxt(value === '' ? '' : String(value)), [value]);
  return (
    <input
      type="number" className="field" min={min} step={step}
      placeholder={placeholder}
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = Number(e.target.value);
        onValue(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}

/* 选择条（分段） */
export function Seg<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl p-0.5" style={{ background: 'rgba(120,100,60,.1)' }}>
      {options.map((o) => (
        <button key={o} type="button" className="rounded-[10px] px-3 py-1.5 text-[12px] transition"
          style={o === value ? { background: '#fff', boxShadow: '0 1px 4px rgba(90,72,40,.15)', color: 'var(--accent-deep)', fontWeight: 600 } : { color: 'var(--muted)' }}
          onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export const fmtMoney = (n: number) => (Number.isFinite(n) ? (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(n % 1 === 0 ? 0 : 1)) : '0');
