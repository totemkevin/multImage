class CanvasController {
  constructor(canvasEl, imageStore) {
    this._canvas = canvasEl
    this._ctx = canvasEl.getContext('2d')
    this._store = imageStore
    this._viewport = { x: 0, y: 0, zoom: 1.0 }
    this._dragState = null
    this._onSelect = null
    this._locked = false

    this._setupResize()
    this._bindEvents()
  }

  get viewport() { return this._viewport }

  setOnSelect(callback) { this._onSelect = callback }

  setLocked(bool) { this._locked = bool }

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
    const items = this._store.getAll().slice().reverse()
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
        this._startWindowDrag(c)
        return
      }
      if (e.button === 0) {
        if (this._locked) return
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

  _startWindowDrag(c) {
    const onMove = (e) => {
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
    }
    const onUp = () => {
      this._dragState = null
      c.classList.remove('grabbing')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
}
