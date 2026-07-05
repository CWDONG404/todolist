const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} = require("electron");
const { createTaskStore } = require("./storage.cjs");

let mainWindow = null;
let tray = null;
let taskStore = null;
let isQuitting = false;

const isDevServer = Boolean(process.env.VITE_DEV_SERVER_URL);

app.setName("Todolist");
app.setPath("userData", path.join(app.getPath("appData"), "Todolist"));

function getLoginItemOptions() {
  if (process.defaultApp && process.argv.length >= 2) {
    return {
      path: process.execPath,
      args: [path.resolve(process.argv[1])],
    };
  }

  return {};
}

function getAutoLaunchEnabled() {
  return app.getLoginItemSettings(getLoginItemOptions()).openAtLogin;
}

function setAutoLaunchEnabled(enabled) {
  app.setLoginItemSettings({
    ...getLoginItemOptions(),
    openAtLogin: Boolean(enabled),
    openAsHidden: false,
  });

  return getAutoLaunchEnabled();
}

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

function placeWindowTopRight(window) {
  const margin = 24;
  const bounds = window.getBounds();
  const display = screen.getPrimaryDisplay();
  const { x, y, width } = display.workArea;

  window.setPosition(x + width - bounds.width - margin, y + margin, false);
}

function createWindow(mode = "widget") {
  const existingWindow = mainWindow;

  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.show();
    existingWindow.focus();
    return existingWindow;
  }

  const window = new BrowserWindow({
    width: 390,
    height: 560,
    minWidth: 330,
    minHeight: 420,
    title: "Todolist",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    backgroundMaterial: "acrylic",
    hasShadow: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.loadURL(getAppUrl(mode));

  window.once("ready-to-show", () => {
    placeWindowTopRight(window);
    window.showInactive();
    window.setAlwaysOnTop(false);
  });

  window.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    window.hide();
  });

  window.on("closed", () => {
    mainWindow = null;
  });

  mainWindow = window;

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
        label: "显示待办挂件",
        click: () => createWindow("widget"),
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => createWindow("widget"));
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

  ipcMain.handle("window:hide", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide();
  });
  ipcMain.handle("window:set-mini-always-on-top", (event, enabled) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (window) {
      window.setAlwaysOnTop(Boolean(enabled));

      return window.isAlwaysOnTop();
    }

    return false;
  });
  ipcMain.handle("window:set-appearance-material", (event, mode) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const nextMode = mode === "clear" ? "clear" : "glass";

    if (window) {
      window.setBackgroundMaterial(nextMode === "glass" ? "acrylic" : "none");
    }

    return nextMode;
  });
  ipcMain.handle("app:get-auto-launch", () => getAutoLaunchEnabled());
  ipcMain.handle("app:set-auto-launch", (_event, enabled) => setAutoLaunchEnabled(enabled));
}

app.whenReady().then(() => {
  taskStore = createTaskStore(app.getPath("userData"));
  setupIpc();
  setupTray();
  createWindow("widget");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow("widget");
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
