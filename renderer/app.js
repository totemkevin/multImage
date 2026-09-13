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
  btnLock: document.getElementById('btn-lock'),
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
  const newScale = Math.min(10, item.scale * 1.2)
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
