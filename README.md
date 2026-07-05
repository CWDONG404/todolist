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

- 毛玻璃模式：使用透明 Electron 窗口 + CSS 毛玻璃面板实现，圆角由前端裁切，避免 Windows 原生 acrylic 在四角铺成矩形。
- 透明模式：主挂件背景为透明，不再使用白色底板，尽量融入桌面壁纸；任务行和按钮保留轻微半透明浮层，保证可读性。

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
