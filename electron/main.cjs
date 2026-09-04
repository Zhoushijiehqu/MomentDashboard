/* ============================================================
 * 「个人工作台」Electron 主进程
 * 职责三件：开窗口 / 直连 LLM（免浏览器 CORS）/ 托盘化本地数据（Chromium localStorage 自动持久化到 userData）
 * 渲染层无感知：llm.ts 检测到 window.electronAPI 就走 IPC，否则退回 vite 的 /__llm 开发代理
 * ============================================================ */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const APP_NAME = '个人工作台';

function createWindow() {
  const win = new BrowserWindow({
    title: APP_NAME,
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f5f0e4',
    titleBarStyle: 'hiddenInset', // macOS 红绿灯内嵌，更原生
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 开发：--dev-url=http://localhost:5199 指向 vite dev server；生产：加载打包产物
  const devUrl =
    process.argv.find((a) => a.startsWith('--dev-url='))?.split('=')[1] ||
    process.env.RCJ_DEV_URL ||
    '';
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

/* ---------- LLM 直连（主进程无 CORS） ---------- */
ipcMain.handle('llm:chat', async (_e, args) => {
  const { baseUrl, apiKey, model, messages, maxTokens } = args || {};
  if (!baseUrl || !apiKey || !model) throw new Error('LLM 参数不完整（baseUrl/apiKey/model）');
  const target = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const resp = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_completion_tokens: maxTokens ?? 8192 }),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data) throw new Error(data?.error?.message || `请求失败 HTTP ${resp.status}`);
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('模型返回为空，请重试');
  return String(content).trim();
});

app.whenReady().then(() => {
  app.setName(APP_NAME);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
