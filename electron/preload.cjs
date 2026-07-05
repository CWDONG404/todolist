const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  tasks: {
    load: (migrationCandidate) => ipcRenderer.invoke("tasks:load", migrationCandidate),
    save: (data) => ipcRenderer.invoke("tasks:save", data),
    openStorageFolder: () => ipcRenderer.invoke("tasks:open-storage-folder"),
    onChanged: (callback) => {
      const listener = (_event, data) => callback(data);

      ipcRenderer.on("tasks:changed", listener);

      return () => ipcRenderer.removeListener("tasks:changed", listener);
    },
  },
  hideWindow: () => ipcRenderer.invoke("window:hide"),
  setMiniAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:set-mini-always-on-top", enabled),
  getAutoLaunch: () => ipcRenderer.invoke("app:get-auto-launch"),
  setAutoLaunch: (enabled) => ipcRenderer.invoke("app:set-auto-launch", enabled),
});
