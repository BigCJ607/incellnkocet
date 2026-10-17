import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

// Persona-5 overshoot ease
CustomEase.create('p5Overshoot', 'M0,0 C0.175,0.885 0.32,1.275 1,1')
CustomEase.create('p5Snap', 'M0,0 C0.25,0.1 0.25,1 1,1')

export interface DiagonalWipeOptions {
  /** Direction the wipe travels: 'left' → right (default) or 'right' → left */
  direction?: 'ltr' | 'rtl'
  /** Duration in seconds (max 0.5 per spec) */
  duration?: number
  /** Delay before wipe starts */
  delay?: number
  /** Stagger for child elements */
  childStagger?: number
  /** Selector for children to stagger-reveal */
  childSelector?: string
}

/**
 * Factory: creates a GSAP timeline that wipes `el` into view using
 * a diagonal CSS clip-path reveal — Persona-5 style.
 *
 * @example
 * const tl = createDiagonalWipe(sectionRef.current, { direction: 'ltr' })
 * tl.play()
 */
export function createDiagonalWipe(
  el: Element,
  opts: DiagonalWipeOptions = {}
): gsap.core.Timeline {
  const {
    direction = 'ltr',
    duration = 0.45,
    delay = 0,
    childStagger = 0.07,
    childSelector = '[data-reveal]',
  } = opts

  const ltr = direction === 'ltr'

  // Clip-path: start as empty polygon on the entering side, expand to full rect
  const start = ltr
    ? 'polygon(0% 0%, 0% 0%, 5% 100%, 0% 100%)'
    : 'polygon(100% 0%, 100% 0%, 95% 100%, 100% 100%)'
  const end = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'

  const tl = gsap.timeline({ delay, paused: true })

  // 1. Wipe the container in
  tl.fromTo(
    el,
    { clipPath: start, opacity: 1 },
    {
      clipPath: end,
      duration,
      ease: 'p5Overshoot',
    }
  )

  // 2. Stagger children with oversized-type overshoot
  const children = el.querySelectorAll(childSelector)
  if (children.length) {
    tl.fromTo(
      children,
      { y: 40, opacity: 0, scaleX: 1.08 },
      {
        y: 0,
        opacity: 1,
        scaleX: 1,
        duration: 0.35,
        ease: 'p5Overshoot',
        stagger: childStagger,
      },
      `-=${duration * 0.5}`
    )
  }

  return tl
}

/**
 * Animate oversized section-number label with a scale overshoot.
 */
export function createNumReveal(el: Element, delay = 0): gsap.core.Timeline {
  const tl = gsap.timeline({ delay, paused: true })
  tl.fromTo(
    el,
    { scaleX: 1.4, opacity: 0, x: 60 },
    { scaleX: 1, opacity: 0.08, x: 0, duration: 0.4, ease: 'p5Overshoot' }
  )
  return tl
}

/**
 * Stagger-reveal a list of elements (schedule rows, cards, etc.)
 * with a slight x-offset slide from right.
 */
export function createRowsReveal(
  els: NodeListOf<Element> | Element[],
  delay = 0
): gsap.core.Timeline {
  const tl = gsap.timeline({ delay, paused: true })
  tl.fromTo(
    els,
    { x: 40, opacity: 0 },
    {
      x: 0,
      opacity: 1,
      duration: 0.38,
      ease: 'p5Snap',
      stagger: 0.06,
    }
  )
  return tl
}
