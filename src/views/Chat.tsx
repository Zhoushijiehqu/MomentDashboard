/* AI 口述面板：纯文本输入（输入法语音即可说话）→ 路由落库 */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { chatCompletion } from '../services/llm';
import { applyActions, buildSystemPrompt, parseReply } from '../services/router';
import type { AiAction } from '../services/router';
import type { DB } from '../types';
import { Spinner } from '../widgets';

const CHIPS = [
  '午饭吃了 18 块',
  '《鼠疫》看完了，4 星',
  '今天练字 2 页',
  '体重 69.2，运动 40 分钟',
  '想买个无线鼠标，89 块',
];

interface PendingActions {
  actions: AiAction[];
  ok?: string;
  question?: string;
}

interface UndoRecord {
  before: DB;
  after: DB;
  summary: string;
}

function actionSummary(action: AiAction): string {
  if (action.kind === 'money') return `${action.flow} ¥${action.amount}${action.category ? ` · ${action.category}` : ''}${action.date ? ` · ${action.date}` : ''}`;
  if (action.kind === 'habit') return `${action.name || '习惯'}${action.value !== undefined ? ` +${action.value}${action.unit || ''}` : ' · 完成打卡'}${action.date ? ` · ${action.date}` : ''}`;
  if (action.kind === 'media') return `《${action.name || '未命名'}》${action.status ? ` · ${action.status}` : ''}${action.rating !== undefined ? ` · ${action.rating} 星` : ''}`;
  if (action.kind === 'fitness') {
    const bits = [action.weight !== undefined ? `${action.weight}kg` : '', action.bodyFat !== undefined ? `体脂 ${action.bodyFat}%` : '', action.calories !== undefined ? `${action.calories} kcal` : '', action.minutes !== undefined ? `运动 ${action.minutes} 分钟` : ''].filter(Boolean);
    return `身体记录${bits.length ? ` · ${bits.join(' · ')}` : ''}${action.date ? ` · ${action.date}` : ''}`;
  }
  return `${action.name || '未命名物品'}${action.bought ? ' · 标为已买' : ' · 加入待买'}${action.price ? ` · ¥${action.price}` : ''}`;
}

function sameDB(a: DB, b: DB): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function Chat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, setDb, settings, chat, chatAdd, chatClear, toast } = useApp();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingActions | null>(null);
  const [undo, setUndo] = useState<UndoRecord | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length, busy, open, pending, undo]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    if (pending) {
      toast('请先确认或放弃上一条记录建议', 'err');
      return;
    }
    setInput('');
    setError('');
    chatAdd({ role: 'user', content: text });
    setBusy(true);
    try {
      const sys = buildSystemPrompt(dbRef.current, settings.brandName);
      const history = chat.slice(-16).map((m) => ({ role: m.role, content: m.content }));
      const reply = await chatCompletion(settings, [{ role: 'system', content: sys }, ...history, { role: 'user', content: text }]);
      const parsed = parseReply(reply);
      if (!parsed) {
        chatAdd({ role: 'assistant', content: reply, kind: 'question' });
        return;
      }
      const actions = Array.isArray(parsed.actions) ? parsed.actions.filter(Boolean) : [];
      if (actions.length) {
        setPending({ actions, ok: parsed.ok, question: parsed.question });
      } else if (parsed.question) {
        chatAdd({ role: 'assistant', content: parsed.question, kind: 'question' });
      } else {
        chatAdd({ role: 'assistant', content: parsed.ok || '我还没找到可以记录的内容。', kind: 'question' });
      }
    } catch (e: any) {
      setError(String(e?.message || e));
      toast(String(e?.message || e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = () => {
    if (!pending) return;
    const before = dbRef.current;
    const { db: next, logs } = applyActions(before, pending.actions);
    setPending(null);
    if (!logs.length) {
      chatAdd({ role: 'assistant', content: pending.question || '这些内容暂时无法保存，请补充一点信息。', kind: 'question' });
      return;
    }
    dbRef.current = next;
    setDb(() => next);
    const brief = logs.length > 2 ? `${logs.slice(0, 2).join('；')} 等 ${logs.length} 项` : logs.join('；');
    setUndo({ before, after: next, summary: brief });
    chatAdd({
      role: 'assistant',
      content: pending.question ? [pending.ok || brief, `还需补充：${pending.question}`].join('\n') : pending.ok || brief,
      kind: 'done',
    });
    toast(brief);
  };

  const discardPending = () => {
    if (!pending) return;
    setPending(null);
    chatAdd({ role: 'assistant', content: '这条记录建议已放弃，没有写入档案。', kind: 'question' });
  };

  const undoLast = () => {
    if (!undo) return;
    if (!sameDB(dbRef.current, undo.after)) {
      setUndo(null);
      toast('已有新的手动修改，为避免覆盖，未执行撤销', 'err');
      return;
    }
    dbRef.current = undo.before;
    setDb(() => undo.before);
    setUndo(null);
    chatAdd({ role: 'assistant', content: '已撤销刚才的 AI 记录，档案恢复到写入前。', kind: 'question' });
    toast('已撤销刚才的记录');
  };

  return (
    <div className="overlay flex justify-end !bg-[rgba(66,57,44,.25)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="slide-up flex h-full w-full max-w-[430px] flex-col border-l" style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}>
        {/* header */}
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: 'var(--line)' }}>
          <div>
            <p className="eyebrow">对它说话</p>
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>{settings.brandName} · AI 记录员</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {chat.length ? <button className="btn btn-quiet !py-1 text-[12px]" onClick={() => { chatClear(); setPending(null); }}>清空</button> : null}
            <button className="btn btn-quiet !px-2 !py-1" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 历史 */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {chat.length === 0 ? (
            <div className="pt-6 text-center">
              <p className="text-[15px]" style={{ color: 'var(--ink-soft)' }}>把生活说给它，就像发消息。</p>
              <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                支出、阅读、练字、体重、看完的书影音……它会自动判断进哪个模块，缺信息就先问你。输入法自带的语音转文字，就是你的"说话"入口。
              </p>
            </div>
          ) : null}
          {chat.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.role === 'user' ? 'rounded-br-md text-white' : 'rounded-bl-md'}`}
                style={
                  m.role === 'user'
                    ? { background: 'linear-gradient(135deg,#c1664f,#a34e31)' }
                    : {
                        background: m.kind === 'done' ? 'rgba(113,128,95,.12)' : 'var(--card)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink)',
                      }
                }
              >
                {m.role === 'assistant' && m.kind === 'done' ? (
                  <div className="mb-1 text-[11px] font-semibold" style={{ color: 'var(--sage)' }}>✓ 已记入档案</div>
                ) : null}
                {m.content}
              </div>
            </div>
          ))}
          {pending ? (
            <div className="slide-up overflow-hidden rounded-xl border" style={{ background: 'var(--card)', borderColor: 'rgba(184,92,56,.42)', boxShadow: '0 6px 20px rgba(90,72,40,.08)' }}>
              <div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5" style={{ borderColor: 'var(--line)', background: 'rgba(184,92,56,.07)' }}>
                <div>
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--accent-deep)' }}>AI 整理好了，等待你的确认</p>
                  <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--muted)' }}>确认后才会写进档案</p>
                </div>
                <span className="pill" style={{ background: 'rgba(184,92,56,.12)', color: 'var(--accent-deep)' }}>{pending.actions.length} 项</span>
              </div>
              <div className="space-y-2 px-3.5 py-3">
                {pending.ok ? <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{pending.ok}</p> : null}
                <ul className="space-y-1.5">
                  {pending.actions.map((action, index) => (
                    <li key={index} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                      <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full" style={{ background: 'var(--accent)' }} />
                      <span>{actionSummary(action)}</span>
                    </li>
                  ))}
                </ul>
                {pending.question ? <p className="border-t pt-2 text-[11.5px] leading-relaxed" style={{ borderColor: 'var(--line-soft)', color: 'var(--plum)' }}>还需补充：{pending.question}</p> : null}
              </div>
              <div className="flex items-center justify-end gap-2 border-t px-3.5 py-2.5" style={{ borderColor: 'var(--line)' }}>
                <button className="btn btn-quiet !px-2.5 !py-1.5 text-[12px]" onClick={discardPending}>放弃</button>
                <button className="btn btn-primary !px-3 !py-1.5 text-[12px]" onClick={confirmPending}>确认写入</button>
              </div>
            </div>
          ) : null}
          {undo ? (
            <div className="slide-up flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5" style={{ background: 'rgba(113,128,95,.10)', borderColor: 'rgba(113,128,95,.30)' }}>
              <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--sage)' }}>已写入档案。发现不对可以撤销这次记录。</p>
              <button className="btn !flex-none !border-[rgba(113,128,95,.45)] !px-2.5 !py-1.5 text-[12px]" style={{ color: 'var(--sage)' }} onClick={undoLast}>撤销</button>
            </div>
          ) : null}
          {busy ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md px-3.5 py-2.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                <Spinner /> <span className="text-[12px]" style={{ color: 'var(--muted)' }}>在梳理，缺的会问你…</span>
              </div>
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl px-3 py-2 text-[12px]" style={{ background: 'rgba(184,92,56,.1)', border: '1px solid rgba(184,92,56,.3)', color: 'var(--accent-deep)' }}>{error}</div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {/* 快捷例句 */}
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {CHIPS.map((c) => (
            <button key={c} className="chip cursor-pointer transition hover:!bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || Boolean(pending)} onClick={() => send(c)}>{c}</button>
          ))}
        </div>

        {/* 输入 */}
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-end gap-2">
            <textarea
              className="field max-h-32 min-h-[44px] resize-none"
              rows={1}
              placeholder="说点什么…（长按空格或点输入法麦克风即可说话）"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <button className="btn btn-primary h-[44px] flex-none" disabled={busy || Boolean(pending) || !input.trim()} onClick={() => send()}>
              {busy ? <Spinner size={12} /> : '说'}
            </button>
          </div>
          <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--muted)' }}>
            内容将发送至你配置的 AI 接口做结构化整理；AI 只梳理与追问，不替你写日记。
          </p>
        </div>
      </aside>
    </div>
  );
}
