import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 本地开发代理 /__llm —— 仅供【网页原型】阶段解决浏览器直连外网
 * OpenAI 兼容 API 的 CORS 限制。最终 Electron 版由主进程直连，届时删除此中间件。
 *
 * 前端约定：向同源 /__llm POST JSON：{ target, headers, payload }
 */
function llmProxyMiddleware() {
  return {
    name: 'llm-dev-proxy',
    configureServer(server: any) {
      server.middlewares.use(
        '/__llm',
        (async (req: any, res: any) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let raw = '';
          req.on('data', (c: Buffer) => (raw += c));
          req.on('end', async () => {
            try {
              const { target, headers, payload } = JSON.parse(raw);
              if (!target || !payload) throw new Error('缺少 target 或 payload');
              const upstream = await fetch(target, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(headers || {}) },
                body: JSON.stringify(payload),
              });
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(text);
            } catch (e: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: String(e?.message || e) } }));
            }
          });
        }) as any,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), llmProxyMiddleware()],
  server: { port: 5173, strictPort: false },
  // Electron 生产模式用 loadFile(file://) 加载 dist/index.html，资源必须相对路径
  base: './',
});
