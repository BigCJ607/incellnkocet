import TransitionLink from './TransitionLink'
import { useNavigate } from 'react-router-dom'
import type { EventData } from '../../mocks/types'

const FALLBACK_POSTER = '/background/eureka.jpg'

interface EventCardProps {
  evt: EventData
  isRegistered: boolean
  onRegisterClick: (e: React.MouseEvent, evt: EventData) => void
  /** When true shows "VIEW PASS →" instead of register button, and links to /my-tickets */
  isPreview?: boolean
}

export default function EventCard({ evt, isRegistered, onRegisterClick, isPreview }: EventCardProps) {
  const navigate = useNavigate()
  const poster = evt.posterUrl || FALLBACK_POSTER


  const handleCardClick = () => {
    if (isPreview) return
    navigate(`/events/${evt.id}`)
  }

  return (
    <div
      className="group relative overflow-hidden isolate"
      onClick={handleCardClick}
      style={{
        aspectRatio: '3 / 2',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.18)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
      }}
    >
      {/* ── Poster Image ── */}
      <img
        src={poster}
        alt={evt.title}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
      />

      {/* ── Top dark scrim removed to match reference (we'll just use the bottom gradient) ── */}

      {/* ── Bottom gradient for text readability (made taller) ── */}
      <div
        className="absolute inset-0 z-10"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.7) 40%, transparent 80%)' }}
      />

      {/* ── Bottom content (Stacked: Badge -> Title -> Button) ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2 sm:gap-3 p-5 sm:p-8">
        
        {/* Row 1: Badge + Year */}
        <div className="flex items-center gap-3">
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 9999,
              fontSize: 9,
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#fff',
              backgroundColor: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            {evt.category.replace(/s$/i, '')}
          </span>
        </div>

        {/* Row 2: Title */}
        <h3
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '0.02em',
            color: '#fff',
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {evt.title}
        </h3>


        {/* Row 4: Button */}
        <div style={{ marginTop: 6 }}>
          {isPreview ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-body font-bold text-white bg-white/20 backdrop-blur-md border border-white/30 cursor-default">
              Preview <span className="ml-0.5 transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
            </span>
          ) : isRegistered ? (
            <TransitionLink
              to="/my-tickets"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-body font-bold text-white no-underline shadow-sm transition-all duration-200 hover:opacity-90"
              style={{
                background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              View Ticket / Pass <span className="ml-0.5 transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
            </TransitionLink>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRegisterClick(e, evt) }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-body font-bold text-white border-none cursor-pointer shadow-sm transition-all duration-200 hover:opacity-90"
              style={{
                background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              Register Now <span className="ml-0.5 transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
