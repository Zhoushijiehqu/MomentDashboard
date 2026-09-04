/* 书影音：看完就存库 · 封面墙/列表 · 评分短评 · 年度统计 */
import { useMemo, useState } from 'react';
import { useApp } from '../state';
import type { Media, MediaStatus, MediaType } from '../types';
import { MEDIA_STATUSES, MEDIA_TYPES } from '../types';
import { fmtCN, todayKey, uid } from '../services/dates';
import { Modal, Seg, Stat } from '../widgets';

const TYPE_ICON: Record<MediaType, string> = { 电影: '🎬', 剧集: '📺', 书籍: '📖', 番剧: '🌙' };
const STATUS_TONE: Record<MediaStatus, string> = {
  想看: '#4f7580', 在看: '#a5845a', 看完: '#7d8c6f', 弃了: '#8a8578',
};

export default function MediaView() {
  const { db, setDb, toast } = useApp();
  const [type, setType] = useState<'全部' | MediaType>('全部');
  const [status, setStatus] = useState<'全部' | MediaStatus>('全部');
  const [adding, setAdding] = useState(false);
  const [mName, setMName] = useState('');
  const [mType, setMType] = useState<MediaType>('书籍');
  const [mStatus, setMStatus] = useState<MediaStatus>('想看');
  const [mRating, setMRating] = useState(0);
  const [mReview, setMReview] = useState('');

  const list = useMemo(() => db.media.filter((m) => (type === '全部' || m.type === type) && (status === '全部' || m.status === status)), [db.media, type, status]);

  const stats = useMemo(() => {
    const year = String(new Date().getFullYear());
    const done = db.media.filter((m) => m.status === '看完' && (!m.date || m.date.startsWith(year)));
    const rated = db.media.filter((m) => m.rating > 0);
    const avg = rated.length ? rated.reduce((s, m) => s + m.rating, 0) / rated.length : 0;
    const fav = new Map<string, number>();
    done.forEach((m) => fav.set(m.type, (fav.get(m.type) || 0) + 1));
    const best = Array.from(fav.entries()).sort((a, b) => b[1] - a[1])[0];
    return { doneCount: done.length, avg, fav: best ? `${best[0]} ×${best[1]}` : '—' };
  }, [db.media]);

  const setStatusV = (m: Media, s: MediaStatus) => setDb((p) => ({ ...p, media: p.media.map((x) => (x.id === m.id ? { ...x, status: s, date: s === '看完' && !x.date ? todayKey() : x.date } : x)) }));
  const setRatingV = (m: Media, r: number) => setDb((p) => ({ ...p, media: p.media.map((x) => (x.id === m.id ? { ...x, rating: r } : x)) }));
  const del = (id: string) => setDb((p) => ({ ...p, media: p.media.filter((m) => m.id !== id) }));

  const add = () => {
    const name = mName.trim();
    if (!name) { toast('作品名字是？', 'err'); return; }
    setDb((p) => ({
      ...p,
      media: [{ id: uid(), name, type: mType, status: mStatus, rating: mRating, date: mStatus === '看完' ? todayKey() : undefined, review: mReview.trim() }, ...p.media],
    }));
    setMName(''); setMReview(''); setMRating(0); setMStatus('想看'); setAdding(false);
    toast('已入库《' + name + '》');
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">书影音 · 精神足迹</p>
          <h1 className="mt-1 text-[24px] font-semibold">看过、读过，都算数。</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>＋ 看完入库</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="今年看完" value={stats.doneCount} unit="部/本" tone="var(--accent)" />
        <Stat label="平均评分" value={stats.avg ? stats.avg.toFixed(1) : '—'} unit="★" tone="var(--gold)" />
        <Stat label="最爱类型" value={stats.fav} sub="按今年看完统计" />
        <Stat label="收藏总数" value={db.media.length} sub="含想看与在看" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Seg options={['全部', ...MEDIA_TYPES] as const} value={type} onChange={setType} />
        <Seg options={['全部', ...MEDIA_STATUSES] as const} value={status} onChange={setStatus} />
      </div>

      {list.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.map((m) => (
            <div key={m.id} className="card card-hover group flex flex-col p-4">
              <div className="mb-2 flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[20px]" style={{ background: m.type === '书籍' ? 'rgba(165,132,90,.15)' : 'rgba(113,128,95,.13)' }}>{TYPE_ICON[m.type]}</span>
                <button className="btn btn-quiet !px-1 !py-0 text-[12px] opacity-0 transition group-hover:opacity-100" onClick={() => del(m.id)}>✕</button>
              </div>
              <p className="mb-0.5 line-clamp-2 min-h-[36px] font-medium leading-snug" style={{ fontSize: 13.5 }}>{m.name}</p>
              <p className="mb-2 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                <span>{m.type}</span>·<span style={{ color: STATUS_TONE[m.status] }}>{m.status}</span>
                {m.date ? '· ' + fmtCN(m.date) : ''}
              </p>
              <div className="mb-1 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} className="text-[15px] leading-none transition hover:scale-125" style={{ color: s <= m.rating ? '#d9a13b' : 'rgba(120,100,60,.22)' }} onClick={() => setRatingV(m, s)}>★</button>
                ))}
              </div>
              {m.review ? <p className="mb-2 line-clamp-2 text-[11.5px] italic leading-snug" style={{ color: 'var(--muted)' }}>“{m.review}”</p> : <div className="mb-2" />}
              <select className="field !mt-auto !py-1.5 text-[12px]" value={m.status} onChange={(e) => setStatusV(m, e.target.value as MediaStatus)}>
                {MEDIA_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      ) : (
        <div className="card py-12 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>
          {db.media.length ? '没有符合筛选的作品。' : '看完了书/电影，对它说一句“《xx》看完了，四星”，它就替你存进书影音。'}
        </div>
      )}

      {adding ? (
        <Modal title="看完入库" onClose={() => setAdding(false)} width={480}
          footer={<><button className="btn btn-quiet" onClick={() => setAdding(false)}>取消</button><button className="btn btn-primary" onClick={add}>入库</button></>}>
          <div className="space-y-3">
            <input className="field" placeholder="作品名，如《置身事内》" value={mName} onChange={(e) => setMName(e.target.value)} autoFocus />
            <select className="field" value={mType} onChange={(e) => setMType(e.target.value as MediaType)}>{MEDIA_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <select className="field" value={mStatus} onChange={(e) => setMStatus(e.target.value as MediaStatus)}>{MEDIA_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]" style={{ color: 'var(--muted)' }}>评分：</span>
              {[0, 1, 2, 3, 4, 5].map((s) => (
                <button key={s} className="text-[18px] leading-none" style={{ color: s > 0 && s <= mRating ? '#d9a13b' : 'rgba(120,100,60,.22)' }} onClick={() => setMRating(s)}>{s === 0 ? '×' : '★'}</button>
              ))}
            </div>
            <textarea className="field resize-none" rows={2} placeholder="一句话短评（可选）" value={mReview} onChange={(e) => setMReview(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
