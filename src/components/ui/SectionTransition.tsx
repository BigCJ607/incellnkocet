import type { ReactNode, JSX } from 'react'
import { useRef } from 'react'
import { useSectionTransition } from '../../hooks/useSectionTransition'

interface SectionTransitionProps {
  id?: string
  children: ReactNode
  direction?: 'ltr' | 'rtl'
  childSelector?: string
  numSelector?: string
  rowSelector?: string
  className?: string
  style?: React.CSSProperties
  as?: keyof JSX.IntrinsicElements
}

/**
 * Wrapper component that applies a diagonal-wipe ScrollTrigger reveal to its children.
 * Drop any section content inside this component to automatically get the P5 transition.
 *
 * @example
 * <SectionTransition direction="ltr" numSelector=".section-num">
 *   <span className="section-num">01</span>
 *   <h2 data-reveal>Title</h2>
 * </SectionTransition>
 */
export default function SectionTransition({
  id,
  children,
  direction = 'ltr',
  childSelector = '[data-reveal]',
  numSelector,
  rowSelector,
  className = '',
  style,
}: SectionTransitionProps) {
  const ref = useRef<HTMLElement>(null)

  useSectionTransition(ref as React.RefObject<HTMLElement>, {
    direction,
    childSelector,
    numSelector,
    rowSelector,
  })

  return (
    <section
      id={id}
      ref={ref}
      className={`section-wrapper ${className}`}
      style={style}
    >
      {children}
    </section>
  )
}
