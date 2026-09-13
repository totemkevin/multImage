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
