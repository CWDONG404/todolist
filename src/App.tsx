import {
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Download,
  FolderOpen,
  GripHorizontal,
  Minus,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Power,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TaskCategory = "today" | "week" | "future";
type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  dueDate: string;
  priority: TaskPriority;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

type CompletedTask = Task & {
  completed: true;
  completedAt: string;
  archivedAt: string;
};

type TaskDraft = {
  title: string;
  description: string;
  category: TaskCategory;
  dueDate: string;
  priority: TaskPriority;
};

type TaskStorageData = {
  version: 1;
  tasks: Task[];
  history: CompletedTask[];
  updatedAt: string;
};

type TaskLoadResult = {
  data: TaskStorageData;
  status?: {
    created?: boolean;
    migrated?: boolean;
    recovered?: boolean;
    backupPath?: string;
    storagePath?: string;
    message?: string;
  };
};

type TaskSaveResult = {
  data: TaskStorageData;
  status?: {
    storagePath?: string;
  };
};

type TaskExportResult = {
  canceled: boolean;
  filePath?: string;
};

type TaskImportResult = {
  canceled: boolean;
  data?: TaskStorageData;
  filePath?: string;
};

type DesktopBridge = {
  tasks: {
    load: (migrationCandidate?: TaskStorageData) => Promise<TaskLoadResult>;
    save: (data: TaskStorageData) => Promise<TaskSaveResult>;
    export: () => Promise<TaskExportResult>;
    import: () => Promise<TaskImportResult>;
    openStorageFolder: () => Promise<void>;
    onChanged: (callback: (data: TaskStorageData) => void) => () => void;
  };
  minimizeWindow?: () => Promise<void>;
  hideWindow?: () => Promise<void>;
  openMiniWindow?: () => Promise<void>;
  setMiniAlwaysOnTop?: (enabled: boolean) => Promise<void>;
  getAutoLaunch?: () => Promise<boolean>;
  setAutoLaunch?: (enabled: boolean) => Promise<boolean>;
};

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

const STORAGE_KEY = "apple-style-todo.tasks.v1";
const HISTORY_STORAGE_KEY = "apple-style-todo.history.v1";
const COMPLETION_DELAY_MS = 5000;

const categories: Array<{
  id: TaskCategory;
  label: string;
  shortLabel: string;
}> = [
  {
    id: "today",
    label: "今日待办",
    shortLabel: "今日",
  },
  {
    id: "week",
    label: "本周计划",
    shortLabel: "本周",
  },
  {
    id: "future",
    label: "未来目标",
    shortLabel: "未来",
  },
];

const priorityLabels: Record<TaskPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const emptyDraft: TaskDraft = {
  title: "",
  description: "",
  category: "today",
  dueDate: "",
  priority: "medium",
};

const seedTasks: Task[] = [
  {
    id: "seed-1",
    title: "整理今天最重要的三件事",
    description: "把注意力放在高价值事项上，先完成一个小闭环。",
    category: "today",
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "high",
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "seed-2",
    title: "复盘本周计划",
    description: "检查哪些事情需要调整优先级。",
    category: "week",
    dueDate: "",
    priority: "medium",
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "seed-3",
    title: "记录一个长期目标",
    description: "写下未来想实现的状态，拆成下一步行动。",
    category: "future",
    dueDate: "",
    priority: "low",
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadLocalTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return seedTasks;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return seedTasks;
    }

    const now = new Date().toISOString();

    return parsed.filter(isTask).map((task) =>
      task.completed && !task.completedAt
        ? {
            ...task,
            completedAt: now,
          }
        : task,
    );
  } catch {
    return seedTasks;
  }
}

function loadLocalHistory(): CompletedTask[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isCompletedTask);
  } catch {
    return [];
  }
}

function createStorageData(tasks: Task[], history: CompletedTask[]): TaskStorageData {
  return {
    version: 1,
    tasks,
    history,
    updatedAt: new Date().toISOString(),
  };
}

function hasLocalStorageData() {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(HISTORY_STORAGE_KEY));
  } catch {
    return false;
  }
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Partial<Task>;

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.description === "string" &&
    ["today", "week", "future"].includes(task.category ?? "") &&
    typeof task.dueDate === "string" &&
    ["low", "medium", "high"].includes(task.priority ?? "") &&
    typeof task.completed === "boolean" &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string" &&
    (task.completedAt === undefined || typeof task.completedAt === "string")
  );
}

function isCompletedTask(value: unknown): value is CompletedTask {
  if (!isTask(value)) {
    return false;
  }

  const task = value as Partial<CompletedTask>;

  return (
    task.completed === true &&
    typeof task.completedAt === "string" &&
    typeof task.archivedAt === "string"
  );
}

function formatDate(value: string) {
  if (!value) {
    return "未设日期";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatToday() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function sortTasks(tasks: Task[]) {
  const priorityWeight: Record<TaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return Number(a.completed) - Number(b.completed);
    }

    if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
      return priorityWeight[a.priority] - priorityWeight[b.priority];
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export default function App() {
  const desktopApi = typeof window !== "undefined" ? window.desktop : undefined;
  const isDesktop = Boolean(desktopApi);
  const [tasks, setTasks] = useState<Task[]>(loadLocalTasks);
  const [history, setHistory] = useState<CompletedTask[]>(loadLocalHistory);
  const tasksRef = useRef<Task[]>(tasks);
  const skipNextSaveRef = useRef(false);
  const [isStorageReady, setIsStorageReady] = useState(!isDesktop);
  const [storageNotice, setStorageNotice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>("today");
  const [quickTitle, setQuickTitle] = useState("");
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [isAutoLaunchEnabled, setIsAutoLaunchEnabled] = useState(false);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!desktopApi) {
      return;
    }

    let isActive = true;
    const migrationCandidate = hasLocalStorageData()
      ? createStorageData(loadLocalTasks(), loadLocalHistory())
      : undefined;

    desktopApi.tasks
      .load(migrationCandidate)
      .then((result) => {
        if (!isActive) {
          return;
        }

        skipNextSaveRef.current = true;
        setTasks(result.data.tasks);
        setHistory(result.data.history);
        setIsStorageReady(true);

        if (result.status?.recovered) {
          setStorageNotice("数据文件损坏，已恢复默认数据，原文件已备份。");
        } else if (result.status?.created && result.status?.migrated) {
          setStorageNotice("已迁移浏览器本地数据。");
        } else if (result.status?.created) {
          setStorageNotice("已创建桌面数据文件。");
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setIsStorageReady(true);
        setStorageNotice(error instanceof Error ? error.message : "桌面数据读取失败。");
      });

    const removeListener = desktopApi.tasks.onChanged((data) => {
      skipNextSaveRef.current = true;
      setTasks(data.tasks);
      setHistory(data.history);
      setStorageNotice("已同步其他窗口的数据修改。");
    });

    return () => {
      isActive = false;
      removeListener();
    };
  }, [desktopApi]);

  useEffect(() => {
    if (!desktopApi?.getAutoLaunch) {
      return;
    }

    desktopApi
      .getAutoLaunch()
      .then(setIsAutoLaunchEnabled)
      .catch((error: unknown) => {
        setStorageNotice(error instanceof Error ? error.message : "无法读取开机自启动状态。");
      });
  }, [desktopApi]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (!desktopApi) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      return;
    }

    desktopApi.tasks.save(createStorageData(tasks, history)).catch((error: unknown) => {
      setStorageNotice(error instanceof Error ? error.message : "桌面数据保存失败。");
    });
  }, [desktopApi, history, isStorageReady, tasks]);

  useEffect(() => {
    const timers = tasks
      .filter((task) => task.completed && task.completedAt)
      .map((task) => {
        const completedAt = new Date(task.completedAt ?? "").getTime();
        const elapsed = Number.isFinite(completedAt) ? Date.now() - completedAt : 0;
        const remaining = Math.max(0, COMPLETION_DELAY_MS - elapsed);

        return window.setTimeout(() => archiveCompletedTask(task.id), remaining);
      });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [tasks]);

  const selectedCategoryConfig =
    categories.find((category) => category.id === selectedCategory) ?? categories[0];
  const selectedTasks = useMemo(
    () => sortTasks(tasks.filter((task) => task.category === selectedCategory)),
    [selectedCategory, tasks],
  );
  const activeSelectedTasks = selectedTasks.filter((task) => !task.completed);
  const pendingSelectedTasks = selectedTasks.filter((task) => task.completed);
  const activeCount = tasks.filter((task) => !task.completed).length;
  const completedCount = history.length + tasks.filter((task) => task.completed).length;
  const recentHistory = history.slice(0, 4);

  function archiveCompletedTask(id: string) {
    const task = tasksRef.current.find((item) => item.id === id && item.completed);

    if (!task) {
      return;
    }

    const now = new Date().toISOString();
    const archivedTask: CompletedTask = {
      ...task,
      completed: true,
      completedAt: task.completedAt ?? now,
      archivedAt: now,
    };

    setTasks((currentTasks) =>
      currentTasks.filter((item) => !(item.id === id && item.completed)),
    );
    setHistory((currentHistory) =>
      currentHistory.some(
        (item) => item.id === archivedTask.id && item.completedAt === archivedTask.completedAt,
      )
        ? currentHistory
        : [archivedTask, ...currentHistory],
    );
  }

  function createTaskFromTitle(title: string) {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    const now = new Date().toISOString();
    const newTask: Task = {
      id: createId(),
      title: trimmedTitle,
      description: "",
      category: selectedCategory,
      dueDate: selectedCategory === "today" ? now.slice(0, 10) : "",
      priority: "medium",
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    setTasks((currentTasks) => [newTask, ...currentTasks]);
    setQuickTitle("");
  }

  function handleQuickSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTaskFromTitle(quickTitle);
  }

  function toggleTask(id: string) {
    const now = new Date().toISOString();

    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== id) {
          return task;
        }

        if (task.completed) {
          return {
            ...task,
            completed: false,
            completedAt: undefined,
            updatedAt: now,
          };
        }

        return {
          ...task,
          completed: true,
          completedAt: now,
          updatedAt: now,
        };
      }),
    );
  }

  function openCreateEditor() {
    setEditingTask(null);
    setDraft({
      ...emptyDraft,
      category: selectedCategory,
      dueDate: selectedCategory === "today" ? new Date().toISOString().slice(0, 10) : "",
    });
    setIsEditorOpen(true);
  }

  function openEditEditor(task: Task) {
    setEditingTask(task);
    setDraft({
      title: task.title,
      description: task.description,
      category: task.category,
      dueDate: task.dueDate,
      priority: task.priority,
    });
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setEditingTask(null);
    setDraft(emptyDraft);
  }

  function handleEditorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draft.title.trim();
    const description = draft.description.trim();

    if (!title) {
      return;
    }

    const now = new Date().toISOString();

    if (editingTask) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === editingTask.id
            ? {
                ...task,
                ...draft,
                completed: false,
                completedAt: undefined,
                title,
                description,
                updatedAt: now,
              }
            : task,
        ),
      );
      setSelectedCategory(draft.category);
    } else {
      const newTask: Task = {
        id: createId(),
        title,
        description,
        category: draft.category,
        dueDate: draft.dueDate,
        priority: draft.priority,
        completed: false,
        createdAt: now,
        updatedAt: now,
      };

      setTasks((currentTasks) => [newTask, ...currentTasks]);
      setSelectedCategory(draft.category);
    }

    closeEditor();
  }

  function deleteTask(id: string) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    closeEditor();
  }

  function restoreHistoryItem(item: CompletedTask) {
    const now = new Date().toISOString();
    const restoredTask: Task = {
      ...item,
      completed: false,
      completedAt: undefined,
      updatedAt: now,
    };

    setHistory((currentHistory) =>
      currentHistory.filter((historyItem) => historyItem.id !== item.id),
    );
    setTasks((currentTasks) => [restoredTask, ...currentTasks]);
    setSelectedCategory(item.category);
  }

  async function togglePinned() {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);

    try {
      await desktopApi?.setMiniAlwaysOnTop?.(nextPinned);
    } catch (error) {
      setStorageNotice(error instanceof Error ? error.message : "无法切换置顶。");
    }
  }

  async function exportData() {
    try {
      const result = await desktopApi?.tasks.export();

      if (result && !result.canceled) {
        setStorageNotice("已导出 JSON 备份。");
      }
    } catch (error) {
      setStorageNotice(error instanceof Error ? error.message : "数据导出失败。");
    }
  }

  async function importData() {
    try {
      const result = await desktopApi?.tasks.import();

      if (result?.data) {
        skipNextSaveRef.current = true;
        setTasks(result.data.tasks);
        setHistory(result.data.history);
        setStorageNotice("已导入 JSON 备份。");
      }
    } catch (error) {
      setStorageNotice(error instanceof Error ? error.message : "数据导入失败。");
    }
  }

  async function toggleAutoLaunch() {
    const nextEnabled = !isAutoLaunchEnabled;
    setIsAutoLaunchEnabled(nextEnabled);

    try {
      const actualEnabled = await desktopApi?.setAutoLaunch?.(nextEnabled);
      setIsAutoLaunchEnabled(Boolean(actualEnabled));
      setStorageNotice(actualEnabled ? "已开启开机自启动。" : "已关闭开机自启动。");
    } catch (error) {
      setIsAutoLaunchEnabled(!nextEnabled);
      setStorageNotice(error instanceof Error ? error.message : "无法修改开机自启动。");
    }
  }

  return (
    <main className="widget-stage">
      <section className="glass-widget" aria-label="透明待办挂件">
        <header className="widget-chrome">
          <div className="drag-zone" aria-hidden="true">
            <GripHorizontal size={20} />
          </div>
          <div className="window-actions">
            <button
              className="chrome-button"
              type="button"
              aria-label={isPinned ? "取消置顶" : "窗口置顶"}
              title={isPinned ? "取消置顶" : "窗口置顶"}
              onClick={togglePinned}
            >
              {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
            <button
              className="chrome-button"
              type="button"
              aria-label="最小化"
              title="最小化"
              onClick={() => desktopApi?.minimizeWindow?.()}
            >
              <Minus size={15} />
            </button>
            <button
              className="chrome-button"
              type="button"
              aria-label="隐藏到托盘"
              title="隐藏到托盘"
              onClick={() => desktopApi?.hideWindow?.()}
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="hero-strip">
          <div>
            <p>{formatToday()}</p>
            <h1>{selectedCategoryConfig.label}</h1>
          </div>
          <button
            className="round-button prominent"
            type="button"
            aria-label="新建详细任务"
            title="新建详细任务"
            onClick={openCreateEditor}
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="metric-row" aria-label="任务概览">
          <span>{activeCount} 待处理</span>
          <span>{completedCount} 已完成</span>
        </div>

        <div className="category-tabs" aria-label="分类">
          {categories.map((category) => (
            <button
              className={category.id === selectedCategory ? "is-selected" : ""}
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.shortLabel}
            </button>
          ))}
        </div>

        <form className="quick-add" onSubmit={handleQuickSubmit}>
          <input
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            placeholder="添加一个待办"
            maxLength={80}
          />
          <button type="submit" aria-label="添加">
            <Plus size={18} />
          </button>
        </form>

        <div className="task-scroll">
          {activeSelectedTasks.length > 0 ? (
            activeSelectedTasks.map((task) => (
              <article className={`task-row priority-${task.priority}`} key={task.id}>
                <button
                  className="task-check"
                  type="button"
                  aria-label="标记完成"
                  title="标记完成"
                  onClick={() => toggleTask(task.id)}
                >
                  <Circle size={22} />
                </button>
                <button className="task-main" type="button" onClick={() => openEditEditor(task)}>
                  <strong>{task.title}</strong>
                  <span>
                    {priorityLabels[task.priority]}
                    {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}
                  </span>
                </button>
                <button
                  className="row-action"
                  type="button"
                  aria-label="编辑"
                  title="编辑"
                  onClick={() => openEditEditor(task)}
                >
                  <MoreHorizontal size={18} />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-widget">
              <CheckCircle2 size={28} />
              <p>{selectedCategoryConfig.shortLabel}清空了</p>
            </div>
          )}

          {pendingSelectedTasks.map((task) => (
            <article className="task-row is-pending" key={task.id}>
              <button
                className="task-check"
                type="button"
                aria-label="取消完成"
                title="取消完成"
                onClick={() => toggleTask(task.id)}
              >
                <CheckCircle2 size={22} />
              </button>
              <div className="task-main is-static">
                <strong>{task.title}</strong>
                <span>5 秒后归档</span>
              </div>
            </article>
          ))}
        </div>

        <footer className="widget-footer">
          <button
            className="footer-button"
            type="button"
            onClick={() => setIsPanelOpen((isOpen) => !isOpen)}
          >
            <SlidersHorizontal size={16} />
            管理
          </button>
          {storageNotice ? <span className="notice-line">{storageNotice}</span> : null}
        </footer>

        {isPanelOpen ? (
          <section className="drawer-panel" aria-label="数据与历史">
            <div className="drawer-actions">
              <button
                className={isAutoLaunchEnabled ? "is-enabled" : ""}
                type="button"
                onClick={toggleAutoLaunch}
              >
                <Power size={16} />
                {isAutoLaunchEnabled ? "自启已开" : "开机自启"}
              </button>
              <button type="button" onClick={() => desktopApi?.tasks.openStorageFolder()}>
                <FolderOpen size={16} />
                数据目录
              </button>
              <button type="button" onClick={exportData}>
                <Download size={16} />
                导出
              </button>
              <button type="button" onClick={importData}>
                <Upload size={16} />
                导入
              </button>
            </div>

            <div className="history-compact">
              <div className="history-title">
                <ArchiveRestore size={16} />
                最近完成
              </div>
              {recentHistory.length > 0 ? (
                recentHistory.map((item) => (
                  <button
                    className="restore-item"
                    key={`${item.id}-${item.archivedAt}`}
                    type="button"
                    onClick={() => restoreHistoryItem(item)}
                  >
                    <span>{item.title}</span>
                    <ArchiveRestore size={14} />
                  </button>
                ))
              ) : (
                <p className="history-empty-text">还没有归档任务。</p>
              )}
            </div>
          </section>
        ) : null}
      </section>

      {isEditorOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="editor-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <header className="sheet-header">
              <div>
                <p>{editingTask ? "编辑待办" : "新建待办"}</p>
                <h2 id="editor-title">{editingTask ? "调整细节" : "添加到挂件"}</h2>
              </div>
              <button
                className="round-button"
                type="button"
                aria-label="关闭"
                title="关闭"
                onClick={closeEditor}
              >
                <X size={16} />
              </button>
            </header>

            <form className="task-form" onSubmit={handleEditorSubmit}>
              <label htmlFor="task-title">
                <span>标题</span>
                <input
                  id="task-title"
                  autoFocus
                  value={draft.title}
                  maxLength={80}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      title: event.target.value,
                    }))
                  }
                  placeholder="例如：处理今天最重要的一件事"
                  required
                />
              </label>

              <label htmlFor="task-description">
                <span>备注</span>
                <textarea
                  id="task-description"
                  value={draft.description}
                  maxLength={240}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      description: event.target.value,
                    }))
                  }
                  placeholder="补充上下文"
                  rows={3}
                />
              </label>

              <div className="form-grid">
                <label htmlFor="task-category">
                  <span>分类</span>
                  <select
                    id="task-category"
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        category: event.target.value as TaskCategory,
                      }))
                    }
                  >
                    <option value="today">今日待办</option>
                    <option value="week">本周计划</option>
                    <option value="future">未来目标</option>
                  </select>
                </label>

                <label htmlFor="task-priority">
                  <span>优先级</span>
                  <select
                    id="task-priority"
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        priority: event.target.value as TaskPriority,
                      }))
                    }
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </label>
              </div>

              <label htmlFor="task-due-date">
                <span>日期</span>
                <div className="date-field">
                  <CalendarDays size={17} />
                  <input
                    id="task-due-date"
                    value={draft.dueDate}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        dueDate: event.target.value,
                      }))
                    }
                    type="date"
                  />
                </div>
              </label>

              <footer className="sheet-actions">
                {editingTask ? (
                  <button
                    className="delete-button"
                    type="button"
                    onClick={() => deleteTask(editingTask.id)}
                  >
                    <Trash2 size={16} />
                    删除
                  </button>
                ) : null}
                <button className="save-button" type="submit">
                  {editingTask ? "保存" : "添加"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
