# Multi-Image Canvas Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop app that displays multiple images on a pannable/zoomable canvas with per-image scaling, drag-to-reposition, and workspace save/load.

**Architecture:** Pure HTML Canvas 2D API for all rendering; Electron main process handles file system and native dialogs via IPC with contextBridge; renderer is vanilla JS classes with no bundler — loaded via ordered `<script>` tags sharing global scope; `app.js` orchestrates all modules.

**Tech Stack:** Electron 28+, HTML Canvas 2D API, vanilla JavaScript (CommonJS dual-export for Jest compatibility), Jest 29 for unit tests on pure-logic modules.

---

## File Map

| File | Responsibility |
|------|----------------|
| `package.json` | Project config, npm scripts, Electron + Jest dependencies |
| `main.js` | Electron main process: BrowserWindow, all IPC handlers, file system |
| `preload.js` | contextBridge: exposes 4 IPC APIs to renderer |
| `renderer/index.html` | App shell: toolbar + canvas + sidebar HTML structure |
| `renderer/styles.css` | Layout and visual styles (dark theme) |
| `renderer/image-store.js` | `ImageStore` class: ImageItem CRUD, selection, zIndex management |
| `renderer/layout.js` | `calculateGridPositions()` pure function: auto grid layout |
| `renderer/workspace.js` | `serialize()` and `deserialize()` pure functions for `.mwp` JSON |
| `renderer/canvas.js` | `CanvasController` class: render, pan/zoom, hit-test, drag |
| `renderer/side-panel.js` | `SidePanel` class: show/hide/update, scale/delete button events |
| `renderer/toolbar.js` | `Toolbar` class: import button, drag-drop, save/load buttons |
| `renderer/app.js` | Bootstrap: instantiates all classes, wires callbacks, `importImages()` |
| `tests/image-store.test.js` | Jest unit tests for `ImageStore` |
| `tests/layout.test.js` | Jest unit tests for `calculateGridPositions` |
| `tests/workspace.test.js` | Jest unit tests for `serialize` / `deserialize` |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `main.js`
- Create: `preload.js`
- Create: `renderer/index.html`
- Create: `renderer/styles.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "muti-image",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "test": "jest"
  },
  "dependencies": {
    "electron": "^28.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, Electron binary downloaded (~100MB).

- [ ] **Step 3: Create main.js**

```js
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
```

- [ ] **Step 4: Create preload.js**

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openImages: () => ipcRenderer.invoke('open-images'),
  resolveImagePaths: (paths) => ipcRenderer.invoke('resolve-image-paths', paths),
  saveWorkspace: (data) => ipcRenderer.invoke('save-workspace', data),
  loadWorkspace: () => ipcRenderer.invoke('load-workspace')
})
```

- [ ] **Step 5: Create renderer/index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; img-src 'self' file: data:; script-src 'self'">
  <title>Multi-Image Canvas</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="toolbar">
    <button id="btn-import">匯入圖片</button>
    <button id="btn-load-workspace">開啟工作區</button>
    <button id="btn-save-workspace">儲存工作區</button>
  </div>
  <div id="main">
    <div id="canvas-container">
      <canvas id="canvas"></canvas>
      <div id="drop-overlay">拖曳圖片或資料夾到這裡</div>
    </div>
    <div id="side-panel">
      <h3>屬性</h3>
      <p id="panel-hint">點選圖片以查看屬性</p>
      <div id="panel-content">
        <div class="info-row">
          <span class="info-label">檔名</span>
          <span class="info-value" id="info-name">—</span>
        </div>
        <div class="info-row">
          <span class="info-label">原始尺寸</span>
          <span class="info-value" id="info-size">—</span>
        </div>
        <div class="info-row">
          <span class="info-label">Scale</span>
          <span class="info-value" id="info-scale">—</span>
        </div>
        <button class="panel-btn" id="btn-scale-up">放大 ＋</button>
        <button class="panel-btn" id="btn-scale-down">縮小 －</button>
        <button class="panel-btn danger" id="btn-delete">刪除 ✕</button>
      </div>
    </div>
  </div>
  <script src="image-store.js"></script>
  <script src="layout.js"></script>
  <script src="workspace.js"></script>
  <script src="canvas.js"></script>
  <script src="side-panel.js"></script>
  <script src="toolbar.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 6: Create renderer/styles.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #1a1a2e;
  color: #eee;
  font-family: system-ui, sans-serif;
  user-select: none;
}

#toolbar {
  height: 44px;
  background: #12121f;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  flex-shrink: 0;
}

#toolbar button {
  background: #2a2a3e;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}
#toolbar button:hover { background: #3a3a5e; }

#main { display: flex; flex: 1; overflow: hidden; }

#canvas-container { flex: 1; position: relative; overflow: hidden; }

#canvas { width: 100%; height: 100%; display: block; cursor: default; }
#canvas.grabbing { cursor: grabbing; }

#drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(74, 170, 255, 0.12);
  border: 3px dashed #4aaeff;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #4aaeff;
  pointer-events: none;
}
#drop-overlay.visible { display: flex; }

#side-panel {
  width: 240px;
  background: #12121f;
  border-left: 1px solid #333;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}
#side-panel h3 {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
}
#panel-hint { color: #555; font-size: 13px; text-align: center; margin-top: 32px; }

#panel-content { display: none; flex-direction: column; gap: 10px; }
#panel-content.visible { display: flex; }

.info-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.info-label { color: #888; font-size: 12px; flex-shrink: 0; }
.info-value {
  color: #eee;
  font-size: 12px;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.panel-btn {
  background: #2a2a3e;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  font-size: 13px;
  text-align: center;
}
.panel-btn:hover { background: #3a3a5e; }
.panel-btn.danger { border-color: #e94560; color: #e94560; }
.panel-btn.danger:hover { background: #2a1520; }
```

- [ ] **Step 7: Launch app to verify scaffold**

```bash
npm start
```

Expected: Electron window opens with dark toolbar + empty canvas + sidebar. Console shows no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json main.js preload.js renderer/
git commit -m "feat: project scaffold — Electron shell with toolbar, canvas, sidebar"
```

---

### Task 2: ImageStore Module

**Files:**
- Create: `renderer/image-store.js`
- Create: `tests/image-store.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/image-store.test.js`:

```js
const { ImageStore } = require('../renderer/image-store')

describe('ImageStore', () => {
  test('add returns a string id and stores the item', () => {
    const store = new ImageStore()
    const id = store.add({ src: '/a.jpg', image: null, x: 10, y: 20, width: 300, height: 200, scale: 1.0 })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(store.getAll()).toHaveLength(1)
    expect(store.getAll()[0].x).toBe(10)
  })

  test('add defaults scale to 1.0 when not provided', () => {
    const store = new ImageStore()
    const id = store.add({ src: '/a.jpg', image: null, x: 0, y: 0, width: 100, height: 100 })
    expect(store.getAll()[0].scale).toBe(1.0)
  })

  test('remove deletes the item and clears selection', () => {
    const store = new ImageStore()
    const id = store.add({ src: '/a.jpg', image: null, x: 0, y: 0, width: 100, height: 100, scale: 1.0 })
    store.select(id)
    store.remove(id)
    expect(store.getAll()).toHaveLength(0)
    expect(store.getSelected()).toBeNull()
  })

  test('update changes item properties', () => {
    const store = new ImageStore()
    const id = store.add({ src: '/a.jpg', image: null, x: 0, y: 0, width: 100, height: 100, scale: 1.0 })
    store.update(id, { scale: 1.5, x: 50 })
    const item = store.getAll()[0]
    expect(item.scale).toBe(1.5)
    expect(item.x).toBe(50)
  })

  test('select sets selectedId; deselect clears it', () => {
    const store = new ImageStore()
    const id = store.add({ src: '/a.jpg', image: null, x: 0, y: 0, width: 100, height: 100, scale: 1.0 })
    store.select(id)
    expect(store.getSelected().id).toBe(id)
    store.deselect()
    expect(store.getSelected()).toBeNull()
  })

  test('getAll returns items sorted by zIndex ascending', () => {
    const store = new ImageStore()
    const id1 = store.add({ src: '/a.jpg', image: null, x: 0, y: 0, width: 100, height: 100, scale: 1.0 })
    const id2 = store.add({ src: '/b.jpg', image: null, x: 0, y: 0, width: 100, height: 100, scale: 1.0 })
    store.bringToFront(id1)
    const items = store.getAll()
    expect(items[0].id).toBe(id2)
    expect(items[1].id).toBe(id1)
  })

  test('clear removes all items and resets state', () => {
    const store = new ImageStore()
    store.add({ src: '/a.jpg', image: null, x: 0, y: 0, width: 100, height: 100, scale: 1.0 })
    store.clear()
    expect(store.getAll()).toHaveLength(0)
    expect(store.getSelected()).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/image-store.test.js
```

Expected: `Cannot find module '../renderer/image-store'`

- [ ] **Step 3: Create renderer/image-store.js**

```js
function generateId() {
  return 'img-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}

class ImageStore {
  constructor() {
    this._items = []
    this._selectedId = null
    this._nextZIndex = 0
  }

  add(data) {
    const item = {
      id: data.id || generateId(),
      src: data.src,
      image: data.image,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      scale: data.scale !== undefined ? data.scale : 1.0,
      zIndex: data.zIndex !== undefined ? data.zIndex : this._nextZIndex++
    }
    if (item.zIndex >= this._nextZIndex) this._nextZIndex = item.zIndex + 1
    this._items.push(item)
    return item.id
  }

  remove(id) {
    this._items = this._items.filter(i => i.id !== id)
    if (this._selectedId === id) this._selectedId = null
  }

  update(id, changes) {
    const item = this._items.find(i => i.id === id)
    if (item) Object.assign(item, changes)
  }

  select(id) {
    this._selectedId = id
    this.bringToFront(id)
  }

  deselect() {
    this._selectedId = null
  }

  getSelected() {
    if (!this._selectedId) return null
    return this._items.find(i => i.id === this._selectedId) || null
  }

  bringToFront(id) {
    const item = this._items.find(i => i.id === id)
    if (item) item.zIndex = this._nextZIndex++
  }

  getAll() {
    return [...this._items].sort((a, b) => a.zIndex - b.zIndex)
  }

  clear() {
    this._items = []
    this._selectedId = null
    this._nextZIndex = 0
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImageStore }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/image-store.test.js
```

Expected: `7 tests passed`

- [ ] **Step 5: Commit**

```bash
git add renderer/image-store.js tests/image-store.test.js
git commit -m "feat: add ImageStore module with unit tests"
```

---

### Task 3: Grid Layout Calculator

**Files:**
- Create: `renderer/layout.js`
- Create: `tests/layout.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/layout.test.js`:

```js
const { calculateGridPositions } = require('../renderer/layout')

describe('calculateGridPositions', () => {
  test('single image is placed at top-left with DISPLAY_WIDTH=300', () => {
    const images = [{ naturalWidth: 1600, naturalHeight: 1200 }]
    const pos = calculateGridPositions(images, 1000)
    expect(pos).toHaveLength(1)
    expect(pos[0].x).toBe(20)
    expect(pos[0].y).toBe(20)
    expect(pos[0].width).toBe(300)
    expect(pos[0].height).toBe(225) // 1200 * (300/1600) = 225
  })

  test('second image in same row is offset by DISPLAY_WIDTH+GAP', () => {
    const images = [
      { naturalWidth: 800, naturalHeight: 600 },
      { naturalWidth: 800, naturalHeight: 600 }
    ]
    // canvasWidth=800 → cols = floor(800/320) = 2
    const pos = calculateGridPositions(images, 800)
    expect(pos[1].x).toBe(20 + 300 + 20) // 340
    expect(pos[1].y).toBe(20)
  })

  test('third image wraps to next row when cols=2', () => {
    const images = [
      { naturalWidth: 800, naturalHeight: 600 },
      { naturalWidth: 800, naturalHeight: 600 },
      { naturalWidth: 800, naturalHeight: 600 }
    ]
    // canvasWidth=700 → cols = floor(700/320) = 2
    const pos = calculateGridPositions(images, 700)
    expect(pos[2].x).toBe(20) // back to col 0
    expect(pos[2].y).toBeGreaterThan(pos[0].y)
  })

  test('narrow canvas forces single column', () => {
    const images = [
      { naturalWidth: 800, naturalHeight: 600 },
      { naturalWidth: 800, naturalHeight: 600 }
    ]
    const pos = calculateGridPositions(images, 100)
    expect(pos[0].x).toBe(20)
    expect(pos[1].x).toBe(20)
    expect(pos[1].y).toBeGreaterThan(pos[0].y)
  })

  test('returns empty array for empty input', () => {
    expect(calculateGridPositions([], 1000)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/layout.test.js
```

Expected: `Cannot find module '../renderer/layout'`

- [ ] **Step 3: Create renderer/layout.js**

```js
function calculateGridPositions(images, canvasWidth) {
  if (images.length === 0) return []
  const DISPLAY_WIDTH = 300
  const GAP = 20
  const cols = Math.max(1, Math.floor(canvasWidth / (DISPLAY_WIDTH + GAP)))

  const positions = []
  let col = 0
  let rowY = GAP
  let rowMaxHeight = 0

  for (const img of images) {
    const displayHeight = Math.round(img.naturalHeight * (DISPLAY_WIDTH / img.naturalWidth))

    if (col >= cols) {
      col = 0
      rowY += rowMaxHeight + GAP
      rowMaxHeight = 0
    }

    positions.push({
      x: GAP + col * (DISPLAY_WIDTH + GAP),
      y: rowY,
      width: DISPLAY_WIDTH,
      height: displayHeight
    })

    rowMaxHeight = Math.max(rowMaxHeight, displayHeight)
    col++
  }

  return positions
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateGridPositions }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/layout.test.js
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add renderer/layout.js tests/layout.test.js
git commit -m "feat: add grid layout calculator with unit tests"
```

---

### Task 4: Workspace Serializer

**Files:**
- Create: `renderer/workspace.js`
- Create: `tests/workspace.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/workspace.test.js`:

```js
const { serialize, deserialize } = require('../renderer/workspace')

describe('serialize', () => {
  test('produces version 1 object with viewport and images array', () => {
    const items = [{
      id: 'img-1', src: '/foo.jpg', image: { naturalWidth: 800, naturalHeight: 600 },
      x: 10, y: 20, width: 300, height: 225, scale: 1.0, zIndex: 0
    }]
    const viewport = { x: 5, y: -10, zoom: 1.5 }
    const result = serialize(items, viewport)
    expect(result.version).toBe(1)
    expect(result.viewport).toEqual({ x: 5, y: -10, zoom: 1.5 })
    expect(result.images).toHaveLength(1)
  })

  test('serialized image has path (not src) and no image object', () => {
    const items = [{
      id: 'img-1', src: '/foo.jpg', image: {},
      x: 10, y: 20, width: 300, height: 225, scale: 1.2, zIndex: 2
    }]
    const result = serialize(items, { x: 0, y: 0, zoom: 1 })
    const img = result.images[0]
    expect(img.path).toBe('/foo.jpg')
    expect(img.image).toBeUndefined()
    expect(img.scale).toBe(1.2)
    expect(img.zIndex).toBe(2)
  })
})

describe('deserialize', () => {
  test('returns viewport and items array with src (not path) and image: null', () => {
    const data = {
      version: 1,
      viewport: { x: 5, y: -10, zoom: 1.5 },
      images: [{
        id: 'img-1', path: '/foo.jpg',
        x: 10, y: 20, width: 300, height: 225, scale: 1.2, zIndex: 2
      }]
    }
    const result = deserialize(data)
    expect(result.viewport).toEqual({ x: 5, y: -10, zoom: 1.5 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].src).toBe('/foo.jpg')
    expect(result.items[0].image).toBeNull()
    expect(result.items[0].id).toBe('img-1')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/workspace.test.js
```

Expected: `Cannot find module '../renderer/workspace'`

- [ ] **Step 3: Create renderer/workspace.js**

```js
function serialize(items, viewport) {
  return {
    version: 1,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    images: items.map(item => ({
      id: item.id,
      path: item.src,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      scale: item.scale,
      zIndex: item.zIndex
    }))
  }
}

function deserialize(data) {
  return {
    viewport: { x: data.viewport.x, y: data.viewport.y, zoom: data.viewport.zoom },
    items: data.images.map(img => ({
      id: img.id,
      src: img.path,
      image: null,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      scale: img.scale,
      zIndex: img.zIndex
    }))
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { serialize, deserialize }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/workspace.test.js
```

Expected: `3 tests passed`

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: `15 tests passed` across 3 suites.

- [ ] **Step 6: Commit**

```bash
git add renderer/workspace.js tests/workspace.test.js
git commit -m "feat: add workspace serializer with unit tests"
```

---

### Task 5: CanvasController (Render + Interactions)

**Files:**
- Create: `renderer/canvas.js`

- [ ] **Step 1: Create renderer/canvas.js**

```js
class CanvasController {
  constructor(canvasEl, imageStore) {
    this._canvas = canvasEl
    this._ctx = canvasEl.getContext('2d')
    this._store = imageStore
    this._viewport = { x: 0, y: 0, zoom: 1.0 }
    this._dragState = null
    this._onSelect = null

    this._setupResize()
    this._bindEvents()
  }

  get viewport() { return this._viewport }

  setOnSelect(callback) { this._onSelect = callback }

  loadViewport(vp) {
    this._viewport.x = vp.x
    this._viewport.y = vp.y
    this._viewport.zoom = vp.zoom
  }

  render() {
    const ctx = this._ctx
    const vp = this._viewport
    const w = this._canvas.width
    const h = this._canvas.height
    ctx.clearRect(0, 0, w, h)

    const selected = this._store.getSelected()

    for (const item of this._store.getAll()) {
      const sx = item.x * vp.zoom + vp.x
      const sy = item.y * vp.zoom + vp.y
      const sw = item.width * item.scale * vp.zoom
      const sh = item.height * item.scale * vp.zoom

      if (!item.image) {
        ctx.fillStyle = '#2a2a3e'
        ctx.fillRect(sx, sy, sw, sh)
        ctx.fillStyle = '#888'
        ctx.font = `${Math.max(10, Math.round(14 * vp.zoom))}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('⚠ 檔案未找到', sx + sw / 2, sy + sh / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      } else {
        ctx.drawImage(item.image, sx, sy, sw, sh)
      }

      if (selected && item.id === selected.id) {
        ctx.strokeStyle = '#4aaeff'
        ctx.lineWidth = 2
        ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2)
      }
    }
  }

  _setupResize() {
    const sync = () => {
      this._canvas.width = this._canvas.clientWidth
      this._canvas.height = this._canvas.clientHeight
      this.render()
    }
    new ResizeObserver(sync).observe(this._canvas)
    sync()
  }

  _getPos(e) {
    const r = this._canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  _hitTest(mx, my) {
    const vp = this._viewport
    const items = this._store.getAll().reverse()
    for (const item of items) {
      const sx = item.x * vp.zoom + vp.x
      const sy = item.y * vp.zoom + vp.y
      const sw = item.width * item.scale * vp.zoom
      const sh = item.height * item.scale * vp.zoom
      if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) return item
    }
    return null
  }

  _bindEvents() {
    const c = this._canvas

    c.addEventListener('wheel', (e) => {
      e.preventDefault()
      const { x, y } = this._getPos(e)
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(10, Math.max(0.05, this._viewport.zoom * factor))
      const actual = newZoom / this._viewport.zoom
      this._viewport.x = x - (x - this._viewport.x) * actual
      this._viewport.y = y - (y - this._viewport.y) * actual
      this._viewport.zoom = newZoom
      this.render()
    }, { passive: false })

    c.addEventListener('mousedown', (e) => {
      const { x, y } = this._getPos(e)
      if (e.button === 1) {
        this._dragState = { type: 'pan', sx: x, sy: y, vx: this._viewport.x, vy: this._viewport.y }
        return
      }
      if (e.button === 0) {
        const hit = this._hitTest(x, y)
        if (hit) {
          this._store.select(hit.id)
          if (this._onSelect) this._onSelect(this._store.getSelected())
          this._dragState = { type: 'move', sx: x, sy: y, itemId: hit.id, ix: hit.x, iy: hit.y }
        } else {
          this._store.deselect()
          if (this._onSelect) this._onSelect(null)
          this._dragState = { type: 'pan', sx: x, sy: y, vx: this._viewport.x, vy: this._viewport.y }
        }
        this.render()
      }
    })

    c.addEventListener('mousemove', (e) => {
      if (!this._dragState) return
      const { x, y } = this._getPos(e)
      const dx = x - this._dragState.sx
      const dy = y - this._dragState.sy
      if (this._dragState.type === 'pan') {
        this._viewport.x = this._dragState.vx + dx
        this._viewport.y = this._dragState.vy + dy
        c.classList.add('grabbing')
      } else {
        this._store.update(this._dragState.itemId, {
          x: this._dragState.ix + dx / this._viewport.zoom,
          y: this._dragState.iy + dy / this._viewport.zoom
        })
      }
      this.render()
    })

    const stop = () => { this._dragState = null; c.classList.remove('grabbing') }
    c.addEventListener('mouseup', stop)
    c.addEventListener('mouseleave', stop)
  }
}
```

- [ ] **Step 2: Add temporary test in index.html to verify canvas renders**

Open `renderer/index.html` and add this script tag just before `</body>` (after `app.js`) for manual smoke-test only — remove it in the next step:

```html
<script>
  // Smoke test: add a fake colored item to verify render
  document.addEventListener('DOMContentLoaded', () => {
    // Will test once app.js exists; skip for now
    console.log('Canvas scaffold ready')
  })
</script>
```

- [ ] **Step 3: Run app and verify canvas fills the window**

```bash
npm start
```

Expected: Dark window, canvas fills the left area, sidebar is 240px on the right. Open DevTools (Ctrl+Shift+I) and verify no errors in console.

- [ ] **Step 4: Remove the smoke-test script tag from index.html**

Delete the `<script>` block added in step 2.

- [ ] **Step 5: Commit**

```bash
git add renderer/canvas.js renderer/index.html
git commit -m "feat: add CanvasController with render, pan/zoom, hit-test, drag"
```

---

### Task 6: SidePanel Module

**Files:**
- Create: `renderer/side-panel.js`

- [ ] **Step 1: Create renderer/side-panel.js**

```js
class SidePanel {
  constructor(els) {
    // els: { hint, content, nameEl, sizeEl, scaleEl, btnUp, btnDown, btnDel }
    this._hint = els.hint
    this._content = els.content
    this._nameEl = els.nameEl
    this._sizeEl = els.sizeEl
    this._scaleEl = els.scaleEl
    this._currentId = null
    this._onScaleUp = null
    this._onScaleDown = null
    this._onDelete = null

    els.btnUp.addEventListener('click', () => {
      if (this._currentId && this._onScaleUp) this._onScaleUp(this._currentId)
    })
    els.btnDown.addEventListener('click', () => {
      if (this._currentId && this._onScaleDown) this._onScaleDown(this._currentId)
    })
    els.btnDel.addEventListener('click', () => {
      if (this._currentId && this._onDelete) this._onDelete(this._currentId)
    })
  }

  setOnScaleUp(cb) { this._onScaleUp = cb }
  setOnScaleDown(cb) { this._onScaleDown = cb }
  setOnDelete(cb) { this._onDelete = cb }

  show(item) {
    this._currentId = item.id
    const filename = item.src.split(/[\\/]/).pop()
    const nw = item.image ? item.image.naturalWidth : item.width
    const nh = item.image ? item.image.naturalHeight : item.height
    this._nameEl.textContent = filename
    this._sizeEl.textContent = `${Math.round(nw)} × ${Math.round(nh)}`
    this._scaleEl.textContent = item.scale.toFixed(2)
    this._hint.style.display = 'none'
    this._content.classList.add('visible')
  }

  updateScale(scale) {
    this._scaleEl.textContent = scale.toFixed(2)
  }

  hide() {
    this._currentId = null
    this._hint.style.display = ''
    this._content.classList.remove('visible')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add renderer/side-panel.js
git commit -m "feat: add SidePanel module"
```

---

### Task 7: Toolbar + Image Import

**Files:**
- Create: `renderer/toolbar.js`

- [ ] **Step 1: Create renderer/toolbar.js**

```js
class Toolbar {
  constructor(els) {
    // els: { btnImport, btnLoad, btnSave, dropOverlay, canvasContainer }
    this._onImport = null
    this._onLoad = null
    this._onSave = null

    els.btnImport.addEventListener('click', async () => {
      const paths = await window.electronAPI.openImages()
      if (paths.length > 0 && this._onImport) this._onImport(paths)
    })

    els.btnLoad.addEventListener('click', () => {
      if (this._onLoad) this._onLoad()
    })

    els.btnSave.addEventListener('click', () => {
      if (this._onSave) this._onSave()
    })

    const overlay = els.dropOverlay
    const container = els.canvasContainer

    container.addEventListener('dragover', (e) => {
      e.preventDefault()
      overlay.classList.add('visible')
    })
    container.addEventListener('dragleave', (e) => {
      if (!container.contains(e.relatedTarget)) overlay.classList.remove('visible')
    })
    container.addEventListener('drop', async (e) => {
      e.preventDefault()
      overlay.classList.remove('visible')
      const rawPaths = Array.from(e.dataTransfer.files).map(f => f.path)
      if (rawPaths.length === 0) return
      const paths = await window.electronAPI.resolveImagePaths(rawPaths)
      if (paths.length > 0 && this._onImport) this._onImport(paths)
    })
  }

  setOnImport(cb) { this._onImport = cb }
  setOnLoad(cb) { this._onLoad = cb }
  setOnSave(cb) { this._onSave = cb }
}
```

- [ ] **Step 2: Commit**

```bash
git add renderer/toolbar.js
git commit -m "feat: add Toolbar module with file dialog and drag-drop import"
```

---

### Task 8: App Bootstrap — Wire Everything Together

**Files:**
- Create: `renderer/app.js`

- [ ] **Step 1: Create renderer/app.js**

```js
function loadImageFromPath(filePath) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${filePath}`))
    // Normalize Windows backslashes and ensure three slashes for absolute path
    const url = 'file:///' + filePath.replace(/\\/g, '/')
    img.src = url
  })
}

async function importImages(paths) {
  const canvasWidth = document.getElementById('canvas').clientWidth

  const loaded = await Promise.all(paths.map(async (p) => {
    try {
      const img = await loadImageFromPath(p)
      return { path: p, image: img, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }
    } catch (e) {
      console.warn(e.message)
      return null
    }
  }))

  const valid = loaded.filter(Boolean)
  if (valid.length === 0) return

  const positions = calculateGridPositions(valid, canvasWidth)
  valid.forEach((imgData, i) => {
    store.add({
      src: imgData.path,
      image: imgData.image,
      x: positions[i].x,
      y: positions[i].y,
      width: positions[i].width,
      height: positions[i].height,
      scale: 1.0
    })
  })

  controller.render()
}

// --- Bootstrap ---
const store = new ImageStore()

const controller = new CanvasController(
  document.getElementById('canvas'),
  store
)

const panel = new SidePanel({
  hint: document.getElementById('panel-hint'),
  content: document.getElementById('panel-content'),
  nameEl: document.getElementById('info-name'),
  sizeEl: document.getElementById('info-size'),
  scaleEl: document.getElementById('info-scale'),
  btnUp: document.getElementById('btn-scale-up'),
  btnDown: document.getElementById('btn-scale-down'),
  btnDel: document.getElementById('btn-delete')
})

const toolbar = new Toolbar({
  btnImport: document.getElementById('btn-import'),
  btnLoad: document.getElementById('btn-load-workspace'),
  btnSave: document.getElementById('btn-save-workspace'),
  dropOverlay: document.getElementById('drop-overlay'),
  canvasContainer: document.getElementById('canvas-container')
})

// Canvas selection → panel
controller.setOnSelect((item) => {
  if (item) panel.show(item)
  else panel.hide()
})

// Panel scale up
panel.setOnScaleUp((id) => {
  const item = store.getAll().find(i => i.id === id)
  if (!item) return
  const newScale = Math.min(20, item.scale * 1.2)
  store.update(id, { scale: newScale })
  panel.updateScale(newScale)
  controller.render()
})

// Panel scale down
panel.setOnScaleDown((id) => {
  const item = store.getAll().find(i => i.id === id)
  if (!item) return
  const newScale = Math.max(0.05, item.scale / 1.2)
  store.update(id, { scale: newScale })
  panel.updateScale(newScale)
  controller.render()
})

// Panel delete
panel.setOnDelete((id) => {
  store.remove(id)
  panel.hide()
  controller.render()
})

// Toolbar import
toolbar.setOnImport(importImages)

// Toolbar save workspace
toolbar.setOnSave(async () => {
  const data = serialize(store.getAll(), controller.viewport)
  await window.electronAPI.saveWorkspace(data)
})

// Toolbar load workspace
toolbar.setOnLoad(async () => {
  const data = await window.electronAPI.loadWorkspace()
  if (!data) return

  const { viewport, items } = deserialize(data)
  store.clear()
  panel.hide()

  for (const itemData of items) {
    try {
      const img = await loadImageFromPath(itemData.src)
      store.add({ ...itemData, image: img })
    } catch (e) {
      console.warn(`File not found on load: ${itemData.src}`)
      store.add({ ...itemData, image: null })
    }
  }

  controller.loadViewport(viewport)
  controller.render()
})
```

- [ ] **Step 2: Run all unit tests**

```bash
npm test
```

Expected: `15 tests passed, 3 suites`

- [ ] **Step 3: Launch and test full app**

```bash
npm start
```

Manual verification checklist:
1. Click "匯入圖片" → file dialog opens → select 3+ images → they appear in grid on canvas
2. Scroll mouse wheel → canvas zooms in/out centered on cursor
3. Drag on empty area → canvas pans
4. Click an image → blue selection border + side panel shows filename, size, scale
5. Click "放大 ＋" in panel → selected image gets larger, scale value updates
6. Click "縮小 －" in panel → selected image gets smaller
7. Drag an image → it moves to new position
8. Click "刪除 ✕" → image removed from canvas, panel hides
9. Click "儲存工作區" → save dialog → save as `test.mwp`
10. Drag a folder containing images → images load and arrange in grid
11. Close app, reopen, click "開啟工作區" → load `test.mwp` → images restored at saved positions/scales

- [ ] **Step 4: Commit**

```bash
git add renderer/app.js
git commit -m "feat: wire all modules in app.js — full app working"
```

---

## Done

All tasks complete. Run `npm start` to launch the app.
