# 工作區鎖定功能 — 設計規格

**日期：** 2026-09-13
**狀態：** 已確認

---

## 概覽

在多圖片畫布展示器中加入全域工作區鎖定功能，防止使用者意外移動或操作圖片，同時保留畫布的 pan/zoom 瀏覽能力。

---

## 行為規格

### 鎖定狀態

| 操作 | 未鎖定 | 鎖定後 |
|------|--------|--------|
| 滑鼠滾輪縮放 | ✅ 有效 | ✅ 有效 |
| 空白處拖曳平移 | ✅ 有效 | ✅ 有效 |
| 中鍵拖曳平移 | ✅ 有效 | ✅ 有效 |
| 點擊圖片（選取） | ✅ 有效 | ❌ 停用 |
| 拖曳圖片（移動） | ✅ 有效 | ❌ 停用 |
| 側邊面板縮放/刪除 | ✅ 有效 | ❌ 停用（面板已隱藏）|

### 鎖定觸發行為

- 按下鎖定按鈕時，自動取消目前選取（`store.deselect()`）並隱藏側邊面板
- 工具列按鈕文字切換：`🔒 鎖定` ↔ `🔓 解鎖`
- 工作區儲存（.mwp）不包含鎖定狀態；載入工作區後恆為解鎖狀態

---

## 架構設計

鎖定狀態（`locked: boolean`）由 `app.js` 持有，透過方法呼叫單向傳遞給各模組：

```
工具列按鈕 click
  → toolbar 呼叫 onLockToggle callback
  → app.js 切換 locked 變數
  → canvas.setLocked(locked)
  → 若鎖定：store.deselect() + panel.hide()
```

---

## 修改範圍

### `renderer/index.html`

工具列新增按鈕：

```html
<button id="btn-lock">🔒 鎖定</button>
```

### `renderer/canvas.js`

新增欄位與方法：

```js
_locked = false

setLocked(bool) {
  this._locked = bool
}
```

在 `mousedown` 左鍵分支開頭加守衛：

```js
if (this._locked && e.button === 0) {
  const { x, y } = this._getPos(e)
  const hit = this._hitTest(x, y)
  if (hit) return  // 鎖定：跳過選取和拖曳
  // 空白處 → 繼續執行正常 pan 邏輯
}
```

### `renderer/toolbar.js`

新增方法：

```js
setOnLockToggle(callback) {
  const btn = document.getElementById('btn-lock')
  btn.addEventListener('click', () => {
    const locked = btn.classList.toggle('active')
    btn.textContent = locked ? '🔓 解鎖' : '🔒 鎖定'
    callback(locked)
  })
}
```

### `renderer/app.js`

新增鎖定狀態與回調綁定：

```js
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

### `renderer/styles.css`

工具列鎖定按鈕的啟用狀態視覺區分：

```css
#btn-lock.active {
  background: #e94560;
  color: white;
}
```

---

## 不在此版本範圍內

- 畫布上的鎖定視覺遮罩或水印
- 個別圖片鎖定
- 鎖定狀態寫入 .mwp 工作區檔案
- 鍵盤快捷鍵觸發鎖定

---

## 測試

無需新增單元測試：鎖定守衛是 UI 互動層邏輯，依賴 DOM 事件，不適合獨立單元測試。現有 15 項測試（image-store、layout、workspace）不受影響。
