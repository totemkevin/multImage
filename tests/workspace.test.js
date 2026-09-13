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
