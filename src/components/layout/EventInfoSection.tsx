import SectionTransition from '../ui/SectionTransition'
import type { EventData, Speaker } from '../../mocks/types'
import { calculateEventDays } from '../../services/eventService'

interface EventInfoSectionProps {
  event: EventData
  enrollmentCount?: number
  teamCount?: number
}

export default function EventInfoSection({ event }: EventInfoSectionProps) {
  const formattedTime = event.time
    ? new Date(`2000-01-01T${event.time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '01:00 PM';

  return (
    <SectionTransition
      id="event"
      direction="ltr"
      numSelector=".event-section-num"
      rowSelector=".event-card"
      style={{
        background: 'linear-gradient(rgba(251, 249, 244, 0.8), rgba(251, 249, 244, 0.95)), url(/background/image3.jpg) center/cover no-repeat',
        padding: '6rem 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span className="section-num event-section-num" aria-hidden="true">01</span>

      <div className="page-container relative z-10 flex flex-col items-center">
        <div className="p-8 sm:p-12 md:p-14 rounded-[2.5rem] w-[95%] max-w-[1100px] flex flex-col items-center text-center gap-8 md:gap-10 overflow-hidden" style={{ 
          background: 'linear-gradient(135deg, rgba(50, 72, 86, 0.92) 0%, rgba(24, 32, 35, 0.96) 100%)', 
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 30px 60px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
          backdropFilter: 'blur(24px)'
        }}>
          {/* Top: Text */}
          <div className="flex flex-col items-center max-w-3xl">
            <p className="font-ui font-bold tracking-[0.3em] text-[11px] mb-4 uppercase" style={{ color: 'var(--color-sand)' }}>
              ABOUT {event.title}
            </p>
            <h2 className="font-display leading-[1.1] mb-6" style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4rem)', color: 'var(--color-white)' }}>
              WHERE VISION <br /><span style={{ color: 'var(--color-cream)' }}>MEETS REALITY</span>
            </h2>
            <div style={{ height: 2, width: 50, background: 'var(--color-accent)', marginBottom: '1.5rem' }} />
            <p className="font-body text-base md:text-lg font-light" style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
              {event.fullDescription || event.shortDescription || 'Join hundreds of developers, designers, and innovators.'}
            </p>
          </div>

          {/* Bottom: Date, Time & Venue Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 w-full">
            {/* Date Box */}
            <div className="flex flex-col items-center justify-center py-5 px-6 rounded-2xl transition-transform hover:-translate-y-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
              <p className="font-body text-[11px] uppercase tracking-widest font-bold flex items-center gap-2 mb-2" style={{ color: 'var(--color-sand)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Date of Event
              </p>
              <h3 className="font-display text-xl md:text-2xl m-0 leading-tight text-white text-center">{event.date}</h3>
            </div>

            {/* Time Box */}
            <div className="flex flex-col items-center justify-center py-5 px-6 rounded-2xl transition-transform hover:-translate-y-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
              <p className="font-body text-[11px] uppercase tracking-widest font-bold flex items-center gap-2 mb-2" style={{ color: 'var(--color-sand)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Time
              </p>
              <h3 className="font-display text-xl md:text-2xl m-0 leading-tight text-white text-center">{formattedTime}</h3>
            </div>

            {/* Venue Box */}
            <div className="flex flex-col items-center justify-center py-5 px-6 rounded-2xl transition-transform hover:-translate-y-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
              <p className="font-body text-[11px] uppercase tracking-widest font-bold flex items-center gap-2 mb-2" style={{ color: 'var(--color-sand)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
                </svg>
                Venue
              </p>
              <h3 className="font-display text-xl md:text-2xl m-0 leading-tight text-white text-center">{event.location.split(',')[0]}</h3>
            </div>
          </div>
        </div>
      </div>
    </SectionTransition>
  )
}
