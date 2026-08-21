import { Delaunay } from 'd3-delaunay'

export interface VoronoiPolygon {
  path: string
  centroid: [number, number]
  /** Clip-path string for CSS (percent-based relative to rect) */
  clipPathPercent: string
}

/**
 * Generate N Voronoi polygons clipped to the given bounding rect.
 *
 * @param rect  - The bounding rectangle (e.g. from getBoundingClientRect)
 * @param count - Number of shards (30–60 recommended)
 * @returns     - Array of VoronoiPolygon descriptors
 */
export function generateVoronoi(
  rect: { x: number; y: number; width: number; height: number },
  count: number = 40
): VoronoiPolygon[] {
  const { x, y, width, height } = rect

  // Seed points: jitter-distributed across the rect with weighted center bias
  const points: [number, number][] = []
  const cols = Math.ceil(Math.sqrt(count * (width / height)))
  const rows = Math.ceil(count / cols)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (points.length >= count) break
      const cx = x + (c / cols) * width + (Math.random() - 0.5) * (width / cols) * 0.9
      const cy = y + (r / rows) * height + (Math.random() - 0.5) * (height / rows) * 0.9
      points.push([
        Math.max(x, Math.min(x + width, cx)),
        Math.max(y, Math.min(y + height, cy)),
      ])
    }
  }

  // Pad with a few random points for irregular edges
  while (points.length < count) {
    points.push([x + Math.random() * width, y + Math.random() * height])
  }

  const delaunay = Delaunay.from(points)
  const voronoi = delaunay.voronoi([x, y, x + width, y + height])

  const polygons: VoronoiPolygon[] = []

  for (let i = 0; i < count; i++) {
    const cell = voronoi.cellPolygon(i)
    if (!cell || cell.length < 3) continue

    // Build SVG path string
    const d =
      cell
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt[0].toFixed(2)},${pt[1].toFixed(2)}`)
        .join(' ') + ' Z'

    // Centroid
    const cx = cell.reduce((s, p) => s + p[0], 0) / cell.length
    const cy = cell.reduce((s, p) => s + p[1], 0) / cell.length

    // CSS clip-path percent string (relative to element bounds)
    const clipPoints = cell
      .map(
        (pt) =>
          `${(((pt[0] - x) / width) * 100).toFixed(2)}% ${(((pt[1] - y) / height) * 100).toFixed(2)}%`
      )
      .join(', ')

    polygons.push({
      path: d,
      centroid: [cx, cy],
      clipPathPercent: `polygon(${clipPoints})`,
    })
  }

  return polygons
}
