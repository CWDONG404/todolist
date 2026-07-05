const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} = require("electron");
const { createTaskStore } = require("./storage.cjs");

let mainWindow = null;
let miniWindow = null;
let tray = null;
let taskStore = null;

const isDevServer = Boolean(process.env.VITE_DEV_SERVER_URL);

app.setName("Todolist");
app.setPath("userData", path.join(app.getPath("appData"), "Todolist"));

function createTrayIcon() {
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVR4AWP4z8Dwn4ECwESJ5lEDRgYGBhYGKGBgYEAEYkM2DHQxkAGQJjAzM4MMgDIQwCQJxIAig9gQJMQVhmAAcSA2hAlxWTAYZBipGSRhGJYFhAEAi2gGEbHRlrcAAAAASUVORK5CYII=",
  );
}

function getAppUrl(mode) {
  if (isDevServer) {
    return `${process.env.VITE_DEV_SERVER_URL}?mode=${mode}`;
  }

  const indexUrl = pathToFileURL(path.join(__dirname, "..", "dist", "index.html"));
  indexUrl.searchParams.set("mode", mode);

  return indexUrl.toString();
}

function createWindow(mode = "main") {
  const isMini = mode === "mini";
  const existingWindow = isMini ? miniWindow : mainWindow;

  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.show();
    existingWindow.focus();
    return existingWindow;
  }

  const window = new BrowserWindow({
    width: isMini ? 390 : 1280,
    height: isMini ? 590 : 820,
    minWidth: isMini ? 340 : 980,
    minHeight: isMini ? 480 : 640,
    title: isMini ? "Todolist 挂件" : "Todolist",
    alwaysOnTop: isMini,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.loadURL(getAppUrl(mode));

  window.on("closed", () => {
    if (isMini) {
      miniWindow = null;
      return;
    }

    mainWindow = null;
  });

  if (isMini) {
    miniWindow = window;
  } else {
    mainWindow = window;
  }

  return window;
}

function getAllWindows() {
  return BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
}

function broadcastTasksChanged(data, sender) {
  getAllWindows().forEach((window) => {
    if (window.webContents === sender) {
      return;
    }

    window.webContents.send("tasks:changed", data);
  });
}

function setupTray() {
  if (tray) {
    return;
  }

  tray = new Tray(createTrayIcon());
  tray.setToolTip("Todolist");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "打开主窗口",
        click: () => createWindow("main"),
      },
      {
        label: "打开迷你挂件",
        click: () => createWindow("mini"),
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => app.quit(),
      },
    ]),
  );
  tray.on("double-click", () => createWindow("main"));
}

function setupIpc() {
  ipcMain.handle("tasks:load", (_event, migrationCandidate) => taskStore.load(migrationCandidate));

  ipcMain.handle("tasks:save", (event, data) => {
    const saved = taskStore.save(data);
    broadcastTasksChanged(saved, event.sender);

    return {
      data: saved,
      status: {
        storagePath: taskStore.dataPath,
      },
    };
  });

  ipcMain.handle("tasks:export", async () => {
    const result = await dialog.showSaveDialog({
      title: "导出 Todolist 数据",
      defaultPath: "todolist-backup.json",
      filters: [{ name: "JSON 文件", extensions: ["json"] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    taskStore.exportTo(result.filePath);

    return {
      canceled: false,
      filePath: result.filePath,
    };
  });

  ipcMain.handle("tasks:import", async (event) => {
    const result = await dialog.showOpenDialog({
      title: "导入 Todolist 数据",
      properties: ["openFile"],
      filters: [{ name: "JSON 文件", extensions: ["json"] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const data = taskStore.importFrom(result.filePaths[0]);
    broadcastTasksChanged(data, event.sender);

    return {
      canceled: false,
      data,
      filePath: result.filePaths[0],
    };
  });

  ipcMain.handle("tasks:open-storage-folder", () => {
    shell.showItemInFolder(taskStore.dataPath);
  });

  ipcMain.handle("window:open-main", () => createWindow("main"));
  ipcMain.handle("window:open-mini", () => createWindow("mini"));
  ipcMain.handle("window:set-mini-always-on-top", (event, enabled) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (window) {
      window.setAlwaysOnTop(Boolean(enabled));
    }
  });
}

app.whenReady().then(() => {
  taskStore = createTaskStore(app.getPath("userData"));
  setupIpc();
  setupTray();
  createWindow("main");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow("main");
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
