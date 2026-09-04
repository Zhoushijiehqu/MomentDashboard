# 个人工作台 · AI 桌面生活工作台

> 像聊天一样记录生活，AI 自动帮你整理成结构化数据。

## 这是什么

**个人工作台**是一个基于 Electron 的桌面生活记录应用。你可以用自然语言口述（或打字）今天发生的事，AI 会自动拆解成结构化动作——记账、习惯打卡、书影音入库、记录身体数据，所有图表实时更新。

**数据纯本地**，所有记录保存在你的电脑上，支持导出/导入备份。

## 核心功能

| 视图 | 说明 |
|---|---|
| 今日总览 | 今日支出、本月结余、习惯完成情况、身体近况、支出图表、AI 快捷入口 |
| 记账理财 | 收支流水增删、月度预算、分类占比、近 6 月趋势 |
| 习惯健康 | 习惯打卡（勾选/计数/数值）、连续天数、近 12 周热力图 |
| 减脂健身 | 体重、体脂、热量、运动分钟逐日记录、目标进度 |
| 待买清单 | 待买 ↔ 已买管理、优先级设置、预算预估 |
| 书影音 | 书·电影·剧·番记录，1–5 星评分 + 短评，年度统计 |
| 时光档案 | 按日回顾全部记录 |
| AI 口述 | 右侧抽屉，输入一句话即可触发记账、打卡、入库等操作 |

## 技术栈

- **前端**：Vite 6 + React 18 + TypeScript 5.7 + Tailwind CSS v4
- **桌面**：Electron 44.2.0（主进程 IPC 直连 AI，免 CORS）
- **图表**：纯 SVG/CSS 自绘，零第三方图表库
- **AI**：小米 MiMo（OpenAI 兼容 API），支持在设置页切换模型

## 快速开始

### 环境要求

- Node.js ≥ 18

### 安装与运行

```bash
cd MomentDashboard
npm install          # 安装依赖
npm run desktop      # 启动桌面版
npm run dev          # 网页开发模式（默认端口 5173）
npm run build        # 构建 dist/ 输出
```

### 首次使用

1. 启动应用后，打开「⚙ 设置与备份」
2. 填入你的 AI API Key 并配置接口地址
3. Key 仅保存在本机 localStorage，不会上传或泄露

### AI 模型配置

应用默认使用小米 MiMo（platform.xiaomimimo.com），但**支持任何 OpenAI 兼容 API**，你可以在设置页面自行切换模型：

- **小米 MiMo**（默认）：platform.xiaomimimo.com
- **OpenAI**：填入 OpenAI 的 API 地址和 Key，选择 GPT-4o 等模型
- **DeepSeek**：api.deepseek.com
- **通义千问 / 智谱 GLM / 月之暗面** 等国内模型，只要兼容 OpenAI 接口格式即可

在「⚙ 设置与备份」中修改 API 地址（Base URL）、模型名称和 Key 即可，无需改代码。

### 可用命令

| 命令 | 说明 |
|---|---|
| `npm run desktop` | 桌面版（build + 启动 Electron） |
| `npm run desktop:dev` | 桌面开发模式（Electron 加载 dev server） |
| `npm run dev` | 网页开发模式 |
| `npm run build` | 构建生产包 |
| `npx tsc --noEmit` | TypeScript 类型检查 |

## 目录结构

```
src/
├─ main.tsx            入口
├─ App.tsx             主布局：侧栏导航 + 视图切换 + Chat/Settings 抽屉
├─ state.tsx           全局状态管理（Context）
├─ index.css           设计系统：暖色人文纸感主题
├─ types.ts            数据模型与分类常量
├─ config/api.ts       AI API 配置（不含 Key）
├─ services/
│  ├─ dates.ts         日期工具函数
│  ├─ db.ts            数据存储（localStorage）+ 导出/导入
│  ├─ llm.ts           AI 调用（Electron IPC / 网页代理双模）
│  └─ router.ts        AI 解析引擎：自然语言 → 结构化操作
├─ views/              各功能视图组件
└─ widgets.tsx         共享 UI 组件
electron/
├─ main.cjs            Electron 主进程
└─ preload.cjs         预加载脚本
```

## 设计风格

「今天，慢慢来」——暖色人文纸感主题。标题使用 Noto Serif SC（书卷气），正文 Noto Sans SC，数字 DM Serif Display。卡片白/米色 + 圆角 + 顶部金线，支持交错渐入动画与 `prefers-reduced-motion`。

## 许可证

MIT
