const { calculateGridPositions } = require('../renderer/layout')

describe('calculateGridPositions', () => {
  test('single image is placed at top-left with DISPLAY_WIDTH=300', () => {
    const images = [{ naturalWidth: 1600, naturalHeight: 1200 }]
    const pos = calculateGridPositions(images, 1000)
    expect(pos).toHaveLength(1)
    expect(pos[0].x).toBe(20)
    expect(pos[0].y).toBe(20)
    expect(pos[0].width).toBe(300)
    expect(pos[0].height).toBe(225) // 1200 * (300/1600) = 225
  })

  test('second image in same row is offset by DISPLAY_WIDTH+GAP', () => {
    const images = [
      { naturalWidth: 800, naturalHeight: 600 },
      { naturalWidth: 800, naturalHeight: 600 }
    ]
    // canvasWidth=800 → cols = floor(800/320) = 2
    const pos = calculateGridPositions(images, 800)
    expect(pos[1].x).toBe(20 + 300 + 20) // 340
    expect(pos[1].y).toBe(20)
  })

  test('third image wraps to next row when cols=2', () => {
    const images = [
      { naturalWidth: 800, naturalHeight: 600 },
      { naturalWidth: 800, naturalHeight: 600 },
      { naturalWidth: 800, naturalHeight: 600 }
    ]
    // canvasWidth=700 → cols = floor(700/320) = 2
    const pos = calculateGridPositions(images, 700)
    expect(pos[2].x).toBe(20) // back to col 0
    expect(pos[2].y).toBeGreaterThan(pos[0].y)
  })

  test('narrow canvas forces single column', () => {
    const images = [
      { naturalWidth: 800, naturalHeight: 600 },
      { naturalWidth: 800, naturalHeight: 600 }
    ]
    const pos = calculateGridPositions(images, 100)
    expect(pos[0].x).toBe(20)
    expect(pos[1].x).toBe(20)
    expect(pos[1].y).toBeGreaterThan(pos[0].y)
  })

  test('returns empty array for empty input', () => {
    expect(calculateGridPositions([], 1000)).toEqual([])
  })
})
