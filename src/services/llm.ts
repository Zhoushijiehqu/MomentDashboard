/* LLM 客户端 —— OpenAI Chat Completions 兼容（小米 MiMo 官方）
 * Electron 成品：window.electronAPI 存在 → 走主进程 IPC 直连（免 CORS、免代理）
 * 网页原型：跨域请求走同源 /__llm 开发代理（见 vite.config.ts） */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

declare global {
  interface Window {
    electronAPI?: { llmChat: (args: any) => Promise<string>; platform?: string };
  }
}

export async function chatCompletion(
  s: { baseUrl: string; apiKey: string; model: string },
  messages: LLMMessage[],
  maxTokens = 8192,
): Promise<string> {
  if (!s.baseUrl?.trim() || !s.apiKey?.trim() || !s.model?.trim()) {
    throw new Error('请先在「设置」里填好 API Base URL / Key / 模型名');
  }
  const base = s.baseUrl.trim().replace(/\/+$/, '');
  const apiKey = s.apiKey.trim();
  const model = s.model.trim();

  // Electron：主进程直连，无 CORS
  if (typeof window !== 'undefined' && window.electronAPI?.llmChat) {
    return window.electronAPI.llmChat({ baseUrl: base, apiKey, model, messages, maxTokens });
  }

  // 浏览器：跨域时走 vite 同源代理
  const target = `${base}/chat/completions`;
  const payload = { model, messages, max_completion_tokens: maxTokens };
  const auth: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };

  let url = target;
  let body: unknown = payload;
  let headers = auth;
  try {
    const u = new URL(target);
    const here = new URL(window.location.origin);
    if (u.origin !== here.origin) {
      url = '/__llm';
      body = { target, headers: auth, payload };
      headers = { 'Content-Type': 'application/json' };
    }
  } catch {
    url = '/__llm';
    body = { target: new URL(target, window.location.origin).href, headers: auth, payload };
    headers = { 'Content-Type': 'application/json' };
  }

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    /* ignore */
  }
  if (!resp.ok || !data) throw new Error(data?.error?.message || `请求失败 HTTP ${resp.status}`);
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('模型返回为空，请重试');
  return content.trim();
}

export async function testConnection(s: { baseUrl: string; apiKey: string; model: string }): Promise<string> {
  return chatCompletion(s, [{ role: 'user', content: '只回复两个字：正常' }], 64);
}
