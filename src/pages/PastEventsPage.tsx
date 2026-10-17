import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventService } from '../services/eventService'
import type { EventData } from '../mocks/types'

export default function PastEventsPage() {
  const [events, setEvents] = useState<EventData[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    eventService.getPastEvents().then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--color-slate-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .past-card { transition: all 0.3s ease; }
        .past-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.08) !important; }
        .past-card:hover .past-card-title { color: var(--color-slate-blue) !important; }
      `}</style>

      {/* ── Hero — IMAGE 1 ── */}
      <div
        className="bg-past-events bg-cover bg-center relative"
        style={{ paddingTop: 'calc(var(--nav-h) + 5rem)', paddingBottom: '6rem', position: 'relative' }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(245,241,232,0.15) 0%, rgba(245,241,232,0.55) 60%, var(--color-bg) 100%)',
        }} />
        <div className="page-container relative" style={{ zIndex: 2, animation: 'fadeUp 0.6s ease both' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.22em', color: 'var(--color-slate-blue)', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase' }}>
            Archive
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3rem, 7vw, 6rem)',
            color: 'var(--color-text-primary)',
            margin: '0 0 20px',
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
          }}>
            Hall of Fame
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-text-secondary)', margin: 0, maxWidth: 480 }}>
            A record of past hackathons, competitions, and events — moments that shaped our community.
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="page-container" style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}>

        {events.length === 0 ? (
          <div style={{
            padding: '80px 40px', border: '1px solid var(--color-cream)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
            backgroundColor: 'var(--color-white)',
          }}>
            <div style={{ width: 48, height: 48, border: '1px solid var(--color-sand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-slate-blue)" strokeWidth="1.5">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>No Past Events Yet</h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                Completed events will be archived here once they conclude.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Count header */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-xl)', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-cream)' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                {events.length} event{events.length !== 1 ? 's' : ''} in the archive
              </p>
            </div>

            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
              gap: 'var(--space-lg)',
            }}>
              {events.map((evt: EventData, i) => (
                <div
                  key={evt.id}
                  className="past-card"
                  onClick={() => navigate(`/events/${evt.id}`)}
                  style={{
                    backgroundColor: 'var(--color-white)',
                    border: '1px solid var(--color-cream)',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    animation: `fadeUp 0.4s ease ${i * 0.06}s both`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Accent bar — 3px slate at top */}
                  <div style={{ height: 3, backgroundColor: 'var(--color-slate-blue)', flexShrink: 0 }} />

                  <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Category + Date row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
                        padding: '4px 10px', textTransform: 'uppercase',
                        backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-cream)',
                      }}>
                        {evt.category}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {evt.date}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="past-card-title"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1.3rem, 2.5vw, 1.7rem)',
                        color: 'var(--color-text-primary)',
                        margin: 0,
                        lineHeight: 1.1,
                        letterSpacing: '-0.01em',
                        transition: 'color 0.2s',
                      }}>
                      {evt.title}
                    </h3>

                    {/* Description */}
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)',
                      margin: 0, lineHeight: 1.65, flex: 1,
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    } as React.CSSProperties}>
                      {evt.fullDescription || evt.shortDescription}
                    </p>

                    {/* Winners section — if any */}
                    {evt.winners && evt.winners.length > 0 && (
                      <div style={{ paddingTop: 14, borderTop: '1px solid var(--color-cream)' }}>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-text-secondary)', fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase' }}>
                          Champions
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {evt.winners.slice(0, 2).map((w, wi) => (
                            <div key={wi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13 }}>{wi === 0 ? '🥇' : wi === 1 ? '🥈' : '🥉'}</span>
                              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{w.teamName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--color-cream)', marginTop: 4 }}>
                      <div>
                        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--color-slate-blue)', lineHeight: 1 }}>
                          {evt.attendees ?? 0}
                        </span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Attendees</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-slate-blue)', fontWeight: 600 }}>
                        View Details →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
