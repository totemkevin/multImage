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
