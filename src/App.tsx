/* 「日常集」工作台外壳：暖色侧栏 + 视图切换 + AI 口述 + 设置 */
import { useState } from 'react';
import { useApp } from './state';
import Overview from './views/Overview';
import Money from './views/Money';
import Habits from './views/Habits';
import Fitness from './views/Fitness';
import Buys from './views/Buys';
import MediaView from './views/MediaView';
import Archive from './views/Archive';
import Chat from './views/Chat';
import Settings from './views/Settings';
import { Toasts } from './widgets';

export type ViewKey = 'overview' | 'money' | 'habits' | 'fitness' | 'buys' | 'media' | 'archive' | 'ai';

const NAV: { key: ViewKey; label: string; glyph: string }[] = [
  { key: 'overview', label: '今日总览', glyph: '◐' },
  { key: 'money', label: '记账理财', glyph: '¥' },
  { key: 'habits', label: '习惯健康', glyph: '✦' },
  { key: 'fitness', label: '减脂健身', glyph: '⚖' },
  { key: 'buys', label: '待买清单', glyph: '✚' },
  { key: 'media', label: '书影音', glyph: '❦' },
  { key: 'archive', label: '时光档案', glyph: '◷' },
];

export default function App() {
  const { settings } = useApp();
  const [view, setView] = useState<ViewKey>('overview');
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const go = (v: ViewKey) => (v === 'ai' ? setChatOpen(true) : setView(v));

  const today = new Date();
  const todayStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Electron 无边框窗口：顶部拖动条（红绿灯为原生控件，浮于其上不受影响） */}
      {isElectron ? <div className="drag-strip" aria-hidden="true" /> : null}
      {/* 侧栏 */}
      <aside
        className="flex h-full w-[212px] flex-none flex-col border-r"
        style={{ background: 'linear-gradient(180deg,#efe7d4, #f2ead8)', borderColor: 'var(--line)' }}
      >
        <div className={`px-4 pb-3 ${isElectron ? 'pt-11' : 'pt-5'}`}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[15px] font-bold text-white shadow" style={{ background: 'linear-gradient(135deg,#b85c38,#d08a5a)' }}>集</span>
            <div className="leading-tight">
              <p className="serif text-[16px] font-semibold tracking-[0.02em]" style={{ color: 'var(--ink)' }}>{settings.brandName}</p>
              <p className="text-[10px] tracking-[0.16em]" style={{ color: 'var(--muted)' }}>今天，慢慢来</p>
            </div>
          </div>
          <p className="mt-3 border-t pt-2 text-[10.5px]" style={{ borderColor: 'rgba(150,130,90,.25)', color: 'var(--muted)' }}>{todayStr}</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((n) => (
            <button key={n.key} className={`nav-item ${view === n.key ? 'active' : ''}`} onClick={() => go(n.key)}>
              <span className="glyph">{n.glyph}</span><span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="space-y-2 border-t px-3 py-3" style={{ borderColor: 'rgba(150,130,90,.25)' }}>
          <button className="nav-item active w-full !border-[rgba(184,92,56,.35)]" style={{ background: 'linear-gradient(135deg,#b85c38,#c9774f)', color: '#fff' }} onClick={() => go('ai')}>
            <span className="glyph">💬</span><span>对它说句话</span>
          </button>
          <button className="nav-item" onClick={() => setSettingsOpen(true)}>
            <span className="glyph">⚙</span><span>设置与备份</span>
          </button>
        </div>
      </aside>

      {/* 主区 */}
      <main className="h-full flex-1 overflow-y-auto">
        <div className="stagger mx-auto max-w-[1120px] px-6 py-6">
          {view === 'overview' ? <Overview go={go} /> : null}
          {view === 'money' ? <Money /> : null}
          {view === 'habits' ? <Habits /> : null}
          {view === 'fitness' ? <Fitness /> : null}
          {view === 'buys' ? <Buys /> : null}
          {view === 'media' ? <MediaView /> : null}
          {view === 'archive' ? <Archive /> : null}
        </div>
      </main>

      {/* 覆盖层 */}
      <Chat open={chatOpen} onClose={() => setChatOpen(false)} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toasts />
    </div>
  );
}
