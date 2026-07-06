# Todolist

Todolist 是一个 Windows 桌面待办挂件。它基于 React、TypeScript、Vite 和 Electron 构建，目标不是传统网页应用，而是一个可以贴在桌面右上角、轻量记录任务的透明桌面小工具。

## 当前功能

- 桌面挂件窗口：无边框、透明窗口、默认显示在主屏幕右上角。
- 窗口层级：默认不置顶，打开浏览器或其他软件时可以自然盖住挂件；需要时可临时置顶。
- 外观切换：支持“毛玻璃”和“透明”两种模式。
- 开机自启动：可在管理面板中开启或关闭。
- 任务分类：今日、本周、未来三个计划维度。
- 任务管理：支持快速新增、详细新增、编辑、删除、完成和取消完成。
- 完成归档：任务完成后保留 5 秒撤销窗口，随后进入完成历史。
- 历史记录：可查看完整完成历史，并把历史任务恢复回待办列表。
- 本地持久化：桌面版使用 JSON 文件保存任务和历史。

## 外观说明

- 毛玻璃模式：Electron 原生透明窗口保持透明底色，Windows native `acrylic` 材质负责背景模糊，前端只叠加半透明填充和控件。
- 透明模式：关闭 native material，主挂件主体背景为真正透明，不再使用白色或深色底板；任务行和按钮保留轻微半透明浮层，保证可读性。
- 圆角处理：窗口启用 Windows 原生 `roundedCorners`，同时 `html`、`body`、`#root` 和最外层容器保持透明，避免只裁内部 DOM 而露出原生黑色矩形底。

## 渲染链路说明

桌面版使用 Electron `BrowserWindow`。透明窗口的正确链路是：

1. 原生窗口启用 `transparent: true`。
2. 原生窗口背景使用透明白 `#00FFFFFF`，避免透明像素在合成时退回黑色 backing surface。
3. 主进程通过 IPC 在“毛玻璃 / 透明”之间切换 Windows native material：毛玻璃为 `acrylic`，透明为 `none`。
4. Renderer 的 `html`、`body`、`#root`、`.widget-stage` 全部保持透明。
5. 主挂件主体不依赖 CSS `backdrop-filter` 来模拟桌面模糊，避免 Chromium 透明窗口在某些 Windows 合成路径下把透明区域渲染成黑色。

如果后续再调整外观，优先检查 Electron 原生窗口配置，再检查 CSS；不要只靠 `border-radius`、`overflow: hidden` 或遮罩来处理四角问题。

## 本地运行

安装依赖：

```bash
npm install
```

运行 Web 开发服务器：

```bash
npm run dev
```

运行桌面开发版：

```bash
npm run desktop:dev
```

桌面开发命令会先执行生产构建，再启动 Electron。

## 打包

只生成未安装的 Windows 桌面目录：

```bash
npm run desktop:pack
```

生成安装包和便携版：

```bash
npm run desktop:build
```

打包产物会输出到 `release/`，该目录不会提交到 GitHub。

## 数据存储

桌面版数据默认保存到：

```text
%APPDATA%\Todolist\tasks.json
```

数据结构包含：

- `version`：数据版本号
- `tasks`：当前待办任务
- `history`：完成历史
- `updatedAt`：最后更新时间

保存时会先写入临时文件 `tasks.tmp.json`，再替换正式文件，降低异常退出导致 JSON 损坏的风险。如果数据文件损坏，应用会把原文件改名为 `tasks.corrupt-*.json` 并创建默认数据。

## 常用脚本

```bash
npm run dev            # 启动 Vite Web 开发服务器
npm run build          # TypeScript 检查 + Vite 生产构建
npm run preview        # 预览 Web 构建产物
npm run desktop:dev    # 构建后启动 Electron
npm run desktop:pack   # 生成 release/win-unpacked
npm run desktop:build  # 生成安装包和便携版
```

## 项目结构

```text
.
├── electron
│   ├── main.cjs       # Electron 主进程、窗口、托盘、IPC
│   ├── preload.cjs    # Renderer 安全桥接
│   └── storage.cjs    # 本地 JSON 存储
├── src
│   ├── App.tsx        # 挂件 UI 与任务逻辑
│   ├── main.tsx
│   └── styles.css     # 透明 / 毛玻璃外观
├── package.json
├── package-lock.json
└── vite.config.ts
```

## 提交前检查

提交前至少运行：

```bash
npm run build
```

如果修改了 Electron 窗口、存储或打包配置，建议再运行：

```bash
npm run desktop:pack
```
