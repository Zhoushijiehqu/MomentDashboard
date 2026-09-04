/* 全局状态：数据库 / 设置 / 对话 / Toast */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChatMsg, DB, Settings } from './types';
import { loadDB, loadSettings, saveDB, saveSettings } from './services/db';
import { uid } from './services/dates';

interface ToastItem {
  id: string;
  text: string;
  kind: 'ok' | 'err';
}

interface Ctx {
  db: DB;
  setDb: (updater: (prev: DB) => DB) => void;
  replaceDb: (db: DB) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  chat: ChatMsg[];
  chatAdd: (m: Omit<ChatMsg, 'id' | 'time'>) => void;
  chatClear: () => void;
  toasts: ToastItem[];
  toast: (text: string, kind?: 'ok' | 'err') => void;
}

const AppCtx = createContext<Ctx>(null as unknown as Ctx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDbState] = useState<DB>(() => loadDB());
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [chat, setChat] = useState<ChatMsg[]>(() => {
    try {
      const raw = localStorage.getItem('richangji.chat.v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => saveDB(db), [db]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    try {
      localStorage.setItem('richangji.chat.v1', JSON.stringify(chat));
    } catch {
      /* ignore */
    }
  }, [chat]);

  const setDb = useCallback((updater: (prev: DB) => DB) => setDbState((p) => updater(p)), []);
  const replaceDb = useCallback((d: DB) => setDbState(d), []);
  const setSettings = useCallback((s: Settings) => setSettingsState(s), []);

  const chatAdd = useCallback((m: Omit<ChatMsg, 'id' | 'time'>) => {
    setChat((p) => [...p, { ...m, id: uid(), time: Date.now() }]);
  }, []);
  const chatClear = useCallback(() => setChat([]), []);

  const toast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = uid();
    setToasts((p) => [...p.slice(-3), { id, text, kind }]);
    timers.current[id] = window.setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== id));
      delete timers.current[id];
    }, 3600);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ db, setDb, replaceDb, settings, setSettings, chat, chatAdd, chatClear, toasts, toast }),
    [db, setDb, replaceDb, settings, setSettings, chat, chatAdd, chatClear, toasts, toast],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  return useContext(AppCtx);
}
