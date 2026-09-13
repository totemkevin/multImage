const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openImages: () => ipcRenderer.invoke('open-images'),
  resolveImagePaths: (paths) => ipcRenderer.invoke('resolve-image-paths', paths),
  saveWorkspace: (data) => ipcRenderer.invoke('save-workspace', data),
  loadWorkspace: () => ipcRenderer.invoke('load-workspace')
})
