const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('fs')
const path = require('path')

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile('renderer/index.html')
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

ipcMain.handle('open-images', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }]
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('resolve-image-paths', async (event, paths) => {
  const results = []
  for (const p of paths) {
    try {
      const stat = fs.statSync(p)
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(p)) {
          if (IMAGE_EXTS.has(path.extname(entry).toLowerCase())) {
            results.push(path.join(p, entry))
          }
        }
      } else if (IMAGE_EXTS.has(path.extname(p).toLowerCase())) {
        results.push(p)
      }
    } catch (e) {
      console.warn(`Cannot access: ${p}`)
    }
  }
  return results
})

ipcMain.handle('save-workspace', async (event, data) => {
  const result = await dialog.showSaveDialog({
    defaultPath: 'workspace.mwp',
    filters: [{ name: 'Workspace', extensions: ['mwp'] }]
  })
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8')
    return true
  }
  return false
})

ipcMain.handle('load-workspace', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Workspace', extensions: ['mwp'] }]
  })
  if (!result.canceled) {
    return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
  }
  return null
})
