function serialize(items, viewport) {
  return {
    version: 1,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    images: items.map(item => ({
      id: item.id,
      path: item.src,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      scale: item.scale,
      zIndex: item.zIndex
    }))
  }
}

function deserialize(data) {
  return {
    viewport: { x: data.viewport.x, y: data.viewport.y, zoom: data.viewport.zoom },
    items: data.images.map(img => ({
      id: img.id,
      src: img.path,
      image: null,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      scale: img.scale,
      zIndex: img.zIndex
    }))
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { serialize, deserialize }
}
