import { gsap } from 'gsap'

export interface ShardElement {
  el: HTMLElement
  centroid: [number, number]
  originX: number
  originY: number
}

export interface ShatterAnimationOptions {
  shards: ShardElement[]
  glowEl: HTMLElement
  panelCenterX: number
  panelCenterY: number
  onComplete?: () => void
}

/**
 * Build and play the full shatter GSAP timeline.
 *
 * Sequence:
 *  t=0.00 — GlowBurst radial gradient fades in at panel center
 *  t=0.05 — All shards explode outward (random angle, distance, rotation, scale, fade)
 *  t=0.40 — GlowBurst fades out
 *  t=0.70 — onComplete fires
 */
export function playShatterAnimation(opts: ShatterAnimationOptions): gsap.core.Timeline {
  const { shards, glowEl, onComplete } = opts

  const tl = gsap.timeline({
    onComplete,
  })

  // --- GlowBurst in ---
  tl.fromTo(
    glowEl,
    { opacity: 0, scale: 0.4 },
    { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out' },
    0
  )

  // --- Shards explode ---
  shards.forEach((shard, i) => {
    const angle = Math.random() * Math.PI * 2
    const dist = 130 + Math.random() * 300
    const tx = Math.cos(angle) * dist
    const ty = Math.sin(angle) * dist
    const rot = (Math.random() - 0.5) * 720
    const stagger = i * (80 / shards.length / 1000) // spread 0–80ms

    tl.fromTo(
      shard.el,
      { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 },
      {
        x: tx,
        y: ty,
        rotation: rot,
        scale: 0.15 + Math.random() * 0.25,
        opacity: 0,
        duration: 0.55 + Math.random() * 0.12,
        ease: 'power3.out',
      },
      0.05 + stagger
    )
  })

  // --- GlowBurst out ---
  tl.to(
    glowEl,
    { opacity: 0, scale: 2.2, duration: 0.32, ease: 'power2.in' },
    0.22
  )

  return tl
}
