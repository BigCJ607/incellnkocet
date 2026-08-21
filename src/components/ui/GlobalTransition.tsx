import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

type Variant = 'diagonal' | 'eye' | 'slash'
const VARIANTS: Variant[] = ['diagonal', 'eye', 'slash']
let globalTransitionIndex = 0

const COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  '#0A0A0F',
  '#1e1e29',
]

export default function GlobalTransition() {
  const containerRef = useRef<HTMLDivElement>(null)
  const layer1Ref = useRef<HTMLDivElement>(null)
  const layer2Ref = useRef<HTMLDivElement>(null)

  // Eye variant refs
  const eyeContainerRef = useRef<HTMLDivElement>(null)
  const irisRef = useRef<HTMLDivElement>(null)
  const upperLidRef = useRef<SVGPathElement>(null)
  const lowerLidRef = useRef<SVGPathElement>(null)
  const glintRef = useRef<SVGPathElement>(null)
  const lashesGroupRef = useRef<SVGGElement>(null)

  // Slash variant refs
  const slashContainerRef = useRef<HTMLDivElement>(null)
  const slashTopRef = useRef<HTMLDivElement>(null)
  const slashBottomRef = useRef<HTMLDivElement>(null)
  const slashStreakRef = useRef<HTMLDivElement>(null)
  const slashGlowLineRef = useRef<SVGPathElement>(null)
  const sparksContainerRef = useRef<HTMLDivElement>(null)

  const [activeVariant, setActiveVariant] = useState<Variant>('diagonal')
  const [lastOrigin, setLastOrigin] = useState<{ x: number, y: number } | null>(null)

  useEffect(() => {
    const handleTransition = (e: Event) => {
      const customEvent = e as CustomEvent
      const action = customEvent.detail?.action
      const requestedVariant = customEvent.detail?.variant
      const origin = customEvent.detail?.origin
      const onComplete = customEvent.detail?.onComplete

      if (action === 'in') {
        let variant = requestedVariant as string
        if (variant === 'standard' || !variant) {
          variant = VARIANTS[globalTransitionIndex % VARIANTS.length]
          globalTransitionIndex++
        }
        setActiveVariant(variant as Variant)
        if (origin) setLastOrigin(origin)

        gsap.set(containerRef.current, { visibility: 'visible' })

        if (variant === 'diagonal') {
          gsap.set([layer1Ref.current, layer2Ref.current], { display: 'block' })
          gsap.set([eyeContainerRef.current, slashContainerRef.current], { display: 'none' })

          const c1 = COLORS[Math.floor(Math.random() * COLORS.length)]
          let c2 = COLORS[Math.floor(Math.random() * COLORS.length)]
          while (c2 === c1) c2 = COLORS[Math.floor(Math.random() * COLORS.length)]

          gsap.set(layer1Ref.current, { background: c1, opacity: 1 })
          gsap.set(layer2Ref.current, { background: c2, opacity: 1 })

          const tl = gsap.timeline({
            onComplete: () => {
              if (onComplete) onComplete()
            }
          })
          tl.fromTo(layer1Ref.current,
            { clipPath: 'polygon(0 0, 0 0, -10% 100%, -10% 100%)' },
            { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 0.5, ease: 'p5Overshoot' }
          )
          tl.fromTo(layer2Ref.current,
            { clipPath: 'polygon(0 0, 0 0, -10% 100%, -10% 100%)' },
            { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 0.45, ease: 'p5Overshoot' },
            '-=0.3'
          )
        } else if (variant === 'eye') {
          gsap.set([layer1Ref.current, layer2Ref.current, slashContainerRef.current], { display: 'none' })
          gsap.set(eyeContainerRef.current, { display: 'flex' })

          // Show Iris
          gsap.fromTo(irisRef.current,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(1.5)' }
          )

          // Reset Glint
          gsap.set(glintRef.current, { opacity: 0 })

          const proxy = { yUpper: -20, yLower: 120, yCornerUpper: 50, yCornerLower: 50 }
          const onUpdatePaths = () => {
            if (!upperLidRef.current || !lowerLidRef.current || !glintRef.current || !lashesGroupRef.current) return

            upperLidRef.current.setAttribute('d', `M 0,0 L 100,0 L 100,${proxy.yCornerUpper} Q 50,${proxy.yUpper} 0,${proxy.yCornerUpper} Z`)
            lowerLidRef.current.setAttribute('d', `M 0,100 L 100,100 L 100,${proxy.yCornerLower} Q 50,${proxy.yLower} 0,${proxy.yCornerLower} Z`)
            glintRef.current.setAttribute('d', `M 0,${proxy.yCornerUpper} Q 50,${proxy.yUpper} 100,${proxy.yCornerUpper}`)

            const lashes = lashesGroupRef.current.querySelectorAll('.eyelash')
            const tVals = [0.2, 0.35, 0.5, 0.65, 0.8]
            tVals.forEach((t, i) => {
              const px = 100 * t
              const py = proxy.yCornerUpper * (1 - 2 * t + 2 * t * t) + 2 * t * (1 - t) * proxy.yUpper

              const dx = 100
              const dy = 2 * (2 * t - 1) * (proxy.yCornerUpper - proxy.yUpper)
              const len = Math.sqrt(dx * dx + dy * dy)
              const nx = -dy / len
              const ny = dx / len

              const lashLen = 6
              const ex = px + nx * lashLen
              const ey = py - ny * lashLen

              lashes[i].setAttribute('d', `M ${px},${py} Q ${px + nx * (lashLen / 2)},${py - ny * (lashLen / 2)} ${ex},${ey}`)
            })
          }

          // Initial paths setup
          onUpdatePaths()

          const tl = gsap.timeline({
            onComplete: () => {
              if (onComplete) onComplete()
            }
          })
          tl.to(proxy, {
            yUpper: 55, // Close seam slightly below center
            yLower: 55,
            duration: 0.3,
            delay: 0.15,
            ease: 'power3.in',
            onUpdate: onUpdatePaths
          })

          // Glint flash as they meet
          tl.to(glintRef.current, {
            opacity: 1,
            duration: 0.1,
            ease: 'power1.out'
          }, '-=0.05')
        } else if (variant === 'slash') {
          gsap.set([layer1Ref.current, layer2Ref.current, eyeContainerRef.current], { display: 'none' })
          gsap.set(slashContainerRef.current, { display: 'block' })

          const tl = gsap.timeline({
            onComplete: () => {
              if (onComplete) onComplete()
            }
          })

          const wrapper = document.getElementById('page-wrapper')
          if (wrapper && slashTopRef.current && slashBottomRef.current) {
            slashTopRef.current.innerHTML = ''
            slashBottomRef.current.innerHTML = ''

            const clone1 = wrapper.cloneNode(true) as HTMLElement
            const clone2 = wrapper.cloneNode(true) as HTMLElement

            const rect = wrapper.getBoundingClientRect()

            const computedBg = window.getComputedStyle(wrapper).backgroundColor
            const bodyBg = window.getComputedStyle(document.body).backgroundColor
            const bgToUse = (computedBg === 'rgba(0, 0, 0, 0)' || computedBg === 'transparent') ? bodyBg : computedBg

            const styleOpts = {
              position: 'absolute' as const,
              top: `${rect.top}px`,
              left: `${rect.left}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              overflow: 'hidden',
              margin: 0,
              backgroundColor: bgToUse,
              pointerEvents: 'none' as const
            }
            Object.assign(clone1.style, styleOpts)
            Object.assign(clone2.style, styleOpts)

            slashTopRef.current.appendChild(clone1)
            slashBottomRef.current.appendChild(clone2)

            // Blur and fade text elements as the slash passes over them
            const textSelectors = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd'
            const textEls = [
              ...Array.from(clone1.querySelectorAll(textSelectors)),
              ...Array.from(clone2.querySelectorAll(textSelectors))
            ] as HTMLElement[]

            textEls.forEach(el => {
              if (!el.textContent?.trim()) return
              const elRect = el.getBoundingClientRect()
              const cx = (elRect.left + elRect.width / 2) - rect.left
              const cy = (elRect.top + elRect.height / 2) - rect.top
              const px = (cx / rect.width) * 100
              const py = (cy / rect.height) * 100
              
              // Project onto diagonal from bottom-left (px=0, py=100) to top-right (px=100, py=0)
              const u = Math.max(0, Math.min(1, (px + (100 - py)) / 200))
              const hitTime = u * 0.18
              
              tl.to(el, {
                opacity: 0.15,
                filter: 'blur(2px)',
                duration: 0.08,
                ease: 'power2.out'
              }, Math.max(0, hitTime - 0.02))
            })

            // Generate jagged split
            const steps = 14
            const splitPoints: [number, number][] = []
            splitPoints.push([0, 100])
            for (let i = 1; i < steps; i++) {
              const t = i / steps
              const bx = t * 100
              const by = 100 - t * 100
              const noise = (Math.random() - 0.5) * 12
              splitPoints.push([bx + noise, by + noise])
            }
            splitPoints.push([100, 0])

            const reversePoints = splitPoints.slice().reverse()
            const clipTop = `polygon(0% 0%, 100% 0%, ${reversePoints.map(p => `${p[0].toFixed(1)}% ${p[1].toFixed(1)}%`).join(', ')}, 0% 100%)`
            const clipBottom = `polygon(100% 100%, 0% 100%, ${splitPoints.map(p => `${p[0].toFixed(1)}% ${p[1].toFixed(1)}%`).join(', ')}, 100% 0%)`

            gsap.set(slashTopRef.current, { clipPath: clipTop, x: 0, y: 0, opacity: 1 })
            gsap.set(slashBottomRef.current, { clipPath: clipBottom, x: 0, y: 0, opacity: 1 })

            // Draw Glow Line
            if (slashGlowLineRef.current) {
              const pathEl = slashGlowLineRef.current
              const d = `M ${splitPoints.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ')}`
              pathEl.setAttribute('d', d)
              // Approximate length of the line
              const len = pathEl.getTotalLength ? pathEl.getTotalLength() : 200
              pathEl.style.strokeDasharray = `${len}`
              pathEl.style.strokeDashoffset = `${len}`
              gsap.set(pathEl, { opacity: 1 })
            }

            // Generate Sparks timed to the streak
            if (sparksContainerRef.current) {
              sparksContainerRef.current.innerHTML = ''
              for (let i = 0; i < 15; i++) {
                const t = Math.random() // position along diagonal
                const px = t * 100
                const py = 100 - t * 100

                const spark = document.createElement('div')
                spark.className = 'absolute bg-white'
                Object.assign(spark.style, {
                  left: `${px}vw`,
                  top: `${py}vh`,
                  width: '12px',
                  height: '2px',
                  boxShadow: '0 0 6px 2px var(--color-accent)',
                  opacity: 0,
                  transformOrigin: 'center'
                })
                sparksContainerRef.current.appendChild(spark)

                // Angle perpendicular to diagonal
                const angle = (Math.random() > 0.5 ? Math.PI * 0.25 : Math.PI * 1.25) + (Math.random() - 0.5) * 1.5
                const dist = 5 + Math.random() * 15

                tl.fromTo(spark,
                  { opacity: 1, x: 0, y: 0, rotation: angle * (180 / Math.PI) },
                  {
                    x: Math.cos(angle) * dist + 'vw',
                    y: Math.sin(angle) * dist + 'vh',
                    opacity: 0,
                    duration: 0.2 + Math.random() * 0.15,
                    ease: 'power3.out'
                  },
                  t * 0.18 // Timed exactly to the streak's position!
                )
              }
            }
          }

          if (slashStreakRef.current) {
            gsap.set(slashStreakRef.current, {
              xPercent: -50, yPercent: -50,
              left: '0%', top: '100%',
              rotation: -45,
              opacity: 1
            })

            // The timeline was declared higher up in the original, now it's accessible for the streak

            tl.to(slashStreakRef.current, {
              left: '100%', top: '0%',
              duration: 0.18,
              ease: 'power2.in',
            }, 0)

            if (slashGlowLineRef.current) {
              tl.to(slashGlowLineRef.current, {
                strokeDashoffset: 0,
                duration: 0.18,
                ease: 'power2.in'
              }, 0)
            }
          }
        }
      } else if (action === 'out') {
        let variant = requestedVariant as string
          if (variant === 'standard' || !variant) {
            variant = activeVariant
          }

          if (variant === 'diagonal') {
            const tl = gsap.timeline({
              onComplete: () => {
                gsap.set(containerRef.current, { visibility: 'hidden' })
              }
            })
            tl.fromTo(layer2Ref.current,
              { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' },
              { clipPath: 'polygon(110% 0, 110% 0, 100% 100%, 100% 100%)', duration: 0.45, ease: 'p5Overshoot' }
            )
            tl.fromTo(layer1Ref.current,
              { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' },
              { clipPath: 'polygon(110% 0, 110% 0, 100% 100%, 100% 100%)', duration: 0.5, ease: 'p5Overshoot' },
              '-=0.35'
            )
          } else if (variant === 'eye') {
            // Hide Glint
            gsap.to(glintRef.current, { opacity: 0, duration: 0.15 })

            // Hide Iris while closed
            gsap.set(irisRef.current, { opacity: 0, scale: 0 })

            const proxy = { yUpper: 55, yLower: 55, yCornerUpper: 50, yCornerLower: 50 }
            const onUpdatePaths = () => {
              if (!upperLidRef.current || !lowerLidRef.current || !glintRef.current || !lashesGroupRef.current) return

              upperLidRef.current.setAttribute('d', `M 0,0 L 100,0 L 100,${proxy.yCornerUpper} Q 50,${proxy.yUpper} 0,${proxy.yCornerUpper} Z`)
              lowerLidRef.current.setAttribute('d', `M 0,100 L 100,100 L 100,${proxy.yCornerLower} Q 50,${proxy.yLower} 0,${proxy.yCornerLower} Z`)
              glintRef.current.setAttribute('d', `M 0,${proxy.yCornerUpper} Q 50,${proxy.yUpper} 100,${proxy.yCornerUpper}`)

              const lashes = lashesGroupRef.current.querySelectorAll('.eyelash')
              const tVals = [0.2, 0.35, 0.5, 0.65, 0.8]
              tVals.forEach((t, i) => {
                const px = 100 * t
                const py = proxy.yCornerUpper * (1 - 2 * t + 2 * t * t) + 2 * t * (1 - t) * proxy.yUpper
                const dx = 100
                const dy = 2 * (2 * t - 1) * (proxy.yCornerUpper - proxy.yUpper)
                const len = Math.sqrt(dx * dx + dy * dy)
                const nx = -dy / len
                const ny = dx / len

                const lashLen = 6
                const ex = px + nx * lashLen
                const ey = py - ny * lashLen

                lashes[i].setAttribute('d', `M ${px},${py} Q ${px + nx * (lashLen / 2)},${py - ny * (lashLen / 2)} ${ex},${ey}`)
              })
            }

            const tl = gsap.timeline({
              onComplete: () => {
                gsap.set(eyeContainerRef.current, { display: 'none' })
                gsap.set(containerRef.current, { visibility: 'hidden' })
              }
            })

            tl.to(proxy, {
              yUpper: -30,
              yCornerUpper: -10,
              yLower: 130,
              yCornerLower: 110,
              duration: 0.5,
              ease: 'power2.inOut',
              onUpdate: onUpdatePaths
            })
          } else if (variant === 'slash') {
            const tl = gsap.timeline({
              onComplete: () => {
                gsap.set(slashContainerRef.current, { display: 'none' })
                gsap.set(containerRef.current, { visibility: 'hidden' })
                if (slashTopRef.current) slashTopRef.current.innerHTML = ''
                if (slashBottomRef.current) slashBottomRef.current.innerHTML = ''
                if (sparksContainerRef.current) sparksContainerRef.current.innerHTML = ''
              }
            })

            tl.set([slashTopRef.current, slashBottomRef.current], { transformPerspective: 1200 })

            // Initial separate
            tl.to(slashTopRef.current, {
              x: '-5vw',
              y: '-5vh',
              duration: 0.15,
              ease: 'power2.out'
            }, 0)

            tl.to(slashBottomRef.current, {
              x: '5vw',
              y: '5vh',
              duration: 0.15,
              ease: 'power2.out'
            }, 0)

            // Fall down (Gravity + Tumble)
            tl.to(slashTopRef.current, {
              y: '100vh',
              x: '-10vw',
              rotationZ: -35,
              rotationX: 65,
              opacity: 1,
              duration: 0.7,
              ease: 'power4.in' // sharp gravity acceleration
            }, 0.15)

            tl.to(slashBottomRef.current, {
              y: '100vh',
              x: '10vw',
              rotationZ: 35,
              rotationY: 65,
              opacity: 1,
              duration: 0.65,
              ease: 'power4.in'
            }, 0.15)

            tl.to(slashStreakRef.current, { opacity: 0, duration: 0.1 }, 0)

            if (slashGlowLineRef.current) {
              tl.to(slashGlowLineRef.current, { opacity: 0, duration: 0.2 }, 0)
            }
          }
        }
    }

    window.addEventListener('page-transition', handleTransition)
    return () => window.removeEventListener('page-transition', handleTransition)
  }, [activeVariant, lastOrigin])

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999]" style={{ visibility: 'hidden', pointerEvents: 'none' }}>
      {/* Diagonal layers */}
      <div ref={layer1Ref} className="absolute inset-0" />
      <div ref={layer2Ref} className="absolute inset-0" />

      {/* Eye Transition */}
      <div ref={eyeContainerRef} className="absolute inset-0 flex items-center justify-center" style={{ display: 'none' }}>
        {/* Iris */}
        <div ref={irisRef} className="absolute rounded-full" style={{ width: '15vmin', height: '15vmin', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div className="rounded-full bg-black" style={{ width: '40%', height: '40%' }} />
        </div>

        {/* Lids */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
          <path ref={upperLidRef} d="M 0,0 L 100,0 L 100,50 Q 50,-20 0,50 Z" fill="#2a1b38" />
          <path ref={lowerLidRef} d="M 0,100 L 100,100 L 100,50 Q 50,120 0,50 Z" fill="#4a4036" />
          <path ref={glintRef} d="M 0,50 Q 50,-20 100,50" fill="none" stroke="var(--color-accent)" strokeWidth="0.5" opacity="0" />
          {/* Eyelashes */}
          <g ref={lashesGroupRef} stroke="#2a1b38" strokeWidth="0.5" strokeLinecap="round" fill="none">
            {[0.2, 0.35, 0.5, 0.65, 0.8].map((t, i) => (
              <path key={i} className="eyelash" />
            ))}
          </g>
        </svg>
      </div>

      {/* Slash Cleave Transition */}
      <div ref={slashContainerRef} className="absolute inset-0 pointer-events-none" style={{ display: 'none' }}>
        <div ref={slashTopRef} className="absolute inset-0" />
        <div ref={slashBottomRef} className="absolute inset-0" />
        {/* The Slash Streak */}
        <div ref={slashStreakRef} className="absolute" style={{
          width: '80vw',
          height: '6px',
          background: 'linear-gradient(to right, transparent 0%, var(--color-accent) 80%, #fff 100%)',
          boxShadow: '0 0 30px 4px var(--color-accent)',
          borderRadius: '50%',
          transformOrigin: 'right center',
          pointerEvents: 'none',
          zIndex: 50
        }} />
        {/* The Glow Edge */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ zIndex: 40, pointerEvents: 'none' }}>
          <path ref={slashGlowLineRef} fill="none" stroke="var(--color-accent)" strokeWidth="4" vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 0 10px var(--color-accent))', opacity: 0 }} />
        </svg>
        {/* Sparks Container */}
        <div ref={sparksContainerRef} className="absolute inset-0 z-50 pointer-events-none" />
      </div>
    </div>
  )
}
