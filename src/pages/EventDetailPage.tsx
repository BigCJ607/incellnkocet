import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { eventService } from '../services/eventService'
import { teamService } from '../services/teamService'
import { type EventData, type Team, type TeamMember } from '../mocks/types'
import EventInfoSection from '../components/layout/EventInfoSection'
import RegistrationPanel from '../components/layout/RegistrationPanel'
import SubmissionPanel from '../components/layout/SubmissionPanel'
import TransitionLink from '../components/ui/TransitionLink'
import { useApp } from '../context/AppContext'

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRegOpen, setIsRegOpen] = useState(false)
  const [isSubOpen, setIsSubOpen] = useState(false)

  const { user, tickets, refreshTickets, refreshProfile } = useApp()
  const [unsubmitting, setUnsubmitting] = useState(false)
  const [myTeam, setMyTeam] = useState<Team | null>(null)
  const [myTeamMembers, setMyTeamMembers] = useState<TeamMember[]>([])
  const [enrollmentCount, setEnrollmentCount] = useState(0)
  const [teamCount, setTeamCount] = useState(0)

  // Always keep profile completeness up to date when user focuses or returns
  useEffect(() => {
    if (user && refreshProfile) {
      refreshProfile()
      const handleFocus = () => refreshProfile()
      window.addEventListener('focus', handleFocus)
      return () => window.removeEventListener('focus', handleFocus)
    }
  }, [user, refreshProfile])

  useEffect(() => {
    if (id) {
      eventService.getEventById(id).then(data => {
        setEvent(data || null)
        setLoading(false)
      })
      eventService.getEventStats(id).then(stats => {
        setEnrollmentCount(stats.enrollmentCount)
        setTeamCount(stats.teamCount)
      })
    }
  }, [id, tickets])

  // Fetch team details for this user & event
  useEffect(() => {
    if (id && user) {
      teamService.getUserTeamForEvent(id, user.id).then(async t => {
        setMyTeam(t)
        if (t) {
          const members = await teamService.getTeamMembers(t.id)
          setMyTeamMembers(members)
        } else {
          setMyTeamMembers([])
        }
      })
    } else {
      setMyTeam(null)
      setMyTeamMembers([])
    }
  }, [id, user, tickets])

  // Derived registration state
  const myTicket = id ? tickets.find(t => t.eventId === id) : null
  const isRegistered = !!myTicket
  const isCaptain = !!myTeam && myTeam.createdBy === user?.id
  const [exitingTeam, setExitingTeam] = useState(false)

  const handleExitTeam = async () => {
    if (!user || !myTeam) return
    const isCap = myTeam.createdBy === user.id
    const isSolo = isCap && myTeamMembers.filter(m => m.userId !== user.id).length === 0
    const msg = isSolo
      ? `You are the sole member of "${myTeam.name}". Exiting will disband the team. Proceed?`
      : isCap
      ? `As Captain, exiting will transfer captaincy to a teammate and notify them. Proceed?`
      : `Are you sure you want to exit "${myTeam.name}"? The captain will be notified.`
    if (!window.confirm(msg)) return
    setExitingTeam(true)
    try {
      await teamService.leaveTeam(myTeam.id, user.id)
      await refreshTickets()
      setMyTeam(null)
      setMyTeamMembers([])
    } catch (err: any) {
      alert(`Failed to exit team: ${err.message}`)
    } finally {
      setExitingTeam(false)
    }
  }

  const handleUnenroll = async () => {
    if (!user || !event) return
    if (!window.confirm(`Are you sure you want to unenroll from "${event.title}"? Your pass will be cancelled.`)) {
      return
    }
    setUnsubmitting(true)
    try {
      await eventService.unenrollFromEvent(event.id, user.id)
      await refreshTickets()
    } catch (err: any) {
      alert(`Failed to unenroll: ${err.message}`)
    } finally {
      setUnsubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--color-bg)' }}>
        <div className="w-12 h-12 mb-4 border-2 rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p className="font-ui tracking-widest text-sm" style={{ color: 'var(--color-text-muted)' }}>LOADING EVENT...</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--color-bg)' }}>
        <h1 className="font-display text-6xl text-gradient-primary mb-4">EVENT NOT FOUND</h1>
        <TransitionLink to="/" className="btn-primary px-8 py-3 no-underline inline-block">BACK TO EVENTS</TransitionLink>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── Banner image — shorter on mobile so content is above the fold ── */}
      <div
        className="relative bg-cover bg-center w-full"
        style={{
          height: 'clamp(180px, 28vh, 520px)',
          backgroundImage: `url(${event.posterUrl || '/background/eureka.jpg'})`,
        }}
      >
        {/* Subtle bottom fade so the banner blends into the page */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 40%, rgba(10,10,10,0.55) 100%)' }} />
        {/* Back link — bottom-right on mobile, top-left on desktop */}
        <TransitionLink
          to="/events"
          className="absolute bottom-4 right-4 md:bottom-auto md:right-auto md:left-6 md:top-[104px] font-body text-xs md:text-sm font-extrabold tracking-[0.18em] text-white bg-black/50 backdrop-blur-md border border-white/30 px-6 py-3 md:px-6 md:py-3 rounded-full hover:bg-black/75 hover:text-white inline-flex items-center gap-2.5 no-underline group z-10 shadow-lg animate-slide-left-fade"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform duration-300 group-hover:-translate-x-1">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          BACK TO EVENTS
        </TransitionLink>
      </div>

      {/* ── Page content below the banner ── */}
      <div className="page-container" style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}>
        <div className="max-w-4xl">

          {/* Title */}
          <h1
            className="font-display mb-6 md:mb-8 animate-slide-left-fade"
            style={{ fontSize: 'clamp(2rem, 7vw, 5.5rem)', lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', animationFillMode: 'both' }}
          >
            {event.title}
          </h1>

          {/* Meta Information */}
          <div className="flex flex-col gap-5 mb-12 animate-slide-left-fade delay-100" style={{ animationFillMode: 'both' }}>
            {/* Category badge */}
            <div className="flex items-center">
              <span className="font-body text-xs font-extrabold tracking-[0.25em] uppercase px-5 py-2 rounded-full shadow-sm" style={{ backgroundColor: 'var(--color-slate-blue)', color: '#fff' }}>
                {event.category}
              </span>
            </div>
            {/* Date, Time, Venue */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-6 items-start sm:items-center">
              {/* Date */}
              <span className="font-body text-sm md:text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {event.date}
              </span>
              {/* Time */}
              {event.time && (
                <span className="font-body text-sm md:text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {new Date(`2000-01-01T${event.time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {/* Venue */}
              <span className="font-body text-sm md:text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {event.location}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="animate-slide-left-fade delay-200" style={{ animationFillMode: 'both' }}>
            {isRegistered ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center">
                  <div className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span className="font-body font-bold text-xs tracking-wider uppercase text-slate-800">✓ Registered</span>
                  </div>

                  {/* Create / Join Team or Closed State */}
                  {!myTeam && (
                    event.teamFormationLive ? (
                      <TransitionLink
                        to="/teams"
                        className="w-full sm:w-auto px-8 py-4 min-h-[56px] rounded-2xl text-sm md:text-base flex items-center justify-center gap-3 font-body font-extrabold uppercase tracking-wide no-underline transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98]"
                        style={{
                          background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.3)',
                          boxShadow: '0 10px 28px rgba(62, 88, 104, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        Create / Join Team →
                      </TransitionLink>
                    ) : (
                      <div
                        className="w-full sm:w-auto px-6 py-3.5 min-h-[50px] rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2.5 font-body font-bold"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                        }}
                        title="Team formation for this event has been closed by administrators"
                      >
                        <span>🔒</span>
                        <span>Team Formation Closed</span>
                      </div>
                    )
                  )}

                  {/* Submit Project */}
                  {event.submissionsEnabled && isCaptain && (
                    <button
                      onClick={() => setIsSubOpen(true)}
                      className="w-full sm:w-auto px-8 py-4 min-h-[54px] rounded-2xl text-sm md:text-base flex items-center justify-center gap-3 font-body font-extrabold uppercase transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                        color: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.3)',
                        boxShadow: '0 10px 28px rgba(62, 88, 104, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Submit Project →
                    </button>
                  )}
                  {event.submissionsEnabled && myTeam && !isCaptain && (
                    <div className="px-6 py-3 rounded-2xl text-xs font-body font-medium bg-white border border-slate-200 text-slate-500">
                      Only team captain can submit
                    </div>
                  )}
                </div>

                {/* Unenroll */}
                <div className="flex items-center gap-4" style={{ borderTop: '1px solid var(--color-cream)', paddingTop: '1.5rem' }}>
                  <button
                    onClick={handleUnenroll}
                    disabled={unsubmitting}
                    className="px-6 py-3 rounded-2xl text-xs font-body font-bold tracking-wider uppercase cursor-pointer transition-all duration-200 bg-white border border-red-200 text-red-600 hover:bg-red-50 shadow-sm"
                    style={{ opacity: unsubmitting ? 0.6 : 1 }}
                  >
                    {unsubmitting ? 'Unenrolling...' : 'Cancel Registration'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-4">
                {user ? (
                  <button
                    onClick={() => setIsRegOpen(true)}
                    className="py-4 px-8 text-base font-bold font-body text-white cursor-pointer transition-all duration-200 active:scale-[0.98] rounded-2xl flex items-center gap-2.5 border-none shadow-md"
                    style={{
                      background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                      boxShadow: '0 8px 20px rgba(62, 88, 104, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    <span>Register Now</span>
                    <span>→</span>
                  </button>
                ) : (
                  <TransitionLink
                    to="/auth"
                    className="py-4 px-8 text-base font-bold font-body text-white no-underline transition-all duration-200 active:scale-[0.98] rounded-2xl flex items-center gap-2.5 shadow-md"
                    style={{
                      background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                      boxShadow: '0 8px 20px rgba(62, 88, 104, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    Login to Register →
                  </TransitionLink>
                )}
              </div>
            )}
          </div>
        </div>

        {/* My Team Section */}
        {myTeam && (
          <div className="mt-12 pt-10" style={{ borderTop: '1px solid var(--color-cream)' }}>
            <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
              <div>
                <p className="font-body text-xs font-extrabold tracking-[0.2em] mb-2 uppercase" style={{ color: 'var(--color-slate-blue)' }}>
                  {myTeam.createdBy === user?.id ? '⭐ YOUR TEAM (CAPTAIN)' : '👥 YOUR TEAM'}
                </p>
                <h3 className="font-display text-4xl m-0" style={{ color: 'var(--color-text-primary)' }}>{myTeam.name}</h3>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleExitTeam}
                  disabled={exitingTeam}
                  className="font-body font-bold text-xs sm:text-sm tracking-wider px-5 py-3.5 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer min-h-[50px]"
                  title="Exit this team"
                >
                  🚪 {exitingTeam ? 'Exiting...' : 'Exit Team'}
                </button>
                <TransitionLink
                  to="/teams"
                  className="font-body font-extrabold text-xs sm:text-sm tracking-wider px-7 py-3.5 rounded-2xl bg-[#3E5868] text-white no-underline flex items-center justify-center gap-2.5 transition-all duration-200 hover:bg-[#4d6a7d] shadow-md min-h-[50px]"
                  style={{ border: '1px solid rgba(255, 255, 255, 0.25)', boxShadow: '0 8px 20px rgba(62, 88, 104, 0.35)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Manage in Teams Hub →
                </TransitionLink>
              </div>
            </div>

            {/* Team Members */}
            <div>
              <p className="font-body text-xs tracking-[0.15em] font-extrabold mb-4 uppercase" style={{ color: 'var(--color-text-muted)' }}>
                MEMBERS ({myTeamMembers.length} / {event.maxTeamSize ?? 4})
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {myTeamMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors" style={{ background: 'var(--color-ivory)', border: '1px solid var(--color-cream)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm font-bold flex-shrink-0" style={{ background: 'var(--color-slate-blue)', color: '#fff' }}>
                      {(m.userName?.charAt(0) || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-body font-bold text-sm truncate m-0 mb-0.5" style={{ color: 'var(--color-text-primary)' }}>{m.userName}</p>
                      <p className="font-body text-[11px] truncate m-0" style={{ color: 'var(--color-text-muted)' }}>
                        {[m.userBranch, m.userYear, m.userDivision && `Div ${m.userDivision}`].filter(Boolean).join(' · ')}
                        {m.userPnr && ` · ${m.userPnr}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <EventInfoSection
        event={event}
        enrollmentCount={enrollmentCount}
        teamCount={teamCount}
      />

      {/* Bottom — Action CTA + Back to Top */}
      <div className="pt-16 pb-12 md:py-24 text-center flex flex-col items-center gap-10" style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-cream)' }}>
        {/* Show upload button for captains when submissions are enabled */}
        {isRegistered && event.submissionsEnabled && isCaptain && (
          <div className="mb-2 w-full flex justify-center px-4">
            <button
              onClick={() => setIsSubOpen(true)}
              className="w-full max-w-[320px] py-4 px-8 min-h-[56px] rounded-2xl font-body font-extrabold text-sm sm:text-base text-white shadow-xl flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-[0.98] border-none"
              style={{
                background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                boxShadow: '0 10px 28px rgba(62, 88, 104, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload Project →
            </button>
          </div>
        )}

        {/* Inline Action Button (Desktop only — on mobile the floating bottom CTA is used) */}
        <div className="hidden md:flex flex-col items-center gap-4">
          {isRegistered ? (
            <TransitionLink
              to="/my-tickets"
              className="py-5 px-9 text-base md:text-lg font-bold font-body text-white no-underline transition-all duration-200 active:scale-[0.98] rounded-2xl flex items-center gap-3 shadow-lg min-h-[60px]"
              style={{
                background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                boxShadow: '0 10px 25px rgba(62, 88, 104, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>
              View Ticket / Pass →
            </TransitionLink>
          ) : user ? (
            <button
              onClick={() => setIsRegOpen(true)}
              className="py-5 px-9 text-base md:text-lg font-bold font-body text-white cursor-pointer transition-all duration-200 active:scale-[0.98] rounded-2xl flex items-center gap-3 border-none shadow-lg min-h-[60px]"
              style={{
                background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                boxShadow: '0 10px 25px rgba(62, 88, 104, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              <span>Register Now</span>
              <span>→</span>
            </button>
          ) : (
            <TransitionLink
              to="/auth"
              className="py-5 px-9 text-base md:text-lg font-bold font-body text-white no-underline transition-all duration-200 active:scale-[0.98] rounded-2xl flex items-center gap-3 shadow-lg min-h-[60px]"
              style={{
                background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                boxShadow: '0 10px 25px rgba(62, 88, 104, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              Login to Register →
            </TransitionLink>
          )}
        </div>

        {/* Back to Top — Stacked cleanly BELOW Register Now */}
        <div className="pt-2">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex flex-col items-center gap-2.5 cursor-pointer group"
            style={{ background: 'none', border: 'none' }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1 bg-white border border-slate-300 text-slate-700 shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </div>
            <span className="font-body text-xs uppercase tracking-widest font-bold text-slate-600">Back to top</span>
          </button>
        </div>
      </div>

      {/* Spacer so page content ends well above mobile floating button */}
      <div className="h-32 md:hidden" />

      {/* Submission Modal */}
      {isSubOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(16px)' }}>
          <div className="min-h-screen flex items-center justify-center py-12 px-6">
            <div className="w-full max-w-2xl">
              <SubmissionPanel
                eventId={event.id}
                eventTitle={event.title}
                teamId={myTeam?.id || myTicket?.teamName}
                onClose={() => setIsSubOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal — only shown when not yet registered */}
      {isRegOpen && !isRegistered && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'var(--color-bg)', backdropFilter: 'blur(8px)' }}>
          <div className="min-h-screen flex items-center justify-center py-12 px-4">
            <button
              onClick={() => setIsRegOpen(false)}
              className="absolute top-6 right-6 md:top-10 md:right-10 z-[60] w-12 h-12 flex items-center justify-center cursor-pointer rounded-full transition-all duration-300 hover:bg-[rgba(62,88,104,0.06)] bg-white border border-slate-300"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-slate-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="w-full relative z-50">
              <RegistrationPanel event={event} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky CTA Container */}
      <div className="md:hidden fixed bottom-6 left-0 right-0 z-40 px-5 flex justify-center pointer-events-none">
        {isRegistered ? (
          <TransitionLink
            to="/my-tickets"
            className="w-full max-w-[290px] py-5 px-7 text-base font-bold font-body text-white no-underline transition-all duration-200 active:scale-[0.98] rounded-2xl flex items-center justify-center gap-3 pointer-events-auto shadow-xl min-h-[60px]"
            style={{
              background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
              boxShadow: '0 10px 28px rgba(62, 88, 104, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>
            View Ticket / Pass →
          </TransitionLink>
        ) : user ? (
          <button
            onClick={() => setIsRegOpen(true)}
            className="w-full max-w-[290px] py-5 px-7 text-base font-bold font-body text-white cursor-pointer transition-all duration-200 active:scale-[0.98] rounded-2xl flex items-center justify-center gap-3 border-none pointer-events-auto shadow-xl min-h-[60px]"
            style={{
              background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
              boxShadow: '0 10px 28px rgba(62, 88, 104, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            Register Now →
          </button>
        ) : (
          <TransitionLink
            to="/auth"
            className="w-full max-w-[290px] py-5 px-7 text-base font-bold font-body text-white no-underline transition-all duration-200 active:scale-[0.98] rounded-2xl flex items-center justify-center gap-3 pointer-events-auto shadow-xl min-h-[60px]"
            style={{
              background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
              boxShadow: '0 10px 28px rgba(62, 88, 104, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            Login to Register →
          </TransitionLink>
        )}
      </div>
    </div>
  )
}
