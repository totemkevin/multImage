function calculateGridPositions(images, canvasWidth) {
  if (images.length === 0) return []
  const DISPLAY_WIDTH = 300
  const GAP = 20
  const cols = Math.max(1, Math.floor(canvasWidth / (DISPLAY_WIDTH + GAP)))

  const positions = []
  let col = 0
  let rowY = GAP
  let rowMaxHeight = 0

  for (const img of images) {
    const displayHeight = Math.round(img.naturalHeight * (DISPLAY_WIDTH / img.naturalWidth))

    if (col >= cols) {
      col = 0
      rowY += rowMaxHeight + GAP
      rowMaxHeight = 0
    }

    positions.push({
      x: GAP + col * (DISPLAY_WIDTH + GAP),
      y: rowY,
      width: DISPLAY_WIDTH,
      height: displayHeight
    })

    rowMaxHeight = Math.max(rowMaxHeight, displayHeight)
    col++
  }

  return positions
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateGridPositions }
}
