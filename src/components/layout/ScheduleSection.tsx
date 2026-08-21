import { useState } from 'react'
import type { EventData, ScheduleDay, Session } from '../../mocks/types'

interface ScheduleSectionProps {
  event: EventData
}

export default function ScheduleSection({ event }: ScheduleSectionProps) {
  const [activeDay, setActiveDay] = useState<number>(0)

  const hasSchedule = event.schedule && event.schedule.length > 0
  const dayData: ScheduleDay | null = hasSchedule ? event.schedule[activeDay] : null

  const getDayNumber = (dateStr: string) => {
    const parts = dateStr.split(' ')
    return parts.length > 1 ? parts[1] : dateStr
  }

  const getDayMonth = (dateStr: string) => {
    const parts = dateStr.split(' ')
    return parts.length > 1 ? parts[0] : ''
  }

  if (!hasSchedule) return null

  return (
    <section
      id="schedule"
      style={{
        background: 'var(--color-ivory)',
        borderTop: '1px solid var(--color-cream)',
        padding: '6rem 0 7rem',
      }}
    >
      <div className="page-container">
        {/* Section header */}
        <div className="mb-16">
          <p
            className="font-body text-xs uppercase tracking-widest font-semibold mb-3"
            style={{ color: 'var(--color-dusty-blue)', letterSpacing: '0.2em' }}
          >
            Programme
          </p>
          <h2
            className="font-display leading-none"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
          >
            Schedule of Events
          </h2>
        </div>

        {/* Day selector — the circles */}
        <div className="flex flex-wrap gap-6 mb-12">
          {event.schedule.map((day: ScheduleDay, idx: number) => {
            const isActive = activeDay === idx
            return (
              <button
                key={day.day}
                onClick={() => setActiveDay(idx)}
                className="flex flex-col items-center gap-2 cursor-pointer group"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <div
                  className="w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: isActive ? 'var(--color-slate-blue)' : 'var(--color-white)',
                    border: `2px solid ${isActive ? 'var(--color-slate-blue)' : 'var(--color-sand)'}`,
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: isActive ? '0 4px 20px rgba(62,88,104,0.25)' : 'none',
                  }}
                >
                  <span
                    className="font-body text-[10px] uppercase tracking-widest font-semibold mb-0.5"
                    style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)' }}
                  >
                    {getDayMonth(day.date)}
                  </span>
                  <span
                    className="font-display leading-none"
                    style={{ fontSize: '1.75rem', color: isActive ? 'var(--color-white)' : 'var(--color-text-primary)' }}
                  >
                    {getDayNumber(day.date)}
                  </span>
                </div>
                <span
                  className="font-body text-xs uppercase tracking-widest"
                  style={{ color: isActive ? 'var(--color-slate-blue)' : 'var(--color-text-secondary)' }}
                >
                  {day.day}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sessions for selected day */}
        {dayData && (
          <div
            style={{
              backgroundColor: 'var(--color-white)',
              border: '1px solid var(--color-cream)',
              padding: '2.5rem',
            }}
          >
            <div className="flex items-center justify-between mb-8 pb-6" style={{ borderBottom: '1px solid var(--color-cream)' }}>
              <div>
                <p className="font-body text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--color-dusty-blue)' }}>
                  {dayData.date}
                </p>
                <h3 className="font-display text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                  {event.schedule.length === 1 ? 'Event Timeline' : dayData.day}
                </h3>
              </div>
              <span
                className="font-body text-xs uppercase tracking-widest font-semibold px-3 py-1.5"
                style={{ backgroundColor: 'var(--color-cream)', color: 'var(--color-text-primary)' }}
              >
                {dayData.sessions.length} Sessions
              </span>
            </div>

            <div className="space-y-0">
              {dayData.sessions.map((session: Session, i: number) => (
                <div
                  key={i}
                  className="flex gap-6 py-6"
                  style={{ borderBottom: i < dayData.sessions.length - 1 ? '1px solid var(--color-cream)' : 'none' }}
                >
                  {/* Time column */}
                  <div className="w-16 shrink-0 pt-1 text-right">
                    <span className="font-display text-xl" style={{ color: 'var(--color-slate-blue)' }}>
                      {session.time}
                    </span>
                  </div>

                  {/* Vertical divider with dot */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: 'var(--color-slate-blue)' }}
                    />
                    {i < dayData.sessions.length - 1 && (
                      <div className="flex-1 w-px mt-2" style={{ backgroundColor: 'var(--color-cream)' }} />
                    )}
                  </div>

                  {/* Session info */}
                  <div className="flex-1 pb-2">
                    <p className="font-display text-xl mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      {session.title}
                    </p>
                    {session.speaker && (
                      <p className="font-body text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {session.speaker}
                      </p>
                    )}
                    {session.tag && (
                      <span
                        className="inline-block font-body text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1"
                        style={{
                          backgroundColor: 'var(--color-cream)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {session.tag}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
