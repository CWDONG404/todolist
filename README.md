# Todolist

一个使用 React、TypeScript 和 Vite 构建的轻量级目标待办 Web 应用。项目围绕「今日待办」「本周计划」「未来目标」三个计划维度组织任务，支持任务创建、编辑、删除、完成归档和历史记录。

## 功能特性

- 三类计划列表：今日待办、本周计划、未来目标
- 任务 CRUD：新增、编辑、删除、完成 / 取消完成
- 完成归档：任务完成后保留 5 秒撤销窗口，随后自动进入完成历史
- 历史记录：按当前计划分类展示已完成任务，并支持恢复到计划列表
- 本地持久化：使用 `localStorage` 保存任务与历史记录
- 响应式布局：适配桌面端和移动端
- 现代化界面：参考 Apple / Tailwind 风格的面板、控件和动效设计

## 技术栈

- React 18
- TypeScript
- Vite
- lucide-react
- CSS3

## 本地运行

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173/
```

## 生产构建

```bash
npm run build
```

构建产物会生成在 `dist/` 目录中，该目录已加入 `.gitignore`，不会提交到 GitHub。

## 项目结构

```text
.
├── index.html
├── package.json
├── package-lock.json
├── src
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 数据存储

应用当前不依赖后端服务，任务数据保存在浏览器本地：

- 当前任务：`apple-style-todo.tasks.v1`
- 完成历史：`apple-style-todo.history.v1`

清理浏览器站点数据会同步清空这些本地记录。

## GitHub 提交参考

如果是首次推送到新仓库，可以在项目根目录执行：

```bash
git init
git add .
git commit -m "feat: add todolist app"
git branch -M main
git remote add origin git@github.com:CWDONG404/todolist.git
git push -u origin main
```

提交前建议先运行：

```bash
npm run build
```

确保 TypeScript 检查和生产构建都能通过。
