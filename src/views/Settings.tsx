/* 设置：外观品牌名 / AI 接口 / 数据管理（导入导出·备份安全感） */
import { useRef, useState } from 'react';
import { useApp } from '../state';
import { testConnection } from '../services/llm';
import { exportJSON, importJSON, sampleDB } from '../services/db';
import { MODEL_OPTIONS } from '../config/api';
import { Modal, Spinner } from '../widgets';

export default function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, setDb, replaceDb, settings, setSettings, chatClear, toast } = useApp();
  const [draft, setDraft] = useState({ ...settings });
  const [busy, setBusy] = useState(false);
  const [armClear, setArmClear] = useState(false);
  const [armSeed, setArmSeed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [customModel, setCustomModel] = useState(!MODEL_OPTIONS.includes(draft.model));

  if (!open) return null;

  const save = () => {
    setSettings({ ...draft, baseUrl: draft.baseUrl.trim().replace(/\/+$/, ''), apiKey: draft.apiKey.trim() });
    toast('设置已保存（仅存本机）');
  };

  const test = async () => {
    setBusy(true);
    try {
      const out = await testConnection(draft);
      toast('连接正常，模型回复：' + out.slice(0, 30));
    } catch (e: any) {
      toast(String(e?.message || e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = importJSON(String(reader.result ?? ''));
      if (!r.ok) { toast(r.msg, 'err'); return; }
      replaceDb(r.db);
      toast(r.msg);
    };
    reader.readAsText(file, 'utf-8');
  };

  const counts: [string, number][] = [
    ['流水', db.txs.length],
    ['习惯', db.habits.length],
    ['打卡', db.checks.length],
    ['身体日志', db.fitness.length],
    ['待买', db.buys.length],
    ['书影音', db.media.length],
  ];

  return (
    <Modal
      title="设置"
      onClose={onClose}
      width={660}
      footer={
        <>
          <button className="btn btn-quiet" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={save}>保存设置</button>
        </>
      }
    >
      <div className="space-y-6">
        {/* 品牌 */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold">工作台</h3>
          <div className="space-y-2">
            <input className="field" value={draft.brandName} onChange={(e) => setDraft({ ...draft, brandName: e.target.value })} placeholder="工作台名称，如 日常集" />
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>出现在问候语与 AI 口中。</p>
          </div>
        </section>

        {/* AI */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold">AI 记录员接口（OpenAI 兼容）</h3>
          <div className="card space-y-2.5 p-4" style={{ background: 'var(--card2)' }}>
            <input className="field" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="https://api.xiaomimimo.com/v1" />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex gap-1.5">
                <select
                  className="field"
                  value={customModel ? '__custom' : draft.model}
                  onChange={(e) => {
                    if (e.target.value === '__custom') { setCustomModel(true); return; }
                    setCustomModel(false);
                    setDraft({ ...draft, model: e.target.value });
                  }}
                >
                  {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value="__custom">自定义…</option>
                </select>
                {customModel ? <input className="field" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="mimo-v2.5" /> : null}
              </div>
              <input className="field" type="password" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="sk-…" autoComplete="off" />
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>默认已预填小米 MiMo 官方接口；Key 仅存本机。</p>
              <button className="btn !py-1.5 text-[12px]" onClick={test} disabled={busy || !draft.apiKey}>
                {busy ? <Spinner size={11} /> : null} 测试连接
              </button>
            </div>
          </div>
        </section>

        {/* 数据 */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold">数据 · {counts.map(([k, v]) => `${k}${v}`).join(' · ')}</h3>
          <div className="card grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2" style={{ background: 'var(--card2)' }}>
            <button className="btn justify-center" onClick={() => exportJSON(db, settings)}>⬇ 导出备份 JSON</button>
            <button className="btn justify-center" onClick={() => fileRef.current?.click()}>⬆ 导入备份 / 旧版数据</button>
            <input ref={fileRef} type="file" accept=".json,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }} />
            <button
              className={`btn justify-center ${armSeed ? '!text-[var(--accent)]' : ''}`}
              onClick={() => {
                if (!armSeed) { setArmSeed(true); setTimeout(() => setArmSeed(false), 3000); return; }
                replaceDb(sampleDB());
                setArmSeed(false);
                toast('已载入示例数据');
              }}
            >
              {armSeed ? '确认覆盖？' : '载入示例数据'}
            </button>
            <button
              className={`btn justify-center ${armClear ? '!text-[var(--accent)]' : ''}`}
              onClick={() => {
                if (!armClear) { setArmClear(true); setTimeout(() => setArmClear(false), 3000); return; }
                replaceDb({ txs: [], habits: [], checks: [], goal: null, fitness: [], buys: [], media: [] });
                chatClear();
                setArmClear(false);
                toast('本地数据已清空（导出备份请先做）');
              }}
            >
              {armClear ? '确认清空？' : '清空全部数据'}
            </button>
          </div>
        </section>

        {/* 隐私说明 */}
        <section className="rounded-2xl border p-4 text-[12px] leading-relaxed" style={{ borderColor: 'rgba(184,92,56,.25)', background: 'rgba(184,92,56,.05)', color: 'var(--ink-soft)' }}>
          <p>🔒 <b>数据全本地</b>：所有记录存于本机浏览器存储，正式桌面版将迁移到本机 JSON 文件（electron-store），不上云、无账号。</p>
          <p>🤖 口述内容会发送至你配置的 AI 接口（{draft.baseUrl || '—'}）做结构化整理，请勿输入敏感信息。</p>
          <p>🗄️ 建议每周导出一份备份 JSON——这是你全部生活的存档。</p>
        </section>
      </div>
    </Modal>
  );
}
