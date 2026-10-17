import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SectionTransition from '../ui/SectionTransition'
import { useShatter } from '../../hooks/useShatter'
import type { EventData, UserProfile } from '../../mocks/types'
import { eventService } from '../../services/eventService'
import { profileService, checkProfileCompletion, REQUIRED_PROFILE_FIELDS } from '../../services/profileService'
import { useApp } from '../../context/AppContext'

interface RegistrationPanelProps {
  event: EventData
}

export default function RegistrationPanel({ event }: RegistrationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const { user, refreshTickets } = useApp()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { state: shatterState, fire: shatterFire } = useShatter(
    panelRef as React.RefObject<HTMLElement>,
    () => {}
  )

  useEffect(() => {
    if (!user) return
    setProfileLoading(true)
    profileService.getProfile(user.id).then(p => {
      setProfile(p)
      setProfileLoading(false)
    })
  }, [user])

  const { isComplete: isProfileComplete, missingFields, completedCount, totalCount } = checkProfileCompletion(profile)

  const handleEnrollClick = () => {
    if (!isProfileComplete) return
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    if (!user || !profile) return
    setIsSubmitting(true)
    setError('')
    try {
      await eventService.registerForEvent(event.id)
      await refreshTickets()
      shatterFire()
    } catch (e: any) {
      setError(e?.message || 'Registration failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <SectionTransition
        id="register"
        direction="ltr"
        numSelector=".reg-section-num"
        className="relative w-full"
        style={{ padding: '8rem 0', display: 'flex', justifyContent: 'center' }}
      >
        {/* Aesthetic CSS Background: Darker Beige */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" style={{ background: '#E8E4D9' }}>
          {/* Subtle floating gradient orbs */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-40 translate-x-1/3 -translate-y-1/3" style={{ background: '#F5F1E8' }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-20 -translate-x-1/4 translate-y-1/4" style={{ background: 'var(--color-dusty-blue)' }} />
        </div>

        <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col items-center">
          
          {/* Centered Headline */}
          <div className="text-center mb-6 sm:mb-10 w-full">
            <p className="font-ui font-semibold text-[11px] tracking-[0.25em] uppercase text-[var(--color-slate-blue)] mb-2">
              JOIN US
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-[var(--color-text-primary)] mb-2 leading-tight">
              SECURE YOUR <span style={{ color: 'var(--color-slate-blue)' }}>SEAT</span>
            </h2>
            <p className="font-body text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-md mx-auto m-0">
              Step into the arena. Ensure your profile is fully set up to claim your spot in {event.title}. 
            </p>
          </div>

          {/* Centered Spacious Card */}
          <div ref={panelRef} className="w-full" style={{ visibility: shatterState === 'shattering' ? 'hidden' : 'visible' }}>
            <div 
              className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl border border-slate-200 w-full text-center"
            >
              {profileLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 w-full">
                  <div className="w-8 h-8 border-[3px] rounded-full" style={{ borderColor: 'var(--color-slate-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  <span className="font-ui text-xs font-bold tracking-widest text-[var(--color-text-secondary)]">LOADING PROFILE...</span>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  {/* Progress Indicator */}
                  <div className="flex items-center justify-between mb-6 sm:mb-8 w-full gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1">
                      {REQUIRED_PROFILE_FIELDS.map((_, idx) => (
                        <div key={idx} className="h-2 flex-1 rounded-full transition-colors duration-500" style={{ background: idx < completedCount ? '#22c55e' : '#f1f5f9' }} />
                      ))}
                    </div>
                    <span className="font-ui font-bold text-xs tracking-wider text-slate-400 whitespace-nowrap ml-2">
                      {completedCount} OF {totalCount}
                    </span>
                  </div>

                  {!showConfirm ? (
                    <div className="flex flex-col items-center gap-6 sm:gap-8 w-full">
                      <div className="text-center w-full">
                        <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--color-text-primary)] mb-1">
                          {isProfileComplete ? 'Profile Complete' : 'Complete Your Profile'}
                        </h3>
                        <p className="font-body text-xs sm:text-sm text-[var(--color-text-secondary)] m-0">
                          {isProfileComplete 
                            ? 'All required details are set. You are ready to enroll.' 
                            : 'Please update your missing details to continue.'}
                        </p>
                      </div>

                      {/* Fields Grid — 1 column on mobile, 2 on desktop */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        {REQUIRED_PROFILE_FIELDS.map(f => {
                          const val = profile ? profile[f.key] : null;
                          const str = val !== undefined && val !== null ? String(val).trim() : '';
                          const isInvalid = !str ||
                            (f.key === 'pnr' && (str.toUpperCase() === 'NOT SET' || str.toUpperCase() === 'NOT PROVIDED' || str.toUpperCase() === 'N/A')) ||
                            (f.key === 'branch' && (str.toLowerCase().includes('unassigned') || str.toLowerCase().includes('select branch') || str.toUpperCase() === 'NOT SET')) ||
                            (f.key === 'phoneNumber' && (str.replace(/\D/g, '').length < 10 || str.toUpperCase() === 'N/A' || str.toUpperCase() === 'NOT SET')) ||
                            (f.key === 'division' && (str.toUpperCase() === 'NOT SET' || str.toUpperCase() === 'N/A'));
                          const isCompleted = !isInvalid;

                          return (
                            <div key={f.key} className="flex flex-col items-center justify-center gap-1.5 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center relative min-h-[70px]">
                              <span className="font-ui font-bold text-[10px] tracking-wider text-slate-400 uppercase">{f.label}</span>
                              {isCompleted ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center absolute top-3 right-3">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-dashed border-amber-400 bg-amber-50 flex items-center justify-center absolute top-3 right-3">
                                  <span className="text-[10px] text-amber-600 font-bold">!</span>
                                </div>
                              )}
                              <span className={`font-body text-xs font-bold break-all line-clamp-1 px-4 ${isCompleted ? 'text-slate-900' : 'text-amber-600 italic'}`}>
                                {isCompleted ? str : 'Required / Missing'}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Actions & Prompt */}
                      <div className="pt-2 flex flex-col items-center gap-3 w-full">
                        {!isProfileComplete ? (
                          <>
                            <div className="w-full p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                              <p className="font-body text-xs text-amber-900 font-bold m-0 flex items-center justify-center gap-1.5">
                                <span>⚠️</span>
                                <span>Complete your profile ({missingFields.join(', ')}) to enroll.</span>
                              </p>
                            </div>
                            <Link
                              to="/profile?edit=true"
                              state={{ autoEdit: true, from: location.pathname + location.search }}
                              className="w-full max-w-[280px] py-3.5 px-6 rounded-full font-body text-xs font-bold tracking-widest uppercase bg-amber-500 hover:bg-amber-600 text-white no-underline shadow-md flex items-center justify-center gap-2 transition-all hover:opacity-95"
                            >
                              <span>Complete Profile Now</span>
                              <span>→</span>
                            </Link>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleEnrollClick}
                            className="w-full max-w-[260px] py-3.5 px-6 rounded-full font-body text-xs font-bold tracking-widest uppercase bg-[var(--color-slate-blue)] text-white border-none cursor-pointer shadow-md flex items-center justify-center transition-all hover:opacity-95"
                          >
                            Continue
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Confirm State */
                    <div className="flex flex-col items-center gap-6 sm:gap-8 w-full">
                      <div className="text-center w-full">
                        <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--color-text-primary)] mb-1">
                          Confirm Registration
                        </h3>
                        <p className="font-body text-xs sm:text-sm text-[var(--color-text-secondary)] m-0">
                          You are about to register for <strong>{event.title}</strong>.
                        </p>
                      </div>

                      <div className="w-full max-w-md p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex flex-col items-center text-center pb-3 border-b border-slate-200 mb-3">
                          <span className="font-ui font-bold text-[10px] tracking-wider text-slate-400 uppercase mb-0.5">Participant</span>
                          <span className="font-body text-sm font-bold text-slate-900">{profile?.name}</span>
                        </div>
                        <div className="flex flex-col items-center text-center pb-3 border-b border-slate-200 mb-3">
                          <span className="font-ui font-bold text-[10px] tracking-wider text-slate-400 uppercase mb-0.5">Contact</span>
                          <span className="font-body text-sm font-bold text-slate-900">{profile?.contactEmail}</span>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <span className="font-ui font-bold text-[10px] tracking-wider text-slate-400 uppercase mb-0.5">Event Fee</span>
                          <span className="font-body text-sm font-bold text-emerald-600">Free Entry</span>
                        </div>
                      </div>

                      {error && (
                        <div className="w-full max-w-md p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                          <p className="font-body text-xs text-red-600 m-0">{error}</p>
                        </div>
                      )}

                      <div className="flex flex-row gap-3 pt-2 w-full max-w-xs justify-center">
                        <button
                          type="button"
                          onClick={() => setShowConfirm(false)}
                          className="flex-1 py-3 px-4 rounded-full font-body text-xs font-bold tracking-wider uppercase text-slate-700 bg-white border border-slate-300 cursor-pointer shadow-sm"
                          disabled={isSubmitting}
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirm}
                          className="flex-1 py-3 px-4 rounded-full font-body text-xs font-bold tracking-wider uppercase text-white bg-[var(--color-slate-blue)] border-none cursor-pointer shadow-md"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Confirming...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionTransition>


      {/* Success Modal */}
      {shatterState === 'done' && profile && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(10,10,15,0.96)', backdropFilter: 'blur(24px)' }}>
          <div className="text-center max-w-lg px-8">
            <div className="w-24 h-24 mx-auto mb-8 flex items-center justify-center rounded-full" style={{ border: '2px solid var(--color-accent)', background: 'rgba(34,211,238,0.08)', animation: 'pulse-glow 2s ease-in-out infinite', boxShadow: '0 0 40px rgba(34,211,238,0.3)' }}>
              <span className="font-display text-4xl" style={{ color: 'var(--color-accent)' }}>✓</span>
            </div>
            <h2 className="font-display mb-4" style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', color: 'var(--color-text)', lineHeight: 1 }}>YOU'RE IN.</h2>
            <p className="text-lg mb-2" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>WELCOME TO {event.title.toUpperCase()}</p>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8, marginBottom: '2rem' }}>
              Your pass for <strong style={{ color: 'var(--color-text)' }}>{profile.name}</strong> has been confirmed.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/teams"
                className="btn-primary px-8 py-3.5 no-underline inline-flex items-center justify-center gap-2 text-base font-bold"
                style={{ textDecoration: 'none', background: 'rgba(34,211,238,0.15)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)', boxShadow: '0 0 25px rgba(34,211,238,0.3)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                CREATE OR JOIN A TEAM →
              </Link>
              <Link to="/my-tickets" className="px-6 py-3.5 font-ui font-semibold text-xs tracking-widest no-underline inline-flex items-center justify-center border" style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--color-text-muted)', letterSpacing: '0.12em' }}>
                VIEW MY TICKETS
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
