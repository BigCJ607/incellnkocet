import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createDiagonalWipe, createNumReveal, createRowsReveal } from '../transitions/diagonalWipe'

gsap.registerPlugin(ScrollTrigger)

export interface UseSectionTransitionOptions {
  /** Direction of the diagonal wipe */
  direction?: 'ltr' | 'rtl'
  /** CSS selector for stagger-reveal children */
  childSelector?: string
  /** CSS selector for the oversized section number */
  numSelector?: string
  /** CSS selector for row items */
  rowSelector?: string
}

/**
 * Hook that attaches a ScrollTrigger-driven diagonal wipe reveal to a section ref.
 *
 * Usage:
 *   const sectionRef = useRef<HTMLElement>(null)
 *   useSectionTransition(sectionRef, { direction: 'ltr' })
 *   <section ref={sectionRef}>...</section>
 */
export function useSectionTransition(
  sectionRef: React.RefObject<HTMLElement | null>,
  opts: UseSectionTransitionOptions = {}
) {
  const { direction = 'ltr', childSelector = '[data-reveal]', numSelector, rowSelector } = opts
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    // Set initial clip-path so element is invisible until triggered
    gsap.set(el, {
      clipPath:
        direction === 'ltr'
          ? 'polygon(0% 0%, 0% 0%, 5% 100%, 0% 100%)'
          : 'polygon(100% 0%, 100% 0%, 95% 100%, 100% 100%)',
      opacity: 1,
    })

    tlRef.current = createDiagonalWipe(el, { direction, childSelector })

    // Num reveal
    let numTl: gsap.core.Timeline | null = null
    if (numSelector) {
      const numEl = el.querySelector(numSelector)
      if (numEl) numTl = createNumReveal(numEl, 0)
    }

    // Rows reveal
    let rowsTl: gsap.core.Timeline | null = null
    if (rowSelector) {
      const rows = el.querySelectorAll(rowSelector)
      if (rows.length) rowsTl = createRowsReveal(rows, 0)
    }

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        tlRef.current?.play()
        numTl?.play()
        // Small offset so rows stagger after wipe is mid-way
        gsap.delayedCall(0.2, () => rowsTl?.play())
      },
    })

    return () => {
      trigger.kill()
      tlRef.current?.kill()
      numTl?.kill()
      rowsTl?.kill()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
