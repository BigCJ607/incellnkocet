import { forwardRef, useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface GlowBurstProps {
  active: boolean
  x: number
  y: number
  size?: number
}

/**
 * Radial light-burst overlay that plays at (x, y) screen coords when `active` flips true.
 * Controlled via GSAP internally; can be reused anywhere.
 */
const GlowBurst = forwardRef<HTMLDivElement, GlowBurstProps>(
  ({ active, x, y, size = 400 }, ref) => {
    const innerRef = useRef<HTMLDivElement>(null)
    const resolvedRef = (ref as React.RefObject<HTMLDivElement>) || innerRef

    useEffect(() => {
      if (!active || !resolvedRef.current) return
      gsap.fromTo(
        resolvedRef.current,
        { opacity: 0, scale: 0.4 },
        {
          opacity: 0.9,
          scale: 1,
          duration: 0.18,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(resolvedRef.current, {
              opacity: 0,
              scale: 2.4,
              duration: 0.38,
              ease: 'power2.in',
            })
          },
        }
      )
    }, [active, resolvedRef])

    return (
      <div
        ref={resolvedRef}
        className="glow-burst"
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          left: x - size / 2,
          top: y - size / 2,
          background:
            'radial-gradient(circle at center, #22D3EE 0%, rgba(99,102,241,0.65) 30%, rgba(99,102,241,0.2) 60%, transparent 75%)',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 10000,
          position: 'fixed',
        }}
      />
    )
  }
)

GlowBurst.displayName = 'GlowBurst'
export default GlowBurst
