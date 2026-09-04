/* ============================================================
 * preload：唯一跨进程桥，只暴露 llmChat 一个能力
 * 渲染层用 window.electronAPI.llmChat({ baseUrl, apiKey, model, messages, maxTokens })
 * ============================================================ */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  llmChat: (args) => ipcRenderer.invoke('llm:chat', args),
  platform: process.platform,
});
