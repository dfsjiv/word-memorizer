const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('moraDesktop', {
  archiveInfo: () => ipcRenderer.invoke('archive:info'),
  loadArchive: () => ipcRenderer.invoke('archive:load'),
  saveArchive: (data) => ipcRenderer.invoke('archive:save', data),
  chooseArchiveFolder: () => ipcRenderer.invoke('archive:choose-folder'),
  useDefaultArchiveFolder: () => ipcRenderer.invoke('archive:use-default'),
  importArchive: () => ipcRenderer.invoke('archive:import'),
})
