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
