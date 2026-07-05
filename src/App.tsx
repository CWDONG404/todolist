import {
  Archive,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Edit3,
  Flag,
  Goal,
  History as HistoryIcon,
  LayoutGrid,
  ListTodo,
  Plus,
  Search,
  Trash2,
  Undo2,
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

type ConfirmDelete = {
  id: string;
  title: string;
} | null;

const STORAGE_KEY = "apple-style-todo.tasks.v1";
const HISTORY_STORAGE_KEY = "apple-style-todo.history.v1";
const COMPLETION_DELAY_MS = 5000;

const categories: Array<{
  id: TaskCategory;
  title: string;
  subtitle: string;
  icon: typeof CalendarDays;
}> = [
  {
    id: "today",
    title: "今日待办",
    subtitle: "只看今天需要推进的计划",
    icon: CalendarDays,
  },
  {
    id: "week",
    title: "本周计划",
    subtitle: "安排这一周要完成的任务",
    icon: LayoutGrid,
  },
  {
    id: "future",
    title: "未来目标",
    subtitle: "沉淀长期方向和后续目标",
    icon: Goal,
  },
];

const priorityLabels: Record<TaskPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const priorityTone: Record<TaskPriority, string> = {
  low: "priority-low",
  medium: "priority-medium",
  high: "priority-high",
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

function loadTasks(): Task[] {
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

function loadHistory(): CompletedTask[] {
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
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [history, setHistory] = useState<CompletedTask[]>(loadHistory);
  const tasksRef = useRef<Task[]>(tasks);
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>("today");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    tasksRef.current = tasks;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

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
  const SelectedIcon = selectedCategoryConfig.icon;

  const selectedTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const categoryTasks = tasks.filter((task) => task.category === selectedCategory);

    if (!query) {
      return sortTasks(categoryTasks);
    }

    return sortTasks(
      categoryTasks.filter((task) =>
        `${task.title} ${task.description}`.toLowerCase().includes(query),
      ),
    );
  }, [searchTerm, selectedCategory, tasks]);

  const selectedHistory = useMemo(
    () => history.filter((item) => item.category === selectedCategory),
    [history, selectedCategory],
  );
  const selectedPendingHistory = useMemo(
    () => sortTasks(tasks.filter((task) => task.category === selectedCategory && task.completed)),
    [selectedCategory, tasks],
  );

  const totalCount = tasks.length;
  const activeCount = tasks.filter((task) => !task.completed).length;
  const totalPendingArchiveCount = tasks.filter((task) => task.completed).length;
  const selectedCount = tasks.filter((task) => task.category === selectedCategory).length;
  const selectedPendingArchiveCount = tasks.filter(
    (task) => task.category === selectedCategory && task.completed,
  ).length;
  const visibleHistoryCount = selectedHistory.length + selectedPendingHistory.length;

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

    setTasks((currentTasks) => {
      return currentTasks.filter((item) => !(item.id === id && item.completed));
    });
    setHistory((currentHistory) =>
      currentHistory.some(
        (item) => item.id === archivedTask.id && item.completedAt === archivedTask.completedAt,
      )
        ? currentHistory
        : [archivedTask, ...currentHistory],
    );
  }

  function openCreateEditor(category: TaskCategory = selectedCategory) {
    setEditingTask(null);
    setDraft({
      ...emptyDraft,
      category,
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

  function deleteTask(id: string) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    setConfirmDelete(null);

    if (editingTask?.id === id) {
      closeEditor();
    }
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

  return (
    <main className="app-shell">
      <section className="todo-frame" aria-label="计划任务工作区">
        <aside className="control-panel" aria-label="计划控制栏">
          <div className="summary-strip" aria-label="任务统计">
            <div>
              <span>{totalCount}</span>
              <small>当前任务</small>
            </div>
            <div>
              <span>{activeCount}</span>
              <small>待处理</small>
            </div>
            <div>
              <span>{history.length + totalPendingArchiveCount}</span>
              <small>完成历史</small>
            </div>
          </div>

          <div className="control-divider" />

          <div className="control-section">
            <div className="category-picker">
              <label htmlFor="category-filter">计划列表</label>
              <div className="category-menu-wrap">
                <button
                  className={`category-select ${isCategoryMenuOpen ? "is-open" : ""}`}
                  id="category-filter"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isCategoryMenuOpen}
                  onClick={() => setIsCategoryMenuOpen((isOpen) => !isOpen)}
                >
                  <span className="lane-icon">
                    <SelectedIcon aria-hidden="true" size={20} />
                  </span>
                  <span className="category-select-label">{selectedCategoryConfig.title}</span>
                  <ChevronDown aria-hidden="true" size={18} />
                </button>

                {isCategoryMenuOpen ? (
                  <div className="category-menu" role="listbox" aria-labelledby="category-filter">
                    {categories.map((category) => {
                      const Icon = category.icon;

                      return (
                        <button
                          className={`category-option ${
                            category.id === selectedCategory ? "is-selected" : ""
                          }`}
                          key={category.id}
                          type="button"
                          role="option"
                          aria-selected={category.id === selectedCategory}
                          onClick={() => {
                            setSelectedCategory(category.id);
                            setSearchTerm("");
                            setIsCategoryMenuOpen(false);
                          }}
                        >
                          <span>
                            <Icon aria-hidden="true" size={18} />
                          </span>
                          <strong>{category.title}</strong>
                          {category.id === selectedCategory ? (
                            <CheckCircle2 aria-hidden="true" size={18} />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <p>{selectedCategoryConfig.subtitle}</p>
            </div>
          </div>

          <button
            className="primary-button control-add-button"
            type="button"
            onClick={() => openCreateEditor(selectedCategory)}
          >
            <Plus aria-hidden="true" size={18} />
            新增任务
          </button>
        </aside>

        <section className="planner-panel">
          <header className="planner-header">
            <div className="planner-title-block">
              <span className="lane-icon">
                <SelectedIcon aria-hidden="true" size={22} />
              </span>
              <div>
                <h1>{selectedCategoryConfig.title}</h1>
                <p>{selectedCategoryConfig.subtitle}</p>
              </div>
            </div>
          </header>

          <div className="planner-tools">
            <label className="search-box">
              <Search aria-hidden="true" size={18} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`搜索${selectedCategoryConfig.title}`}
                type="search"
              />
            </label>

            <div className="lane-meta" aria-label="当前列表统计">
              <span>{selectedCount} 项</span>
              <span>{selectedPendingArchiveCount} 等待归档</span>
            </div>
          </div>

          <div className="task-list">
            {selectedTasks.length > 0 ? (
              selectedTasks.map((task) => (
                <article
                  className={`task-card ${task.completed ? "is-complete is-pending-archive" : ""}`}
                  key={task.id}
                  data-testid={`task-card-${task.id}`}
                  data-task-title={task.title}
                >
                  <div className="task-topline">
                    <button
                      className="check-button"
                      type="button"
                      data-testid={`toggle-task-${task.id}`}
                      aria-label={task.completed ? "取消完成" : "标记为完成"}
                      title={task.completed ? "取消完成" : "标记为完成"}
                      onClick={() => toggleTask(task.id)}
                    >
                      {task.completed ? (
                        <CheckCircle2 aria-hidden="true" size={22} />
                      ) : (
                        <Circle aria-hidden="true" size={22} />
                      )}
                    </button>
                    <div className="task-content">
                      <h3>{task.title}</h3>
                      {task.description ? <p>{task.description}</p> : null}
                    </div>
                  </div>

                  <div className="task-footer">
                    <span className={`priority-pill ${priorityTone[task.priority]}`}>
                      <Flag aria-hidden="true" size={13} />
                      {priorityLabels[task.priority]}
                    </span>
                    <span className="date-pill">
                      <Clock3 aria-hidden="true" size={13} />
                      {formatDate(task.dueDate)}
                    </span>
                    {task.completed ? (
                      <span className="archive-pill">
                        <Undo2 aria-hidden="true" size={13} />
                        5 秒内可取消
                      </span>
                    ) : null}
                    <div className="task-actions">
                      <button
                        className="ghost-icon-button"
                        type="button"
                        data-testid={`edit-task-${task.id}`}
                        aria-label="编辑任务"
                        title="编辑任务"
                        onClick={() => openEditEditor(task)}
                      >
                        <Edit3 aria-hidden="true" size={16} />
                      </button>
                      <button
                        className="ghost-icon-button danger"
                        type="button"
                        data-testid={`delete-task-${task.id}`}
                        aria-label="删除任务"
                        title="删除任务"
                        onClick={() =>
                          setConfirmDelete({
                            id: task.id,
                            title: task.title,
                          })
                        }
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <Check aria-hidden="true" size={22} />
                <p>{searchTerm ? "没有匹配的任务" : `${selectedCategoryConfig.title}还没有任务`}</p>
                <button type="button" onClick={() => openCreateEditor(selectedCategory)}>
                  添加一项
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="history-panel" aria-label="完成历史">
          <header className="history-header">
            <div>
              <span className="history-icon">
                <Archive aria-hidden="true" size={20} />
              </span>
            <div>
              <h2>完成历史</h2>
              <p>{selectedCategoryConfig.title}完成后会保存在这里</p>
            </div>
          </div>
            <span className="history-count">{visibleHistoryCount}</span>
          </header>

          <div className="history-list">
            {visibleHistoryCount > 0 ? (
              <>
                {selectedPendingHistory.map((item) => (
                  <article className="history-item is-pending-history" key={`pending-${item.id}`}>
                    <div>
                      <h3>{item.title}</h3>
                      <p>
                        <Clock3 aria-hidden="true" size={13} />
                        5 秒后归档
                      </p>
                    </div>
                    <button
                      className="ghost-icon-button"
                      type="button"
                      aria-label="取消完成"
                      title="取消完成"
                      onClick={() => toggleTask(item.id)}
                    >
                      <Undo2 aria-hidden="true" size={16} />
                    </button>
                  </article>
                ))}

                {selectedHistory.map((item) => (
                  <article className="history-item" key={`${item.id}-${item.archivedAt}`}>
                    <div>
                      <h3>{item.title}</h3>
                      <p>
                        <HistoryIcon aria-hidden="true" size={13} />
                        {formatDateTime(item.archivedAt)}
                      </p>
                    </div>
                    <button
                      className="ghost-icon-button"
                      type="button"
                      aria-label="恢复到计划"
                      title="恢复到计划"
                      onClick={() => restoreHistoryItem(item)}
                    >
                      <Undo2 aria-hidden="true" size={16} />
                    </button>
                  </article>
                ))}
              </>
            ) : (
              <div className="history-empty">
                <ListTodo aria-hidden="true" size={22} />
                <p>完成的计划会在这里留档。</p>
              </div>
            )}
          </div>
        </aside>
      </section>

      {isEditorOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <header className="modal-header">
              <div>
                <p>{editingTask ? "编辑任务" : "创建任务"}</p>
                <h2 id="editor-title">{editingTask ? "调整任务细节" : "添加新的待办"}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭编辑器"
                title="关闭编辑器"
                onClick={closeEditor}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>

            <form className="task-form" onSubmit={handleSubmit}>
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
                  placeholder="例如：完成产品原型"
                  required
                />
              </label>

              <label htmlFor="task-description">
                <span>描述</span>
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
                  placeholder="补充上下文、下一步动作或验收标准"
                  rows={4}
                />
              </label>

              <div className="form-grid">
                <label htmlFor="task-category">
                  <span>目标分类</span>
                  <div className="field-control select-control">
                    <LayoutGrid aria-hidden="true" size={18} />
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
                    <ChevronDown aria-hidden="true" size={17} />
                  </div>
                </label>

                <label htmlFor="task-priority">
                  <span>优先级</span>
                  <div className="field-control select-control">
                    <Flag aria-hidden="true" size={18} />
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
                    <ChevronDown aria-hidden="true" size={17} />
                  </div>
                </label>
              </div>

              <label htmlFor="task-due-date">
                <span>截止日期</span>
                <div className="field-control date-control">
                  <CalendarDays aria-hidden="true" size={18} />
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

              <footer className="modal-actions">
                <button className="secondary-button" type="button" onClick={closeEditor}>
                  取消
                </button>
                <button className="primary-button" type="submit">
                  {editingTask ? "保存修改" : "创建任务"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-description"
          >
            <div className="confirm-icon">
              <Trash2 aria-hidden="true" size={24} />
            </div>
            <h2 id="confirm-title">删除这项任务？</h2>
            <p id="confirm-description">“{confirmDelete.title}” 删除后无法恢复。</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setConfirmDelete(null)}
              >
                取消
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => deleteTask(confirmDelete.id)}
              >
                删除
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
