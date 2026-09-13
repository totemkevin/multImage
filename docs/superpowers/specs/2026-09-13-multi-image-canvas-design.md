# 多圖片畫布展示器 — 設計規格

**日期：** 2026-09-13
**狀態：** 已確認

---

## 概覽

一個 Electron 桌面應用程式，允許使用者在一個大型可縮放畫布上同時展示多張圖片，支援整體畫布的 pan/zoom、個別圖片的選取與縮放，以及工作區的儲存與載入。

---

## 需求摘要

| 項目 | 決定 |
|------|------|
| 框架 | Electron（純 HTML/CSS/JavaScript，無前端框架） |
| 初始排列 | 網格自動排列，之後可自由拖曳 |
| 圖片匯入 | 拖曳檔案/資料夾到視窗 + 系統開啟檔案對話框（兩者都支援） |
| 選取 UI | 點選圖片 → 右側側邊面板顯示屬性與操作 |
| 工作區 | 可儲存為 JSON 檔案、可載入，保留圖片路徑、位置、縮放狀態 |

---

## 整體架構

### Electron 兩層結構

```
main.js（主程序）
├── 建立 BrowserWindow（全螢幕，無框架選用）
├── 處理原生對話框：dialog.showOpenDialog（開啟圖片/工作區）
├── IPC 橋接：ipcMain 接收渲染程序指令
└── 工作區讀寫：fs.readFile / fs.writeFile

renderer/（渲染程序）
├── index.html          — 應用程式殼層（Canvas + 側邊面板 + 工具列）
├── canvas.js           — Canvas 2D 核心（渲染、pan/zoom、hit-test、拖曳）
├── image-store.js      — 圖片狀態管理（CRUD、zIndex 排序）
├── side-panel.js       — 右側屬性面板 DOM 邏輯
├── toolbar.js          — 頂部工具列（匯入、儲存工作區、載入工作區）
└── workspace.js        — 工作區序列化 / 反序列化
```

### 資料流

```
使用者拖入或選取圖片
    → image-store.add(ImageItem)
    → canvas.render()

使用者點選圖片
    → canvas hit-test → 找到 ImageItem
    → image-store.select(id)
    → side-panel.show(ImageItem)

使用者在側邊面板操作（縮放/刪除）
    → image-store.update(id, changes)
    → canvas.render()

使用者儲存工作區
    → workspace.serialize(imageStore, viewport)
    → IPC → main.js → fs.writeFile(.mwp)
```

---

## ImageItem 資料結構

```js
{
  id: string,            // UUID
  src: string,           // 原始檔案絕對路徑
  image: HTMLImageElement,
  x: number,             // 畫布座標（未縮放空間）
  y: number,
  width: number,         // 原始顯示寬度（px）
  height: number,        // 原始顯示高度（px）
  scale: number,         // 個別縮放倍率（預設 1.0）
  zIndex: number         // 疊層順序（點選時置頂）
}
```

---

## Canvas 核心設計

### 座標系統（兩層）

- **Viewport 層**：全域 `{ x, y, zoom }` 控制整個畫布的平移與縮放
- **Item 層**：每個 ImageItem 有自己的 `scale` 控制個別圖片大小
- 螢幕座標換算：`screenX = item.x * viewport.zoom + viewport.x`

### 畫布 Zoom（滾輪）

以滑鼠當前位置為縮放中心點：
```js
const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
viewport.x = mouseX - (mouseX - viewport.x) * zoomFactor
viewport.y = mouseY - (mouseY - viewport.y) * zoomFactor
viewport.zoom *= zoomFactor
```
縮放範圍限制：`0.05 ≤ zoom ≤ 10`

### 滑鼠互動對照表

| 動作 | 效果 |
|------|------|
| 滾輪 | 畫布整體 zoom in/out（以滑鼠位置為中心） |
| 中鍵拖曳 或 空白處左鍵拖曳 | 平移畫布（pan） |
| 左鍵點圖片 | 選取，右側面板顯示屬性，點選圖片置頂 zIndex |
| 左鍵拖曳圖片 | 移動該圖片到新位置 |
| 點空白處 | 取消選取，面板收起 |

### Hit-Test

從 `zIndex` 最高到最低依序判斷滑鼠是否在 ImageItem 邊界內，取第一個命中的圖片。

### 初始 Grid 排列

匯入圖片後，依下列規則自動排列：
- 每張圖統一縮放至寬度 `300px`（保持長寬比）
- 依視窗寬度計算每列欄數（列數 = `floor(canvasWidth / 320)`，最少 1 欄）
- 欄間距 20px，列間距 20px
- 從畫布 `(20, 20)` 開始排列

---

## UI 殼層

```
┌─────────────────────────────────────────┬──────────────┐
│  工具列：[匯入圖片] [開啟工作區] [儲存工作區] │              │
├─────────────────────────────────────────┤  側邊面板     │
│                                         │  ──────────  │
│                                         │  檔名: x.jpg │
│           Canvas（全域可縮放）            │  尺寸: 800×600│
│                                         │  Scale: 1.0  │
│                                         │  ──────────  │
│                                         │  [放大 ＋]   │
│                                         │  [縮小 －]   │
│                                         │  [刪除 ✕]   │
└─────────────────────────────────────────┴──────────────┘
```

- 側邊面板寬度：`240px`，固定在右側
- 無選取時面板顯示提示文字「點選圖片以查看屬性」
- Canvas 佔據剩餘全部空間（`calc(100vw - 240px)`）

---

## 工作區儲存格式

副檔名：`.mwp`（Multi-image Workspace）

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1.0 },
  "images": [
    {
      "id": "img-abc123",
      "path": "/Users/kevin/photos/cat.jpg",
      "x": 100,
      "y": 200,
      "width": 300,
      "height": 200,
      "scale": 1.2,
      "zIndex": 1
    }
  ]
}
```

**載入行為：**
- 以 `path` 重新讀取圖片
- 若檔案不存在，在畫布上顯示佔位符（灰色方塊 + 檔名 + 警告圖示）

---

## 支援圖片格式

`jpg`、`jpeg`、`png`、`gif`、`webp`、`bmp`（Electron Chromium 原生支援）

---

## 不在此版本範圍內

- 匯出畫布為圖片（截圖功能）
- 圖片旋轉
- 多選操作
- 撤銷/重做（Undo/Redo）
