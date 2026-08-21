import { useState, useEffect, useRef } from 'react'
import type { EventData, Speaker, ScheduleDay, Session } from '../../mocks/types'

interface EventEditorModalProps {
  event?: EventData | null
  isOpen: boolean
  onClose: () => void
  onSave: (event: EventData) => Promise<void>
}

const PRESET_CATEGORIES = [
  'Hackathon',
  'Design Sprint',
  'Workshop',
  'Competition',
  'Tech Conference',
  'Ideathon',
  'Bootcamp',
  'Meetup',
  'Robotics',
  'AI Summit',
  'Web3 Sprint'
]

const PRESET_COLORS = ['#6366F1', '#22D3EE', '#818CF8', '#EC4899', '#10B981', '#F59E0B']

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function formatDateRange(startDateStr: string, endDateStr: string): string {
  if (!startDateStr) return ''
  const start = new Date(startDateStr)
  if (isNaN(start.getTime())) return startDateStr

  const startMonth = MONTH_NAMES[start.getMonth()]
  const startDay = start.getDate()
  const startYear = start.getFullYear()

  if (!endDateStr || startDateStr === endDateStr) {
    return `${startMonth} ${startDay}, ${startYear}`
  }

  const end = new Date(endDateStr)
  if (isNaN(end.getTime())) return `${startMonth} ${startDay}, ${startYear}`

  const endMonth = MONTH_NAMES[end.getMonth()]
  const endDay = end.getDate()
  const endYear = end.getFullYear()

  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${startDay}–${endDay}, ${startYear}`
  }
  if (startYear === endYear) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`
}

export default function EventEditorModal({ event, isOpen, onClose, onSave }: EventEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'poster' | 'speakers' | 'schedule'>('details')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Poster image state
  const [posterUrl, setPosterUrl] = useState('')
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreviewDataUrl, setPosterPreviewDataUrl] = useState('')
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [cropScale, setCropScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const posterInputRef = useRef<HTMLInputElement>(null)

  // Form states
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateMode, setDateMode] = useState<'calendar' | 'custom'>('calendar')

  // Category states
  const [category, setCategory] = useState('Hackathon')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryInput, setCustomCategoryInput] = useState('')

  const [shortDescription, setShortDescription] = useState('')
  const [fullDescription, setFullDescription] = useState('')
  const [location, setLocation] = useState('')
  const [address, setAddress] = useState('')
  const [attendees, setAttendees] = useState('0')
  const [isPast, setIsPast] = useState(false)
  const [maxTeamSize, setMaxTeamSize] = useState(4)
  const [time, setTime] = useState('')
  const [submissionsEnabled, setSubmissionsEnabled] = useState(false)
  const [teamFormationLive, setTeamFormationLive] = useState(false)
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [schedule, setSchedule] = useState<ScheduleDay[]>([])

  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setDate(event.date || '')

      // Determine category
      if (PRESET_CATEGORIES.includes(event.category)) {
        setCategory(event.category)
        setIsCustomCategory(false)
        setCustomCategoryInput('')
      } else {
        setCategory('custom')
        setIsCustomCategory(true)
        setCustomCategoryInput(event.category || '')
      }

      setShortDescription(event.shortDescription || '')
      setFullDescription(event.fullDescription || '')
      setLocation(event.location || '')
      setAddress(event.address || '')
      setAttendees(event.attendees || '0')
      setIsPast(!!event.isPast)
      setMaxTeamSize(event.maxTeamSize ?? 4)
      setTime(event.time || '')
      setSubmissionsEnabled(!!event.submissionsEnabled)
      setTeamFormationLive(!!event.teamFormationLive)
      setSpeakers(event.speakers ? JSON.parse(JSON.stringify(event.speakers)) : [])
      setSchedule(event.schedule ? JSON.parse(JSON.stringify(event.schedule)) : [])
      setDateMode('custom') // If editing existing string, default to text or allow calendar
      // Poster
      setPosterUrl(event.posterUrl || '')
      setPosterFile(null)
      setPosterPreviewDataUrl(event.posterUrl || '')
      setCropOffset({ x: 0, y: 0 })
      setCropScale(1)
    } else {
      // Defaults for brand new event
      setTitle('')
      setDate('NOV 14–16, 2026')
      setStartDate('')
      setEndDate('')
      setDateMode('calendar')
      setCategory('Hackathon')
      setIsCustomCategory(false)
      setCustomCategoryInput('')
      setShortDescription('')
      setFullDescription('')
      setLocation('Campus Technology Arena')
      setAddress('Innovation Way, Main Campus')
      setAttendees('0')
      setIsPast(false)
      setMaxTeamSize(4)
      setTime('')
      setSubmissionsEnabled(false)
      setTeamFormationLive(false)
      setSpeakers([])
      setSchedule([])
      // Poster
      setPosterUrl('')
      setPosterFile(null)
      setPosterPreviewDataUrl('')
      setCropOffset({ x: 0, y: 0 })
      setCropScale(1)
    }
    setError('')
    setActiveTab('details')
  }, [event, isOpen])

  if (!isOpen) return null

  // Handle calendar change
  const handleCalendarChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    if (newStart) {
      const formatted = formatDateRange(newStart, newEnd)
      setDate(formatted)
    }
  }

  // Speaker helpers
  const handleAddSpeaker = () => {
    const newSpk: Speaker = {
      id: `spk-${Date.now()}`,
      name: 'New Speaker',
      role: 'Guest Speaker',
      color: PRESET_COLORS[speakers.length % PRESET_COLORS.length],
      initials: 'GS',
    }
    setSpeakers([...speakers, newSpk])
  }

  const handleUpdateSpeaker = (index: number, field: keyof Speaker, value: string) => {
    const updated = [...speakers]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'name') {
      const parts = value.trim().split(' ')
      updated[index].initials = parts.length > 1
        ? `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
        : (parts[0]?.substring(0, 2) || '').toUpperCase()
    }
    setSpeakers(updated)
  }

  const handleRemoveSpeaker = (index: number) => {
    setSpeakers(speakers.filter((_, i) => i !== index))
  }

  // Schedule helpers
  const handleAddDay = () => {
    const nextNum = schedule.length + 1
    const newDay: ScheduleDay = {
      day: `DAY 0${nextNum}`,
      date: 'DAY ' + nextNum,
      color: PRESET_COLORS[(nextNum - 1) % PRESET_COLORS.length],
      sessions: [
        { time: '10:00', title: 'Morning Check-in', speaker: 'Mentors', tag: 'CHECK-IN', tagColor: '#22D3EE' }
      ]
    }
    setSchedule([...schedule, newDay])
  }

  const handleRemoveDay = (dayIdx: number) => {
    setSchedule(schedule.filter((_, i) => i !== dayIdx))
  }

  const handleAddSession = (dayIdx: number) => {
    const updated = [...schedule]
    const newSession: Session = {
      time: '14:00',
      title: 'Workshop / Session',
      speaker: '',
      tag: 'SESSION',
      tagColor: '#6366F1'
    }
    updated[dayIdx].sessions.push(newSession)
    setSchedule(updated)
  }

  const handleUpdateSession = (dayIdx: number, sessIdx: number, field: keyof Session, val: string) => {
    const updated = [...schedule]
    updated[dayIdx].sessions[sessIdx] = {
      ...updated[dayIdx].sessions[sessIdx],
      [field]: val
    }
    setSchedule(updated)
  }

  const handleRemoveSession = (dayIdx: number, sessIdx: number) => {
    const updated = [...schedule]
    updated[dayIdx].sessions.splice(sessIdx, 1)
    setSchedule(updated)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Event title is required')
      setActiveTab('details')
      return
    }
    if (!date.trim()) {
      setError('Event date is required')
      setActiveTab('details')
      return
    }

    const finalCategory = (isCustomCategory ? customCategoryInput.trim() : category.trim()) || 'Hackathon'

    setSaving(true)
    setError('')
    try {
      const generatedId = event?.id || `evt-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || Date.now()}`
      const payload: EventData = {
        id: generatedId,
        title: title.trim().toUpperCase(),
        date: date.trim(),
        category: finalCategory,
        shortDescription: shortDescription.trim() || `${title} - Innovation and Technology Event.`,
        fullDescription: fullDescription.trim() || shortDescription.trim() || 'Join hundreds of developers and designers.',
        location: location.trim() || 'Campus Center',
        address: address.trim() || 'Main Campus Hub',
        attendees: attendees.trim() || '0',
        speakers: speakers.filter(s => s.name.trim().length > 0),
        schedule,
        isPast,
        maxTeamSize,
        time: time.trim(),
        submissionsEnabled,
        teamFormationLive,
        posterUrl: posterPreviewDataUrl || posterUrl || '',
      }
      await onSave(payload)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 0,
    color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    padding: '0.65rem 0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--color-text-muted)',
    letterSpacing: '0.15em',
    fontSize: '0.72rem',
    display: 'block',
    marginBottom: '0.35rem',
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" style={{ background: 'rgba(5,5,10,0.88)', backdropFilter: 'blur(16px)' }}>
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative"
        style={{
          background: 'rgba(17,17,24,0.96)',
          border: '1px solid rgba(99,102,241,0.3)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(99,102,241,0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-accent)', boxShadow: '0 0 8px var(--color-accent)' }} />
            <h2 className="font-display text-2xl tracking-wider text-white">
              {event ? `EDIT EVENT · ${event.title}` : 'CREATE NEW EVENT'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-ui text-xs tracking-widest px-3 py-1.5 cursor-pointer text-gray-400 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            ESC / CLOSE
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 px-8 py-3 bg-black/50 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {[
            { id: 'details', label: '1. GENERAL INFO', icon: '📝' },
            { id: 'poster', label: '2. POSTER IMAGE', icon: '🖼' },
            { id: 'speakers', label: `3. SPEAKERS (${speakers.length})`, icon: '🎙' },
            { id: 'schedule', label: `4. TIMELINE (${schedule.length} DAYS)`, icon: '📅' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className="px-4 py-2 font-ui font-bold text-xs tracking-wider cursor-pointer transition-all flex items-center gap-2 rounded"
                style={{
                  color: isActive ? '#00f2fe' : '#94a3b8',
                  background: isActive ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
                  border: isActive ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isActive ? '0 0 12px rgba(34,211,238,0.15)' : 'none',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-ui tracking-wide">
              ⚠ {error}
            </div>
          )}

          {/* TAB: POSTER IMAGE */}
          {activeTab === 'poster' && (
            <div className="space-y-6">
              <div>
                <p style={{ ...labelStyle, fontSize: '0.85rem', marginBottom: 4 }}>POSTER / CARD IMAGE</p>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'var(--font-body)', marginBottom: 16 }}>
                  Upload a poster image for this event's card. It will be displayed at a <strong style={{ color: '#e2e8f0' }}>3:2 landscape ratio</strong> on the Events page. The preview below shows exactly how the card will look.
                </p>

                {/* File input */}
                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setPosterFile(file)
                    setCropOffset({ x: 0, y: 0 })
                    setCropScale(1)
                    // Read as data URL for preview
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      setPosterPreviewDataUrl(ev.target?.result as string)
                    }
                    reader.readAsDataURL(file)
                  }}
                />

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  {/* Upload controls */}
                  <div className="space-y-4 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => posterInputRef.current?.click()}
                      className="flex items-center justify-center gap-3 px-6 cursor-pointer font-ui font-bold text-xs tracking-wider"
                      style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee', minHeight: 44, width: '100%' }}
                    >
                      🖼 {posterPreviewDataUrl ? 'CHANGE POSTER IMAGE' : 'UPLOAD POSTER IMAGE'}
                    </button>

                    {posterPreviewDataUrl && (
                      <button
                        type="button"
                        onClick={() => { setPosterPreviewDataUrl(''); setPosterFile(null); setPosterUrl(''); setCropOffset({ x: 0, y: 0 }); setCropScale(1) }}
                        className="flex items-center justify-center gap-2 px-4 cursor-pointer font-ui text-xs tracking-wider"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', minHeight: 44, width: '100%' }}
                      >
                        ✕ REMOVE POSTER
                      </button>
                    )}

                    {posterPreviewDataUrl && (
                      <div className="space-y-3" style={{ minWidth: 200 }}>
                        <div>
                          <p style={{ ...labelStyle, marginBottom: 6 }}>ZOOM ({Math.round(cropScale * 100)}%)</p>
                          <input
                            type="range" min={1} max={2} step={0.01}
                            value={cropScale}
                            onChange={e => setCropScale(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: '#22d3ee', height: 44 }}
                          />
                        </div>
                        <p style={{ color: '#64748b', fontSize: 11, fontFamily: 'var(--font-body)' }}>Drag image in preview to reposition</p>
                      </div>
                    )}

                    {!posterPreviewDataUrl && (
                      <div
                        onClick={() => posterInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-3 cursor-pointer"
                        style={{ width: 240, aspectRatio: '3/4', border: '2px dashed rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)', color: '#64748b', fontSize: 12, fontFamily: 'var(--font-body)' }}
                      >
                        <span style={{ fontSize: 36 }}>📷</span>
                        <span style={{ textAlign: 'center', lineHeight: 1.4 }}>Click to upload<br />poster image</span>
                      </div>
                    )}
                  </div>

                  {/* Live card preview */}
                  {posterPreviewDataUrl && (
                    <div className="flex-1 w-full max-w-[320px]">
                      <div className="flex items-center justify-between mb-2">
                        <p style={{ ...labelStyle, marginBottom: 0 }}>LIVE CARD PREVIEW</p>
                        <span className="font-ui text-[10px] text-gray-500 tracking-widest border border-gray-700 px-2 py-0.5 rounded">MOBILE WIDTH</span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '3/4',
                          borderRadius: 12,
                          overflow: 'hidden',
                          position: 'relative',
                          isolation: 'isolate',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          cursor: isDragging ? 'grabbing' : 'grab',
                          userSelect: 'none',
                        }}
                        onMouseDown={e => {
                          setIsDragging(true)
                          setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y })
                        }}
                        onMouseMove={e => {
                          if (!isDragging) return
                          setCropOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
                        }}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseLeave={() => setIsDragging(false)}
                      >
                        {/* image */}
                        <img
                          src={posterPreviewDataUrl}
                          alt="preview"
                          style={{
                            position: 'absolute',
                            width: `${cropScale * 100}%`,
                            height: `${cropScale * 100}%`,
                            objectFit: 'cover',
                            top: `${cropOffset.y}px`,
                            left: `${cropOffset.x}px`,
                            pointerEvents: 'none',
                            transition: isDragging ? 'none' : 'all 0.1s',
                          }}
                        />
                        {/* top scrim */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56, background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)', zIndex: 2 }} />
                        {/* bottom gradient */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 40%, transparent 70%)', zIndex: 2 }} />
                        {/* Bottom content stacked */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 3 }}>
                          {/* Badge */}
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fff', padding: '3px 10px', borderRadius: 9999, backgroundColor: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)' }}>
                              {((isCustomCategory ? customCategoryInput : category) || 'Category').replace(/s$/i, '')}
                            </span>
                          </div>
                          {/* Title */}
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.1, letterSpacing: '0.02em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {title || 'Event Title'}
                          </p>
                          {/* Button */}
                          <div style={{ marginTop: 4 }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fff' }}>ENROLL NOW →</span>
                          </div>
                        </div>
                      </div>
                      <p style={{ color: '#64748b', fontSize: 10, fontFamily: 'var(--font-body)', marginTop: 8 }}>← Drag to reposition · Use zoom slider to scale</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>EVENT TITLE</label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="e.g. HACK THE FUTURE"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Fully Customizable Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label style={labelStyle}>CATEGORY</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="font-ui text-xs text-cyan-400 hover:underline cursor-pointer"
                    >
                      {isCustomCategory ? '← Choose Preset' : '+ Type Custom Category'}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        style={inputStyle}
                        placeholder="e.g. Cybersecurity CTF, Quantum Jam..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                  ) : (
                    <select
                      style={inputStyle}
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setIsCustomCategory(true)
                        } else {
                          setCategory(e.target.value)
                        }
                      }}
                    >
                      {PRESET_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} style={{ background: '#111118', color: '#fff' }}>{cat}</option>
                      ))}
                      <option value="custom" style={{ background: '#111118', color: 'var(--color-accent)' }}>+ Custom Category...</option>
                    </select>
                  )}
                </div>
              </div>

              {/* DATE SECTION WITH CALENDAR PICKER */}
              <div className="p-4 border bg-black/40" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <label style={labelStyle}>EVENT DATES & TIMEFRAME</label>
                    <p className="font-ui text-xs text-gray-400">Pick start & end dates using the calendar, or type custom date text.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDateMode('calendar')}
                      className={`px-3 py-1 font-ui font-semibold text-xs tracking-wider cursor-pointer ${dateMode === 'calendar' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-400 border border-white/10'}`}
                    >
                      📅 Calendar Picker
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode('custom')}
                      className={`px-3 py-1 font-ui font-semibold text-xs tracking-wider cursor-pointer ${dateMode === 'custom' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'text-gray-400 border border-white/10'}`}
                    >
                      ✏ Custom Text
                    </button>
                  </div>
                </div>

                {dateMode === 'calendar' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="font-ui text-xs text-gray-400 block mb-1">START DATE</span>
                      <input
                        type="date"
                        style={{ ...inputStyle, colorScheme: 'dark' }}
                        value={startDate}
                        onChange={(e) => handleCalendarChange(e.target.value, endDate)}
                        required={!date}
                      />
                    </div>
                    <div>
                      <span className="font-ui text-xs text-gray-400 block mb-1">END DATE (OPTIONAL FOR MULTI-DAY)</span>
                      <input
                        type="date"
                        style={{ ...inputStyle, colorScheme: 'dark' }}
                        value={endDate}
                        min={startDate}
                        onChange={(e) => handleCalendarChange(startDate, e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="e.g. NOV 14–16, 2026 or SPRING 2026"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Formatted Date Preview */}
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-ui">
                  <span className="text-gray-400">DISPLAY BADGE PREVIEW:</span>
                  <span className="font-display text-base text-cyan-400 tracking-wider">
                    {date || 'NO DATE SPECIFIED'}
                  </span>
                </div>

                {/* Time of Event */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <label style={labelStyle}>TIME OF EVENT (OPTIONAL)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      style={{ ...inputStyle, width: 160, colorScheme: 'dark' }}
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                    {time && (
                      <span className="font-ui text-xs text-cyan-400">
                        ⏰ {new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {!time && (
                      <span className="font-ui text-xs text-gray-500">No time set — leave blank if TBA</span>
                    )}
                  </div>
                </div>

                {/* Shortcut to Schedule / Timeline Tab */}
                <div className="mt-4 p-4 border flex items-center justify-between gap-4 flex-wrap" style={{ background: 'rgba(34,211,238,0.05)', borderColor: 'rgba(34,211,238,0.25)' }}>
                  <div>
                    <span className="font-ui font-bold text-xs tracking-widest block text-cyan-400">📅 EVENT TIMELINE / SCHEDULE</span>
                    <span className="font-ui text-xs text-gray-400">
                      {schedule.length > 0 ? `${schedule.length} schedule day(s) configured.` : 'No timeline sessions added yet.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('schedule')}
                    className="px-4 py-2 font-ui font-bold text-xs tracking-wider text-black bg-cyan-400 hover:bg-cyan-300 cursor-pointer rounded transition-all"
                  >
                    {schedule.length > 0 ? 'EDIT TIMELINE →' : '+ CREATE EVENT TIMELINE →'}
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>LOCATION (VENUE)</label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="e.g. University Arena Complex"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>ESTIMATED ATTENDEES</label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="e.g. 500+ / 1,200 Students"
                    value={attendees}
                    onChange={(e) => setAttendees(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>MAX TEAM SIZE (MEMBERS PER TEAM)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={2}
                    max={20}
                    style={{ ...inputStyle, width: 120 }}
                    value={maxTeamSize}
                    onChange={(e) => setMaxTeamSize(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
                  />
                  <p className="font-ui text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Users cannot join a team once it reaches this limit. (Min: 2, Max: 20)
                  </p>
                </div>
              </div>


              <div>
                <label style={labelStyle}>CAMPUS ADDRESS / ROOM</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="e.g. 100 Innovation Way, Block A"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>SHORT DESCRIPTION (CARD TEASER)</label>
                <textarea
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="48-hour student hackathon focusing on AI and spatial computing..."
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>FULL DESCRIPTION</label>
                <textarea
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Detailed overview for the event detail page..."
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value)}
                />
              </div>

              <div className="p-4 border flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div>
                  <p className="font-ui font-semibold text-xs tracking-wider text-white">EVENT LIFECYCLE STATUS</p>
                  <p className="font-ui text-xs text-gray-400">Mark as past event to display in the Hall of Fame archive.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPast(!isPast)}
                  className="px-4 py-2 font-ui font-bold text-xs tracking-widest cursor-pointer transition-all"
                  style={{
                    background: isPast ? 'rgba(248,113,113,0.15)' : 'rgba(34,211,238,0.15)',
                    border: `1px solid ${isPast ? '#f87171' : 'var(--color-accent)'}`,
                    color: isPast ? '#fca5a5' : 'var(--color-accent)',
                  }}
                >
                  {isPast ? 'STATUS: PAST / ARCHIVED' : 'STATUS: UPCOMING / ACTIVE'}
                </button>
              </div>

              {/* Submissions Control */}
              <div className="p-4 border flex items-center justify-between" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.25)' }}>
                <div>
                  <p className="font-ui font-semibold text-xs tracking-wider text-white">PROJECT SUBMISSIONS CONTROL</p>
                  <p className="font-ui text-xs text-gray-400">Enable or disable project submission buttons for enrolled users.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionsEnabled(!submissionsEnabled)}
                  className="px-4 py-2 font-ui font-bold text-xs tracking-widest cursor-pointer transition-all"
                  style={{
                    background: submissionsEnabled ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${submissionsEnabled ? 'var(--color-accent)' : 'rgba(255,255,255,0.2)'}`,
                    color: submissionsEnabled ? 'var(--color-accent)' : '#94a3b8',
                  }}
                >
                  {submissionsEnabled ? '✓ SUBMISSIONS OPEN' : '🔒 SUBMISSIONS CLOSED'}
                </button>
              </div>

              {/* Team Formation Control */}
              <div className="p-4 border flex items-center justify-between" style={{ background: 'rgba(34,211,238,0.05)', borderColor: 'rgba(34,211,238,0.25)' }}>
                <div>
                  <p className="font-ui font-semibold text-xs tracking-wider text-white">TEAM FORMATION CONTROL</p>
                  <p className="font-ui text-xs text-gray-400">Allow users to form or join teams for this event.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamFormationLive(!teamFormationLive)}
                  className="px-4 py-2 font-ui font-bold text-xs tracking-widest cursor-pointer transition-all"
                  style={{
                    background: teamFormationLive ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${teamFormationLive ? 'var(--color-accent)' : 'rgba(255,255,255,0.2)'}`,
                    color: teamFormationLive ? 'var(--color-accent)' : '#94a3b8',
                  }}
                >
                  {teamFormationLive ? '✓ TEAM FORMATION LIVE' : '🔒 FORMATION PAUSED'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SPEAKERS */}
          {activeTab === 'speakers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-ui text-xs tracking-wider text-gray-400">
                  Add mentors, keynote speakers, and judges associated with this event.
                </p>
                <button
                  type="button"
                  onClick={handleAddSpeaker}
                  className="px-3.5 py-1.5 font-ui font-semibold text-xs tracking-widest"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid var(--color-primary)', color: '#818cf8', cursor: 'pointer' }}
                >
                  + ADD SPEAKER
                </button>
              </div>

              {speakers.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-800 text-gray-500 font-ui text-xs tracking-widest">
                  NO SPEAKERS ADDED YET. CLICK "+ ADD SPEAKER" TO BEGIN.
                </div>
              ) : (
                <div className="space-y-3">
                  {speakers.map((spk, idx) => (
                    <div
                      key={spk.id || idx}
                      className="p-4 border flex flex-wrap md:flex-nowrap items-center gap-4"
                      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center font-display text-base font-bold text-white"
                        style={{ background: spk.color || '#6366F1' }}
                      >
                        {spk.initials || 'SP'}
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          placeholder="Speaker Name"
                          style={inputStyle}
                          value={spk.name}
                          onChange={(e) => handleUpdateSpeaker(idx, 'name', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Role (e.g. AI Lead)"
                          style={inputStyle}
                          value={spk.role}
                          onChange={(e) => handleUpdateSpeaker(idx, 'role', e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={spk.color || '#6366F1'}
                            onChange={(e) => handleUpdateSpeaker(idx, 'color', e.target.value)}
                            className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
                          />
                          <input
                            type="text"
                            placeholder="Initials"
                            maxLength={3}
                            style={{ ...inputStyle, width: '70px', textTransform: 'uppercase' }}
                            value={spk.initials}
                            onChange={(e) => handleUpdateSpeaker(idx, 'initials', e.target.value.toUpperCase())}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpeaker(idx)}
                        className="text-red-400 hover:text-red-300 font-ui text-xs p-2 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SCHEDULE */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <p className="font-ui text-xs tracking-wider text-gray-400">
                  Build the daily timetable and session breakdown for participants.
                </p>
                <button
                  type="button"
                  onClick={handleAddDay}
                  className="px-3.5 py-1.5 font-ui font-semibold text-xs tracking-widest"
                  style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', cursor: 'pointer' }}
                >
                  + ADD DAY
                </button>
              </div>

              {schedule.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-800 text-gray-500 font-ui text-xs tracking-widest">
                  NO SCHEDULE DAYS DEFINED. CLICK "+ ADD DAY" TO ADD TIMELINE.
                </div>
              ) : (
                <div className="space-y-6">
                  {schedule.map((dayItem, dIdx) => (
                    <div
                      key={dIdx}
                      className="p-5 border"
                      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(99,102,241,0.2)' }}
                    >
                      {/* Day Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            style={{ ...inputStyle, width: '110px', fontWeight: 'bold' }}
                            value={dayItem.day}
                            onChange={(e) => {
                              const updated = [...schedule]
                              updated[dIdx].day = e.target.value
                              setSchedule(updated)
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Date (e.g. NOV 14)"
                            style={{ ...inputStyle, width: '130px' }}
                            value={dayItem.date}
                            onChange={(e) => {
                              const updated = [...schedule]
                              updated[dIdx].date = e.target.value
                              setSchedule(updated)
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleAddSession(dIdx)}
                            className="px-3 py-1 font-ui text-xs text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
                          >
                            + Add Session
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDay(dIdx)}
                            className="text-red-400 hover:text-red-300 font-ui text-xs cursor-pointer px-2"
                          >
                            Delete Day
                          </button>
                        </div>
                      </div>

                      {/* Sessions List */}
                      <div className="space-y-2.5">
                        {dayItem.sessions.map((sess, sIdx) => (
                          <div
                            key={sIdx}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 bg-black/40 border border-white/5"
                          >
                            <input
                              type="time"
                              style={{ ...inputStyle, padding: '0.4rem 0.6rem', fontSize: '0.82rem', colorScheme: 'dark' }}
                              className="sm:col-span-3 font-mono cursor-pointer"
                              value={sess.time}
                              onChange={(e) => handleUpdateSession(dIdx, sIdx, 'time', e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="Session Title"
                              style={{ ...inputStyle, padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                              className="sm:col-span-4"
                              value={sess.title}
                              onChange={(e) => handleUpdateSession(dIdx, sIdx, 'title', e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="Speaker / Host"
                              style={{ ...inputStyle, padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                              className="sm:col-span-3"
                              value={sess.speaker}
                              onChange={(e) => handleUpdateSession(dIdx, sIdx, 'speaker', e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="Tag (KEYNOTE)"
                              style={{ ...inputStyle, padding: '0.4rem 0.6rem', fontSize: '0.82rem', textTransform: 'uppercase' }}
                              className="sm:col-span-2 font-ui"
                              value={sess.tag}
                              onChange={(e) => handleUpdateSession(dIdx, sIdx, 'tag', e.target.value.toUpperCase())}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveSession(dIdx, sIdx)}
                              className="sm:col-span-1 text-red-400 hover:text-red-300 font-ui text-xs text-center cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-6 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 font-ui font-semibold text-xs tracking-widest text-gray-400 hover:text-white"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
            >
              CANCEL
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-8 py-3 text-sm font-bold tracking-widest"
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'SAVING TO DATABASE...' : (event ? 'SAVE EVENT CHANGES' : 'PUBLISH EVENT')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
