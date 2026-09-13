# 工作區鎖定功能 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工具列加入全域鎖定切換按鈕，鎖定後圖片無法被選取或拖曳，但畫布 pan/zoom 仍然有效。

**Architecture:** `locked` 狀態由 `app.js` 持有，透過 `canvas.setLocked(bool)` 傳遞給畫布，`toolbar.js` 提供 `setOnLockToggle(cb)` 回調接口。鎖定時 `mousedown` 命中圖片直接 return，空白處 pan 不受影響；鎖定觸發時自動取消選取並隱藏側邊面板。

**Tech Stack:** Electron 28, vanilla JavaScript (ES6 class), HTML Canvas 2D API, CSS

---

## 檔案變更地圖

| 檔案 | 動作 |
|------|------|
| `renderer/index.html` | 修改 — 工具列加入鎖定按鈕 |
| `renderer/styles.css` | 修改 — 加入鎖定按鈕的 active 樣式 |
| `renderer/toolbar.js` | 修改 — 加入 `setOnLockToggle(cb)` 方法 |
| `renderer/canvas.js` | 修改 — 加入 `_locked` 欄位、`setLocked(bool)` 方法、mousedown 守衛 |
| `renderer/app.js` | 修改 — 加入 `locked` 變數與回調接線 |

---

## Task 1: 加入鎖定按鈕 UI（index.html + styles.css + toolbar.js）

**Files:**
- Modify: `renderer/index.html:11-15`
- Modify: `renderer/styles.css`（append）
- Modify: `renderer/toolbar.js`

此任務無可獨立執行的單元測試（DOM 依賴）。完成後以手動驗證取代。

- [ ] **Step 1: 在 index.html 工具列加入鎖定按鈕**

找到 `renderer/index.html` 第 14 行的 `<button id="btn-save-workspace">` 後，加入按鈕：

```html
<div id="toolbar">
  <button id="btn-import">匯入圖片</button>
  <button id="btn-load-workspace">開啟工作區</button>
  <button id="btn-save-workspace">儲存工作區</button>
  <button id="btn-lock">🔒 鎖定</button>
</div>
```

- [ ] **Step 2: 在 styles.css 加入鎖定按鈕的 active 狀態樣式**

在 `renderer/styles.css` 最末尾加入：

```css
#btn-lock.active {
  background: #e94560;
  color: white;
  border-color: #e94560;
}
```

- [ ] **Step 3: 在 toolbar.js 加入 `setOnLockToggle` 方法**

在 `renderer/toolbar.js` 中，在 `setOnImport` 等方法之前加入：

```js
setOnLockToggle(cb) {
  this._onLockToggle = cb
  const btn = document.getElementById('btn-lock')
  btn.addEventListener('click', () => {
    const locked = btn.classList.toggle('active')
    btn.textContent = locked ? '🔓 解鎖' : '🔒 鎖定'
    if (this._onLockToggle) this._onLockToggle(locked)
  })
}
```

同時在 constructor 初始化加入 `this._onLockToggle = null`。

完整修改後的 `toolbar.js`：

```js
class Toolbar {
  constructor(els) {
    // els: { btnImport, btnLoad, btnSave, dropOverlay, canvasContainer }
    this._onImport = null
    this._onLoad = null
    this._onSave = null
    this._onLockToggle = null

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

  setOnLockToggle(cb) {
    this._onLockToggle = cb
    const btn = document.getElementById('btn-lock')
    btn.addEventListener('click', () => {
      const locked = btn.classList.toggle('active')
      btn.textContent = locked ? '🔓 解鎖' : '🔒 鎖定'
      if (this._onLockToggle) this._onLockToggle(locked)
    })
  }
}
```

- [ ] **Step 4: 確認既有測試仍通過**

```bash
cd c:/project/mutiImage && npm test
```

預期輸出：`Tests: 15 passed, 15 total`

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/styles.css renderer/toolbar.js
git commit -m "feat: add lock button UI and toolbar toggle method"
```

---

## Task 2: 實作 canvas 鎖定守衛並在 app.js 接線

**Files:**
- Modify: `renderer/canvas.js:1-12` (constructor) 和 `canvas.js:89-125` (_bindEvents)
- Modify: `renderer/app.js`（append lock wiring）

- [ ] **Step 1: 在 CanvasController 加入 `_locked` 欄位與 `setLocked` 方法**

在 `renderer/canvas.js` 的 constructor 中，在 `this._onSelect = null` 後加入：

```js
this._locked = false
```

在 `setOnSelect` 方法後加入：

```js
setLocked(bool) { this._locked = bool }
```

- [ ] **Step 2: 在 `_bindEvents` 的 `mousedown` 左鍵分支開頭加入鎖定守衛**

找到 `renderer/canvas.js` 第 111 行：`if (e.button === 0) {`，在其內部第一行（`const hit = this._hitTest(x, y)` 之前）加入守衛：

```js
if (e.button === 0) {
  const { x, y } = this._getPos(e)
  if (this._locked) {
    const hit = this._hitTest(x, y)
    if (hit) return  // 鎖定：命中圖片時不選取不拖曳
    // 空白處：繼續執行下方 pan 邏輯
    this._dragState = { type: 'pan', sx: x, sy: y, vx: this._viewport.x, vy: this._viewport.y }
    this._startWindowDrag(c)
    return
  }
  const hit = this._hitTest(x, y)
  // ... 以下原有邏輯不變
```

完整修改後的 `_bindEvents` 方法（含守衛）：

```js
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
      this._startWindowDrag(c)
      return
    }
    if (e.button === 0) {
      if (this._locked) {
        const hit = this._hitTest(x, y)
        if (hit) return
        this._dragState = { type: 'pan', sx: x, sy: y, vx: this._viewport.x, vy: this._viewport.y }
        this._startWindowDrag(c)
        return
      }
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
      this._startWindowDrag(c)
      this.render()
    }
  })
}
```

- [ ] **Step 3: 在 app.js 加入鎖定狀態與 toolbar 接線**

在 `renderer/app.js` 末尾（`toolbar.setOnLoad(...)` 區塊之後）加入：

```js
// Toolbar lock toggle
let locked = false
toolbar.setOnLockToggle((isLocked) => {
  locked = isLocked
  canvas.setLocked(locked)
  if (locked) {
    store.deselect()
    panel.hide()
  }
})
```

> **注意：** `app.js` 中的 canvas 實例變數名稱為 `controller`（見第 47 行 `const controller = new CanvasController(...)`），因此呼叫應為 `controller.setLocked(locked)`。

正確的接線程式碼：

```js
// Toolbar lock toggle
let locked = false
toolbar.setOnLockToggle((isLocked) => {
  locked = isLocked
  controller.setLocked(locked)
  if (locked) {
    store.deselect()
    panel.hide()
    controller.render()
  }
})
```

- [ ] **Step 4: 執行測試確認無迴歸**

```bash
cd c:/project/mutiImage && npm test
```

預期輸出：`Tests: 15 passed, 15 total`

- [ ] **Step 5: 手動驗證功能**

啟動應用程式：

```bash
npm start
```

驗證項目：
1. 工具列出現「🔒 鎖定」按鈕
2. 按下後按鈕變紅色，文字改為「🔓 解鎖」，側邊面板隱藏
3. 鎖定狀態下：點擊圖片 → 無反應，圖片不被選取
4. 鎖定狀態下：空白處拖曳 → 畫布平移正常
5. 鎖定狀態下：滑鼠滾輪 → 畫布縮放正常
6. 再次按下「🔓 解鎖」→ 按鈕恢復原色，文字改回「🔒 鎖定」
7. 解鎖後：點擊圖片 → 正常選取，側邊面板顯示

- [ ] **Step 6: Commit**

```bash
git add renderer/canvas.js renderer/app.js
git commit -m "feat: implement workspace lock — freeze image interaction, preserve pan/zoom"
```
