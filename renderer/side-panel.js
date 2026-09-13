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
