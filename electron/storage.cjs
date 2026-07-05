const fs = require("node:fs");
const path = require("node:path");

const DATA_VERSION = 1;
const DATA_FILE = "tasks.json";
const TMP_FILE = "tasks.tmp.json";

function createSeedTasks() {
  const now = new Date().toISOString();

  return [
    {
      id: "seed-1",
      title: "整理今天最重要的三件事",
      description: "把注意力放在高价值事项上，先完成一个小闭环。",
      category: "today",
      dueDate: now.slice(0, 10),
      priority: "high",
      completed: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-2",
      title: "复盘本周计划",
      description: "检查哪些事情需要调整优先级。",
      category: "week",
      dueDate: "",
      priority: "medium",
      completed: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-3",
      title: "记录一个长期目标",
      description: "写下未来想实现的状态，拆成下一步行动。",
      category: "future",
      dueDate: "",
      priority: "low",
      completed: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function isTask(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    ["today", "week", "future"].includes(value.category) &&
    typeof value.dueDate === "string" &&
    ["low", "medium", "high"].includes(value.priority) &&
    typeof value.completed === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.completedAt === undefined || typeof value.completedAt === "string")
  );
}

function isCompletedTask(value) {
  return (
    isTask(value) &&
    value.completed === true &&
    typeof value.completedAt === "string" &&
    typeof value.archivedAt === "string"
  );
}

function createDefaultData(candidate) {
  const now = new Date().toISOString();
  const tasks = Array.isArray(candidate?.tasks)
    ? candidate.tasks.filter(isTask)
    : createSeedTasks();
  const history = Array.isArray(candidate?.history)
    ? candidate.history.filter(isCompletedTask)
    : [];

  return {
    version: DATA_VERSION,
    tasks: tasks.length > 0 ? tasks : createSeedTasks(),
    history,
    updatedAt: now,
  };
}

function normalizeData(value) {
  if (!value || typeof value !== "object") {
    throw new Error("数据文件不是有效对象。");
  }

  if (!Array.isArray(value.tasks) || !Array.isArray(value.history)) {
    throw new Error("数据文件缺少 tasks 或 history。");
  }

  return {
    version: DATA_VERSION,
    tasks: value.tasks.filter(isTask),
    history: value.history.filter(isCompletedTask),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeWriteJson(filePath, data) {
  const dirPath = path.dirname(filePath);
  const tmpPath = path.join(dirPath, TMP_FILE);
  const serialized = `${JSON.stringify(data, null, 2)}\n`;

  ensureDir(dirPath);
  fs.writeFileSync(tmpPath, serialized, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function createTaskStore(userDataPath) {
  const storageDir = userDataPath;
  const dataPath = path.join(storageDir, DATA_FILE);

  function save(data) {
    const normalized = normalizeData({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    safeWriteJson(dataPath, normalized);

    return normalized;
  }

  function load(migrationCandidate) {
    ensureDir(storageDir);

    if (!fs.existsSync(dataPath)) {
      const data = createDefaultData(migrationCandidate);
      safeWriteJson(dataPath, data);

      return {
        data,
        status: {
          created: true,
          migrated: Boolean(migrationCandidate),
          recovered: false,
          storagePath: dataPath,
        },
      };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      const data = normalizeData(parsed);

      return {
        data,
        status: {
          created: false,
          migrated: false,
          recovered: false,
          storagePath: dataPath,
        },
      };
    } catch (error) {
      const backupPath = path.join(storageDir, `tasks.corrupt-${safeTimestamp()}.json`);

      fs.renameSync(dataPath, backupPath);

      const data = createDefaultData(migrationCandidate);
      safeWriteJson(dataPath, data);

      return {
        data,
        status: {
          created: true,
          migrated: Boolean(migrationCandidate),
          recovered: true,
          backupPath,
          storagePath: dataPath,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  function exportTo(filePath) {
    const current = load().data;

    safeWriteJson(filePath, current);

    return current;
  }

  function importFrom(filePath) {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const data = save(parsed);

    return data;
  }

  return {
    dataPath,
    storageDir,
    load,
    save,
    exportTo,
    importFrom,
  };
}

module.exports = {
  createTaskStore,
};
