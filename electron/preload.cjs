const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  tasks: {
    load: (migrationCandidate) => ipcRenderer.invoke("tasks:load", migrationCandidate),
    save: (data) => ipcRenderer.invoke("tasks:save", data),
    export: () => ipcRenderer.invoke("tasks:export"),
    import: () => ipcRenderer.invoke("tasks:import"),
    openStorageFolder: () => ipcRenderer.invoke("tasks:open-storage-folder"),
    onChanged: (callback) => {
      const listener = (_event, data) => callback(data);

      ipcRenderer.on("tasks:changed", listener);

      return () => ipcRenderer.removeListener("tasks:changed", listener);
    },
  },
  openMainWindow: () => ipcRenderer.invoke("window:open-main"),
  openMiniWindow: () => ipcRenderer.invoke("window:open-mini"),
  setMiniAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:set-mini-always-on-top", enabled),
});
