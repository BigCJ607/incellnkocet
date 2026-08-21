import { useRef, useState, useCallback } from 'react'
import { generateVoronoi } from '../components/shatter/voronoi'
import { playShatterAnimation } from '../components/shatter/shatterAnimation'

export type ShatterState = 'idle' | 'shattering' | 'done'

export interface UseShatterReturn {
  state: ShatterState
  fire: () => void
}

/**
 * Hook that wires a panel ref to the shatter system.
 *
 * Usage:
 *   const { state, fire } = useShatter(panelRef)
 *   <button onClick={fire}>Submit</button>
 *   {state !== 'idle' && <ShatterOverlay panelRef={panelRef} onDone={...} />}
 */
export function useShatter(
  panelRef: React.RefObject<HTMLElement | null>,
  onDone?: () => void
): UseShatterReturn {
  const [state, setState] = useState<ShatterState>('idle')
  const firedRef = useRef(false)

  const fire = useCallback(() => {
    if (firedRef.current || !panelRef.current) return
    firedRef.current = true
    setState('shattering')

    const rect = panelRef.current.getBoundingClientRect()
    const shardCount = 42
    const polygons = generateVoronoi(
      { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      shardCount
    )

    // Create overlay container
    const overlay = document.createElement('div')
    overlay.className = 'shatter-overlay'
    document.body.appendChild(overlay)

    // Snapshot panel background color for shards
    const panelBg = window.getComputedStyle(panelRef.current).backgroundColor || '#111111'
    const panelBorder = window.getComputedStyle(panelRef.current).borderColor

    // Create glow burst element
    const glowEl = document.createElement('div')
    glowEl.className = 'glow-burst'
    const glowSize = Math.max(rect.width, rect.height) * 1.4
    Object.assign(glowEl.style, {
      width: `${glowSize}px`,
      height: `${glowSize}px`,
      left: `${rect.left + rect.width / 2 - glowSize / 2}px`,
      top: `${rect.top + rect.height / 2 - glowSize / 2}px`,
      background: 'radial-gradient(circle at center, #22D3EE 0%, rgba(99,102,241,0.6) 35%, transparent 70%)',
      opacity: '0',
    })
    overlay.appendChild(glowEl)

    // Create shard elements
    const shardEls = polygons.map((poly) => {
      const el = document.createElement('div')
      el.className = 'shard'
      Object.assign(el.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        background: panelBg,
        border: `1px solid ${panelBorder}`,
        clipPath: poly.clipPathPercent,
        transformOrigin: `${poly.centroid[0] - rect.left}px ${poly.centroid[1] - rect.top}px`,
      })
      overlay.appendChild(el)
      return {
        el,
        centroid: poly.centroid,
        originX: poly.centroid[0] - rect.left,
        originY: poly.centroid[1] - rect.top,
      }
    })

    // Hide original panel
    if (panelRef.current) {
      panelRef.current.style.visibility = 'hidden'
    }

    // Play animation
    playShatterAnimation({
      shards: shardEls,
      glowEl,
      panelCenterX: rect.left + rect.width / 2,
      panelCenterY: rect.top + rect.height / 2,
      onComplete: () => {
        document.body.removeChild(overlay)
        setState('done')
        onDone?.()
      },
    })
  }, [panelRef, onDone])

  return { state, fire }
}
