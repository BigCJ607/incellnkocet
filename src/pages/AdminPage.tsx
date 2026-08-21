import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { eventService } from '../services/eventService'
import { adminService } from '../services/adminService'
import { getShortBranch } from '../utils/formatters'
import { analyticsService, formatDuration, formatRelativeTime, getDailyBreakdown, getPlatformDailyBreakdown } from '../services/analyticsService'
import type { UserAnalyticsSummary } from '../services/analyticsService'
import { isSupabaseConfigured } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { isOriginalAdminEmail } from '../services/authService'
import { fetchAndExportEventTeamsCSV, exportEnrollmentsToExcel } from '../utils/csvExporter'
import type { EventData, AdminUserView, PlatformStats, EventEnrollmentView, Team, TeamMember } from '../mocks/types'
import EventEditorModal from '../components/admin/EventEditorModal'
import AdminEventTeamsModal from '../components/admin/AdminEventTeamsModal'
import IncompleteProfilesAlertModal, { getMissingProfileFields } from '../components/admin/IncompleteProfilesAlertModal'
import { notificationService } from '../services/notificationService'
import TeamChatModal from '../components/layout/TeamChatModal'
import QRScannerTab from '../components/admin/QRScannerTab'

export default function AdminPage() {
  const { user } = useApp()
  const [activeTab, setActiveTab] = useState<'events' | 'enrollments' | 'users' | 'system' | 'chats' | 'analytics' | 'qrscanner'>('events')
  const [loading, setLoading] = useState(true)

  // Data states
  const [stats, setStats] = useState<PlatformStats>({
    totalEvents: 0,
    activeEvents: 0,
    pastEvents: 0,
    totalUsers: 0,
    totalTickets: 0,
  })
  const [events, setEvents] = useState<EventData[]>([])
  const [users, setUsers] = useState<AdminUserView[]>([])
  const [enrollments, setEnrollments] = useState<EventEnrollmentView[]>([])

  // Filter & search states
  const [eventSearch, setEventSearch] = useState('')
  const [eventFilter, setEventFilter] = useState<'all' | 'active' | 'past'>('all')
  const [userSearch, setUserSearch] = useState('')
  const [userDivisionFilter, setUserDivisionFilter] = useState('All')
  const [userBranchFilter, setUserBranchFilter] = useState('All')
  const [userYearFilter, setUserYearFilter] = useState('All')
  const [userProfileStatusFilter, setUserProfileStatusFilter] = useState<'all' | 'incomplete' | 'complete'>('all')
  const [showIncompleteAlertModal, setShowIncompleteAlertModal] = useState(false)
  const [enrollmentSearch, setEnrollmentSearch] = useState('')
  const [enrollmentEventFilter, setEnrollmentEventFilter] = useState('All')

  // Modals & inspect
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null)
  const [selectedUserForTickets, setSelectedUserForTickets] = useState<AdminUserView | null>(null)
  const [selectedEnrollmentForModal, setSelectedEnrollmentForModal] = useState<EventEnrollmentView | null>(null)
  const [selectedEventForTeamsModal, setSelectedEventForTeamsModal] = useState<EventData | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState('')
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  // Team chats viewer (original admin only)
  const [teamsWithChats, setTeamsWithChats] = useState<{ team: Team; members: TeamMember[] }[]>([])
  const [chatSearch, setChatSearch] = useState('')
  const [adminChatTeam, setAdminChatTeam] = useState<{ team: Team; members: TeamMember[] } | null>(null)

  // Analytics (original admin only)
  const [userAnalytics, setUserAnalytics] = useState<UserAnalyticsSummary[]>([])
  const [analyticsSearch, setAnalyticsSearch] = useState('')
  const [analyticsSort, setAnalyticsSort] = useState<'today' | 'time' | 'dailyAvg' | 'sessions' | 'lastSeen' | 'messages' | 'events'>('today')
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [selectedAnalyticsUser, setSelectedAnalyticsUser] = useState<UserAnalyticsSummary | null>(null)

  const isConfigured = isSupabaseConfigured()

  const loadData = async () => {
    setLoading(true)
    try {
      const [allEvents, allUsers, allEnrollments, platformStats] = await Promise.all([
        eventService.getAllEvents(),
        adminService.getAllUsers(),
        adminService.getAllEnrollments(),
        adminService.getPlatformStats(),
      ])
      setEvents(allEvents)
      setUsers(allUsers)
      setEnrollments(allEnrollments)
      setStats(platformStats)
      // Load all team chats for original admin
      if (isOriginalAdminEmail(user?.email)) {
        const allTeams = await adminService.getAllTeamsWithChats()
        setTeamsWithChats(allTeams)
        // Load analytics
        setAnalyticsLoading(true)
        analyticsService.getAllUsersAnalytics().then(data => {
          setUserAnalytics(data)
          setAnalyticsLoading(false)
        })
      }
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const showNotification = (msg: string) => {
    setActionSuccessMessage(msg)
    setTimeout(() => setActionSuccessMessage(''), 3500)
  }

  const handleCreateNewEvent = () => {
    setEditingEvent(null)
    setEditorOpen(true)
  }

  const handleEditEvent = (evt: EventData) => {
    setEditingEvent(evt)
    setEditorOpen(true)
  }

  const handleDeleteEvent = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return
    }
    try {
      await eventService.deleteEvent(id)
      showNotification(`Event "${title}" has been deleted.`)
      await loadData()
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  const handleTogglePastStatus = async (evt: EventData) => {
    try {
      const updated = await eventService.updateEvent(evt.id, { isPast: !evt.isPast })
      showNotification(`Updated status for "${updated.title}"`)
      await loadData()
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`)
    }
  }

  const handleToggleFormation = async (evt: EventData) => {
    const newStatus = !evt.teamFormationLive
    try {
      await eventService.toggleTeamFormation(evt.id, newStatus)
      setEvents(prev => prev.map(e => e.id === evt.id ? { ...e, teamFormationLive: newStatus } : e))
      showNotification(newStatus ? `Team formation is now LIVE for "${evt.title}".` : `Team formation is now CLOSED for "${evt.title}".`)
    } catch (err: any) {
      alert(`Failed to toggle team formation: ${err.message}`)
    }
  }

  const handleSaveEvent = async (savedEvent: EventData) => {
    if (editingEvent) {
      await eventService.updateEvent(editingEvent.id, savedEvent)
      showNotification(`Event "${savedEvent.title}" updated successfully.`)
    } else {
      await eventService.createEvent(savedEvent)
      showNotification(`Event "${savedEvent.title}" created successfully.`)
    }
    await loadData()
  }

  const handleToggleUserRole = async (targetUser: AdminUserView) => {
    const currentEmail = user?.email?.toLowerCase()
    const targetEmail = targetUser.email.toLowerCase()

    if (isOriginalAdminEmail(targetEmail) && !isOriginalAdminEmail(currentEmail)) {
      alert('Only the original admin can modify admin privileges for this account.')
      return
    }

    const nextRole = targetUser.role === 'admin' ? 'student' : 'admin'
    try {
      await adminService.updateUserRole(targetUser.id, nextRole)
      showNotification(`User role updated to ${nextRole.toUpperCase()}`)
      if (user && (user.id === targetUser.id || user.email.toLowerCase() === targetEmail)) {
        user.role = nextRole
      }
      await loadData()
    } catch (err: any) {
      alert(`Failed to update user role: ${err.message}`)
    }
  }

  const handleToggleScannerAccess = async (targetUser: AdminUserView) => {
    const nextAccess = !targetUser.scannerAccess
    try {
      await adminService.setScannerAccess(targetUser.id, nextAccess)
      showNotification(`Scanner access ${nextAccess ? 'GRANTED to' : 'REVOKED from'} ${targetUser.name}`)
      await loadData()
    } catch (err: any) {
      alert(`Failed to update scanner access: ${err.message}`)
    }
  }

  const handleDeleteUser = async (targetUser: AdminUserView) => {
    if (targetUser.id === user?.id) {
      alert('You cannot delete your own active admin account.')
      return
    }

    if (!window.confirm(`Are you sure you want to delete user "${targetUser.name}" (${targetUser.email})? All associated tickets and team memberships will be removed. This cannot be undone.`)) {
      return
    }

    try {
      await adminService.deleteUser(targetUser.id)
      showNotification(`User "${targetUser.name}" has been deleted.`)
      await loadData()
    } catch (err: any) {
      alert(`Failed to delete user: ${err.message}`)
    }
  }

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"? All team members will be unassigned. This cannot be undone.`)) {
      return
    }

    try {
      await adminService.deleteTeam(teamId)
      showNotification(`Team "${teamName}" deleted successfully.`)
      await loadData()
    } catch (err: any) {
      alert(`Failed to delete team: ${err.message}`)
    }
  }

  const handleExportEnrollmentsCSV = () => {
    exportEnrollmentsToExcel(filteredEnrollments)
  }

  // Filtered lists
  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(eventSearch.toLowerCase()) || e.category.toLowerCase().includes(eventSearch.toLowerCase())
    const matchesStatus = eventFilter === 'all' 
      ? true 
      : eventFilter === 'active' ? !e.isPast : e.isPast
    return matchesSearch && matchesStatus
  })

  const divisions = ['All', ...Array.from(new Set(users.map(u => u.division).filter(Boolean)))]
  const branches = ['All', ...Array.from(new Set(users.map(u => u.branch).filter(Boolean)))]
  const years = ['All', ...Array.from(new Set(users.map(u => u.classYear).filter(Boolean)))]

  const incompleteUsers = users.filter(u => getMissingProfileFields(u).length > 0)
  const incompleteUsersCount = incompleteUsers.length

  const handleSendIndividualAlert = async (targetUser: AdminUserView) => {
    const missing = getMissingProfileFields(targetUser)
    if (missing.length === 0) {
      alert(`User "${targetUser.name}" already has a complete profile!`)
      return
    }
    try {
      await notificationService.createNotification({
        userId: targetUser.id,
        type: 'profile_alert',
        title: '⚠️ Action Required: Complete Your Student Profile',
        message: `Your student profile is currently missing: ${missing.join(', ')}. Please navigate to your Profile Settings to complete all required fields so your registrations can be verified.`,
      })
      showNotification(`Profile alert sent to ${targetUser.name}!`)
    } catch (err: any) {
      alert(`Failed to send alert: ${err.message}`)
    }
  }

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase()
    const matchesSearch = !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.pnr && u.pnr.toLowerCase().includes(q)) ||
      (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q)) ||
      (u.branch && u.branch.toLowerCase().includes(q)) ||
      (u.classYear && u.classYear.toLowerCase().includes(q)) ||
      (u.division && u.division.toLowerCase().includes(q))
    const matchesDiv = userDivisionFilter === 'All' || u.division === userDivisionFilter
    const matchesBranch = userBranchFilter === 'All' || u.branch === userBranchFilter
    const matchesYear = userYearFilter === 'All' || u.classYear === userYearFilter
    const isInc = getMissingProfileFields(u).length > 0
    const matchesProfileStatus = userProfileStatusFilter === 'all'
      ? true
      : userProfileStatusFilter === 'incomplete'
        ? isInc
        : !isInc
    return matchesSearch && matchesDiv && matchesBranch && matchesYear && matchesProfileStatus
  })

  const getEventCount = (ev: EventData) => {
    const evId = (ev.id || '').toLowerCase()
    const evTitle = (ev.title || '').toLowerCase()
    return enrollments.filter(enr => {
      const enrId = (enr.eventId || '').toLowerCase()
      const enrTitle = (enr.eventTitle || '').toLowerCase()
      return enrId === evId || enrTitle === evTitle || enrId === evTitle
    }).length
  }

  const filteredEnrollments = enrollments.filter(enr => {
    const matchesEvent = (() => {
      if (enrollmentEventFilter === 'All') return true
      const targetLower = enrollmentEventFilter.toLowerCase()
      const selEvt = events.find(e => e.id.toLowerCase() === targetLower || e.title.toLowerCase() === targetLower)
      const enrId = (enr.eventId || '').toLowerCase()
      const enrTitle = (enr.eventTitle || '').toLowerCase()
      if (selEvt) {
        const selId = selEvt.id.toLowerCase()
        const selTitle = selEvt.title.toLowerCase()
        return enrId === selId || enrTitle === selTitle || enrId === selTitle
      }
      return enrId === targetLower || enrTitle === targetLower
    })()

    const q = enrollmentSearch.toLowerCase()
    const matchesSearch = !q || 
      enr.studentName.toLowerCase().includes(q) || 
      enr.studentEmail.toLowerCase().includes(q) || 
      (enr.pnr && enr.pnr.toLowerCase().includes(q)) || 
      (enr.phoneNumber && enr.phoneNumber.toLowerCase().includes(q)) ||
      (enr.branch && enr.branch.toLowerCase().includes(q)) || 
      enr.eventTitle.toLowerCase().includes(q) ||
      (enr.teamName && enr.teamName.toLowerCase().includes(q))
    return matchesEvent && matchesSearch
  })

  const isAdmin = user?.role === 'admin' || isOriginalAdminEmail(user?.email)

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)] pt-[calc(var(--nav-h)+2rem)] pb-24">
        <div className="max-w-md w-full p-8 sm:p-10 text-center rounded-3xl bg-white border border-red-200/90 shadow-xl">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-red-50 text-red-600 border border-red-200 shadow-sm">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          <span className="font-ui font-extrabold text-[11px] tracking-[0.2em] text-red-600 block uppercase mb-2">
            403 · RESTRICTED ACCESS
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 leading-tight">
            ADMIN CLEARANCE REQUIRED
          </h1>
          <p className="font-body text-xs sm:text-sm text-slate-600 mb-7 leading-relaxed">
            {user
              ? `Your account (${user.email}) does not have administrative privileges to access this console.`
              : 'This console is restricted to platform administrators only. Please sign in to proceed.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!user ? (
              <Link
                to="/auth"
                className="py-3.5 px-7 rounded-xl font-ui font-extrabold text-xs tracking-wider text-white uppercase bg-[var(--color-slate-blue)] hover:opacity-95 shadow-md no-underline transition-all active:scale-[0.99]"
              >
                SIGN IN AS ADMIN →
              </Link>
            ) : (
              <Link
                to="/"
                className="py-3.5 px-7 rounded-xl font-ui font-extrabold text-xs tracking-wider text-white uppercase bg-[var(--color-slate-blue)] hover:opacity-95 shadow-md no-underline transition-all active:scale-[0.99]"
              >
                RETURN TO PLATFORM →
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative text-slate-100" style={{ background: '#090d16', paddingTop: 'calc(var(--nav-h) + 2rem)', paddingBottom: '6rem' }}>
      <style>{`
        .card-glass {
          background: rgba(15, 23, 42, 0.85) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 1rem !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4) !important;
        }
        .text-gradient-primary {
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
      {/* Toast Notification */}
      {actionSuccessMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-6 py-4 flex items-center gap-3 font-ui font-semibold text-xs tracking-widest shadow-2xl"
          style={{
            background: 'rgba(16,185,129,0.15)',
            border: '1px solid #10B981',
            color: '#6ee7b7',
            backdropFilter: 'blur(12px)',
            animation: 'fadeInUp 0.3s ease',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {actionSuccessMessage.toUpperCase()}
        </div>
      )}

      <div className="page-container">
        {/* Breadcrumb & Quick Info */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <Link
            to="/"
            className="font-ui font-semibold text-xs tracking-widest text-slate-400 hover:text-white inline-flex items-center gap-2 no-underline"
          >
            ← BACK TO PLATFORM
          </Link>

          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 font-ui font-semibold text-xs tracking-widest inline-flex items-center gap-2 rounded-lg"
              style={{
                background: isConfigured ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${isConfigured ? '#10B981' : '#F59E0B'}`,
                color: isConfigured ? '#6ee7b7' : '#fcd34d',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: isConfigured ? '#10B981' : '#F59E0B' }} />
              {isConfigured ? 'SUPABASE BACKEND: CONNECTED' : 'LOCAL MOCK DATA MODE'}
            </span>

            {user && (
              <span className="font-ui text-xs text-slate-400 hidden sm:inline">
                OPERATOR: <strong className="text-white">{user.name}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Page Title & Action Bar */}
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <p className="font-ui font-semibold text-xs tracking-widest mb-2" style={{ color: '#38bdf8', letterSpacing: '0.25em' }}>
              ADMINISTRATION & OPERATIONS
            </p>
            <h1 className="font-display leading-none text-gradient-primary" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)' }}>
              ADMIN CONSOLE
            </h1>
          </div>

          <button
            onClick={handleCreateNewEvent}
            className="btn-primary px-8 py-4 text-sm font-bold tracking-widest flex items-center gap-3 shadow-lg shadow-indigo-500/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            CREATE NEW EVENT
          </button>
        </div>

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="card-glass p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-primary)' }} />
            <span className="font-ui font-semibold text-xs tracking-widest block text-gray-400 mb-1">TOTAL EVENTS</span>
            <div className="font-display text-4xl text-white">{stats.totalEvents}</div>
            <p className="font-ui text-xs text-gray-500 mt-2">
              <span className="text-cyan-400">{stats.activeEvents} Active</span> · {stats.pastEvents} Past
            </p>
          </div>

          <div className="card-glass p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />
            <span className="font-ui font-semibold text-xs tracking-widest block text-gray-400 mb-1">ACTIVE HACKATHONS</span>
            <div className="font-display text-4xl text-gradient-accent">{stats.activeEvents}</div>
            <p className="font-ui text-xs text-gray-500 mt-2">Live for registrations</p>
          </div>

          <div className="card-glass p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: '#818CF8' }} />
            <span className="font-ui font-semibold text-xs tracking-widest block text-gray-400 mb-1">REGISTERED STUDENTS</span>
            <div className="font-display text-4xl text-white">{stats.totalUsers}</div>
            <p className="font-ui text-xs text-gray-500 mt-2">Platform user accounts</p>
          </div>

          <div className="card-glass p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: '#EC4899' }} />
            <span className="font-ui font-semibold text-xs tracking-widest block text-gray-400 mb-1">TOTAL ENROLLMENTS</span>
            <div className="font-display text-4xl text-white">{enrollments.length}</div>
            <p className="font-ui text-xs text-gray-500 mt-2">Event passes issued</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b mb-8 flex-wrap" style={{ borderColor: 'rgba(99,102,241,0.25)' }}>
          {[
            { id: 'events', label: `EVENTS CATALOG (${events.length})` },
            { id: 'enrollments', label: `ENROLLMENTS / ROSTER (${enrollments.length})` },
            { id: 'users', label: `STUDENT DIRECTORY (${users.length})` },
            { id: 'system', label: 'DATABASE & SETTINGS' },
            { id: 'qrscanner', label: '📷 QR SCANNER' },
            ...(isOriginalAdminEmail(user?.email) ? [
              { id: 'chats', label: `💬 TEAM CHATS (${teamsWithChats.length})` },
              { id: 'analytics', label: `📊 ANALYTICS` },
            ] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'events' | 'enrollments' | 'users' | 'system' | 'qrscanner' | 'chats' | 'analytics')}
              className="py-4 px-6 font-ui font-semibold text-xs tracking-widest cursor-pointer transition-all relative flex items-center gap-2"
              style={{
                color: activeTab === tab.id
                  ? (tab.id === 'chats' ? '#f59e0b' : tab.id === 'qrscanner' ? '#34d399' : 'var(--color-accent)')
                  : 'var(--color-text-muted)',
                background: activeTab === tab.id
                  ? (tab.id === 'chats' ? 'rgba(245,158,11,0.06)' : tab.id === 'qrscanner' ? 'rgba(52,211,153,0.06)' : 'rgba(34,211,238,0.06)')
                  : 'transparent',
                border: 'none',
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: tab.id === 'chats' ? '#f59e0b' : tab.id === 'qrscanner' ? '#34d399' : 'var(--color-accent)' }} />
              )}
            </button>
          ))}
        </div>

        {/* TAB 1: EVENTS CATALOG */}
        {activeTab === 'events' && (
          <div>
            {/* Search & Filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
                <input
                  type="text"
                  placeholder="Search events by title or category..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 text-white font-ui text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                {(['all', 'active', 'past'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setEventFilter(mode)}
                    className="px-4 py-2 font-ui font-semibold text-xs tracking-widest cursor-pointer transition-colors"
                    style={{
                      background: eventFilter === mode ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${eventFilter === mode ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
                      color: eventFilter === mode ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center text-gray-400 font-ui tracking-widest text-sm">
                LOADING EVENTS...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="card-glass p-12 text-center text-gray-400 font-ui text-sm tracking-widest">
                NO EVENTS FOUND MATCHING YOUR SEARCH.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map((evt) => {
                  const enrCount = getEventCount(evt)
                  return (
                    <div
                      key={evt.id}
                      className="card-glass p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hover:border-indigo-500/40 transition-colors"
                    >
                      {/* Event summary info */}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <span
                            className="px-2.5 py-0.5 font-ui font-semibold text-xs tracking-widest"
                            style={{
                              background: evt.isPast ? 'rgba(248,113,113,0.1)' : 'rgba(34,211,238,0.1)',
                              border: `1px solid ${evt.isPast ? 'rgba(248,113,113,0.3)' : 'rgba(34,211,238,0.3)'}`,
                              color: evt.isPast ? '#fca5a5' : 'var(--color-accent)',
                            }}
                          >
                            {evt.isPast ? 'PAST ARCHIVE' : 'ACTIVE / UPCOMING'}
                          </span>
                          <span className="font-ui text-xs text-indigo-400 font-semibold">{evt.category}</span>
                          <span className="font-ui text-xs text-gray-500">·</span>
                          <span className="font-ui text-xs text-gray-400">{evt.date}</span>
                          <span className="font-ui text-xs text-gray-500">·</span>
                          <span className="font-ui text-xs text-gray-400">{evt.location}</span>
                        </div>

                        <Link
                          to={`/admin/events/${evt.id}/teams`}
                          className="font-display text-2xl text-white mb-2 no-underline hover:text-indigo-300 transition-colors block"
                        >
                          {evt.title}
                        </Link>
                        <p className="font-body text-xs text-gray-400 line-clamp-2 max-w-3xl mb-3">
                          {evt.shortDescription || evt.fullDescription}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs font-ui text-gray-400">
                          <span className="text-cyan-300 font-bold">👥 {enrCount} {enrCount === 1 ? 'Student Enrolled' : 'Students Enrolled'}</span>
                          <span>🎙 <strong>{evt.speakers?.length || 0}</strong> Speakers</span>
                          <span>📅 <strong>{evt.schedule?.length || 0}</strong> Days</span>
                          <span className="font-mono text-gray-500">ID: {evt.id}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-white/5">
                        <button
                          onClick={() => {
                            setEnrollmentEventFilter(evt.id)
                            setActiveTab('enrollments')
                          }}
                          className="px-4 py-2 font-ui font-semibold text-xs tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 cursor-pointer"
                        >
                          👥 VIEW ENROLLED ({enrCount})
                        </button>

                        <button
                          onClick={() => setSelectedEventForTeamsModal(evt)}
                          className="px-4 py-2 font-ui font-semibold text-xs tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer flex items-center gap-1.5"
                        >
                          🏆 TEAMS & WINNERS {evt.winners && evt.winners.length > 0 ? `(${evt.winners.length})` : ''}
                        </button>

                        <button
                          onClick={() => handleToggleFormation(evt)}
                          className="px-3.5 py-2 font-ui font-semibold text-xs tracking-wider cursor-pointer flex items-center gap-1.5 transition-all duration-200"
                          style={{
                            background: evt.teamFormationLive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: evt.teamFormationLive ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                            color: evt.teamFormationLive ? '#4ade80' : '#f87171',
                          }}
                          title="Toggle whether team formation is open or closed for this event"
                        >
                          {evt.teamFormationLive ? '🟢 FORMATION: LIVE' : '🔒 FORMATION: CLOSED'}
                        </button>

                        <button
                          onClick={() => fetchAndExportEventTeamsCSV(evt.id, evt.title, evt.winners || [])}
                          className="px-4 py-2 font-ui font-semibold text-xs tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                          title="Export all enrolled teams, members, and deliverable submissions to CSV"
                        >
                          📥 EXPORT TEAMS CSV
                        </button>

                        <Link
                          to={`/events/${evt.id}`}
                          className="px-4 py-2 font-ui font-semibold text-xs tracking-widest text-gray-300 hover:text-white no-underline border border-white/10 hover:border-white/25"
                        >
                          PUBLIC VIEW
                        </Link>

                        <button
                          onClick={() => handleTogglePastStatus(evt)}
                          className="px-4 py-2 font-ui font-semibold text-xs tracking-widest cursor-pointer text-gray-400 hover:text-gray-200 border border-white/10"
                          title="Toggle whether event is active or in past archive"
                        >
                          {evt.isPast ? 'SET ACTIVE' : 'SET PAST'}
                        </button>

                        <button
                          onClick={() => handleEditEvent(evt)}
                          className="btn-primary px-5 py-2 text-xs font-bold tracking-widest"
                        >
                          EDIT
                        </button>

                        <button
                          onClick={() => handleDeleteEvent(evt.id, evt.title)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 cursor-pointer"
                          title="Delete Event"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ENROLLMENTS & EVENT ROSTERS */}
        {activeTab === 'enrollments' && (
          <div>
            {/* Search & Event Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
                <input
                  type="text"
                  placeholder="Search enrolled students by name, PRN, email, branch, or team..."
                  value={enrollmentSearch}
                  onChange={(e) => setEnrollmentSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 text-white font-ui text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-ui text-xs text-gray-400">EVENT:</span>
                  <select
                    value={enrollmentEventFilter}
                    onChange={(e) => setEnrollmentEventFilter(e.target.value)}
                    className="px-3 py-2 bg-black/40 border border-white/10 text-white font-ui text-xs outline-none cursor-pointer"
                  >
                    <option value="All" style={{ background: '#111118', color: '#fff' }}>All Events ({enrollments.length})</option>
                    {events.map(ev => {
                      const count = getEventCount(ev)
                      return (
                        <option key={ev.id} value={ev.id} style={{ background: '#111118', color: '#fff' }}>
                          {ev.title} ({count})
                        </option>
                      )
                    })}
                  </select>
                </div>

                <button
                  onClick={() => setShowIncompleteAlertModal(true)}
                  className="px-4 py-2 font-ui font-bold text-xs tracking-wider cursor-pointer flex items-center gap-2 transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: '1px solid rgba(245,158,11,0.6)',
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
                  }}
                  title="Broadcast alert to all students with incomplete profiles"
                >
                  <span>📢</span>
                  <span>ALERT INCOMPLETE ({incompleteUsersCount})</span>
                </button>

                <button
                  onClick={handleExportEnrollmentsCSV}
                  className="px-4 py-2 font-ui font-semibold text-xs tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  EXPORT CSV ROSTER ({filteredEnrollments.length})
                </button>
              </div>
            </div>

            {/* Quick Event Switcher Pills Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-8 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <span className="font-ui text-[10px] font-bold tracking-widest text-gray-400 mr-2 uppercase">SWITCH EVENT:</span>
              <button
                onClick={() => setEnrollmentEventFilter('All')}
                className="px-3 py-1.5 font-ui font-semibold text-xs tracking-wider cursor-pointer transition-all rounded-lg"
                style={{
                  background: enrollmentEventFilter === 'All' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${enrollmentEventFilter === 'All' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
                  color: enrollmentEventFilter === 'All' ? '#fff' : 'var(--color-text-muted)',
                }}
              >
                ALL EVENTS ({enrollments.length})
              </button>

              {events.map((ev) => {
                const count = getEventCount(ev)
                const isSelected = enrollmentEventFilter === ev.id || enrollmentEventFilter === ev.title
                return (
                  <button
                    key={ev.id}
                    onClick={() => setEnrollmentEventFilter(ev.id)}
                    className="px-3.5 py-1.5 font-ui font-semibold text-xs tracking-wider cursor-pointer transition-all flex items-center gap-2 rounded-lg"
                    style={{
                      background: isSelected ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)'}`,
                      color: isSelected ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    <span>{ev.title}</span>
                    <span
                      className="px-2 py-0.5 text-[10px] rounded-full font-bold"
                      style={{
                        background: isSelected ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.1)',
                        color: isSelected ? '#22d3ee' : '#9ca3af',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {loading ? (
              <div className="py-20 text-center text-gray-400 font-ui tracking-widest text-sm">
                LOADING ENROLLMENTS...
              </div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="card-glass p-12 text-center text-gray-400 font-ui text-sm tracking-widest">
                NO ENROLLMENTS FOUND MATCHING YOUR FILTERS.
              </div>
            ) : (
              /* Group enrollments event-wise */
              (() => {
                const map = new Map<string, EventEnrollmentView[]>();
                const titleMap = new Map<string, string>();

                filteredEnrollments.forEach(enr => {
                  const key = enr.eventId || enr.eventTitle;
                  if (!map.has(key)) {
                    map.set(key, []);
                    titleMap.set(key, enr.eventTitle);
                  }
                  map.get(key)!.push(enr);
                });

                const groupedEvents: Array<{
                  eventId: string;
                  eventTitle: string;
                  enrollments: EventEnrollmentView[];
                }> = [];

                map.forEach((list, key) => {
                  groupedEvents.push({
                    eventId: key,
                    eventTitle: titleMap.get(key) || key,
                    enrollments: list,
                  });
                });

                return (
                  <div className="space-y-8">
                    {groupedEvents.map((group) => {
                      const eventObj = events.find(e => e.id === group.eventId || e.title === group.eventTitle);

                      return (
                        <div key={group.eventId} className="card-glass overflow-hidden border border-indigo-500/20">
                          {/* Event Wise Banner */}
                          <div className="p-5 bg-white/[0.03] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className="px-2.5 py-0.5 font-ui font-semibold text-[10px] tracking-widest text-indigo-300 bg-indigo-500/15 border border-indigo-500/30">
                                  EVENT ROSTER
                                </span>
                                <span className="font-ui text-xs text-cyan-300 font-bold">
                                  👥 {group.enrollments.length} {group.enrollments.length === 1 ? 'Student Enrolled' : 'Students Enrolled'}
                                </span>
                              </div>
                              <h3 className="font-display text-2xl text-white">{group.eventTitle}</h3>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => fetchAndExportEventTeamsCSV(group.eventId, group.eventTitle, eventObj?.winners || [])}
                                className="px-3.5 py-1.5 font-ui font-semibold text-xs tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                                title="Export teams and members CSV for this event"
                              >
                                📥 EXPORT TEAMS CSV
                              </button>

                              {eventObj && (
                                <Link
                                  to={`/admin/events/${eventObj.id}/teams`}
                                  className="px-3.5 py-1.5 font-ui font-semibold text-xs tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer no-underline flex items-center gap-1.5"
                                >
                                  🏆 TEAMS & SUBMISSIONS ↗
                                </Link>
                              )}
                            </div>
                          </div>

                          {/* Event Wise Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b bg-white/[0.015]" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                  <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">STUDENT PARTICIPANT</th>
                                  <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">PRN / STUDENT ID</th>
                                  <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">PHONE</th>
                                  <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">BRANCH & YEAR</th>
                                  <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">TEAM REGISTRATION</th>
                                  <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">ENROLLED DATE</th>
                                  <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400 text-right">PROFILE DETAILS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.04]">
                                {group.enrollments.map((enr) => (
                                  <tr key={enr.id} className="hover:bg-white/[0.015] transition-colors">
                                    <td className="p-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-display text-sm font-bold text-white bg-indigo-950 border border-indigo-500/40 flex-shrink-0">
                                          {enr.avatarUrl ? (
                                            <img src={enr.avatarUrl} alt={enr.studentName} className="w-full h-full object-cover" />
                                          ) : (
                                            <span>{enr.studentName.charAt(0).toUpperCase()}</span>
                                          )}
                                        </div>
                                        <div>
                                          <p className="font-ui font-semibold text-sm text-white">{enr.studentName}</p>
                                          <p className="font-ui text-xs text-gray-400">{enr.studentEmail}</p>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="p-4">
                                      <span className="font-mono text-xs px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold tracking-wider">
                                        {enr.pnr || 'NOT PROVIDED'}
                                      </span>
                                    </td>

                                    <td className="p-4">
                                      <span className="font-mono text-xs text-white">
                                        {enr.phoneNumber || 'N/A'}
                                      </span>
                                    </td>

                                    <td className="p-4">
                                      <p className="font-ui text-xs text-white font-semibold">{enr.branch ? getShortBranch(enr.branch) : 'Branch Unassigned'}</p>
                                      <p className="font-ui text-xs text-gray-400">{enr.classYear} {enr.division ? `· Div ${enr.division}` : ''}</p>
                                    </td>

                                    <td className="p-4">
                                      {enr.teamName ? (
                                        <span className="font-ui text-xs text-pink-300 bg-pink-500/10 border border-pink-500/30 px-2.5 py-1 font-semibold inline-block">
                                          Team: <strong>{enr.teamName}</strong>
                                        </span>
                                      ) : (
                                        <span className="font-ui text-xs text-gray-400 bg-white/5 px-2.5 py-1 inline-block">
                                          Individual Participant
                                        </span>
                                      )}
                                    </td>

                                    <td className="p-4">
                                      <span className="font-ui text-xs text-gray-400">
                                        {new Date(enr.enrolledAt).toLocaleDateString()} {new Date(enr.enrolledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </td>

                                    <td className="p-4 text-right">
                                      <button
                                        onClick={() => setSelectedEnrollmentForModal(enr)}
                                        className="px-3 py-1.5 font-ui font-semibold text-xs tracking-wider text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 cursor-pointer"
                                      >
                                        VIEW DETAILS ↗
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* TAB 3: STUDENT DIRECTORY */}
        {activeTab === 'users' && (
          <div>
            {/* ── Search Bar ── */}
            <div className="mb-5">
              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  id="student-search-input"
                  type="text"
                  autoFocus
                  placeholder="Search students by name, email, PRN, branch, year, division..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: 44,
                    paddingRight: userSearch ? 44 : 16,
                    paddingTop: 14,
                    paddingBottom: 14,
                    background: 'rgba(0,0,0,0.5)',
                    border: userSearch ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#ffffff',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 15,
                    outline: 'none',
                    boxShadow: userSearch ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
                    transition: 'all 0.2s',
                  }}
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 22,
                      height: 22,
                      cursor: 'pointer',
                      color: '#9ca3af',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Live result count */}
              <div className="flex items-center gap-3 mt-2.5 px-1">
                <span className="font-ui text-xs text-gray-500">
                  {userSearch || userBranchFilter !== 'All' || userDivisionFilter !== 'All' || userYearFilter !== 'All' ? (
                    <>
                      <span className="text-indigo-400 font-bold">{filteredUsers.length}</span> of {users.length} students match your filters
                    </>
                  ) : (
                    <><span className="text-white font-bold">{users.length}</span> registered students on platform</>
                  )}
                </span>
                {(userSearch || userBranchFilter !== 'All' || userDivisionFilter !== 'All' || userYearFilter !== 'All') && (
                  <button
                    onClick={() => { setUserSearch(''); setUserBranchFilter('All'); setUserDivisionFilter('All'); setUserYearFilter('All') }}
                    className="font-ui text-xs text-red-400 hover:text-red-300 cursor-pointer underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>

            {/* ── Filter Pills Row ── */}
            <div className="flex flex-wrap gap-3 mb-6">
              {/* Branch Filter */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="font-ui text-[10px] font-bold tracking-widest text-gray-500 mr-1">BRANCH:</span>
                {branches.slice(0, 6).map((b) => (
                  <button
                    key={b}
                    onClick={() => setUserBranchFilter(b ?? 'All')}
                  >
                    {b === 'All' ? `All Branches (${users.length})` : b}
                  </button>
                ))}
              </div>

              {/* Year Filter */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="font-ui text-[10px] font-bold tracking-widest text-gray-500 mr-1">YEAR:</span>
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => setUserYearFilter(y)}
                    className="px-2.5 py-1 font-ui font-semibold text-xs tracking-wide cursor-pointer transition-all rounded-lg"
                    style={{
                      background: userYearFilter === y ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${userYearFilter === y ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)'}`,
                      color: userYearFilter === y ? '#22d3ee' : '#6b7280',
                    }}
                  >
                    {y === 'All' ? 'All Years' : y}
                  </button>
                ))}
              </div>

              {/* Division Filter */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="font-ui text-[10px] font-bold tracking-widest text-gray-500 mr-1">DIV:</span>
                {divisions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setUserDivisionFilter(d)}
                    className="px-2.5 py-1 font-ui font-semibold text-xs tracking-wide cursor-pointer transition-all rounded-lg"
                    style={{
                      background: userDivisionFilter === d ? 'rgba(244,114,182,0.25)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${userDivisionFilter === d ? '#ec4899' : 'rgba(255,255,255,0.08)'}`,
                      color: userDivisionFilter === d ? '#f9a8d4' : '#6b7280',
                    }}
                  >
                    {d === 'All' ? 'All Divs' : `Div ${d}`}
                  </button>
                ))}
              </div>

              {/* Profile Status Filter */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="font-ui text-[10px] font-bold tracking-widest text-gray-500 mr-1">PROFILE:</span>
                <button
                  onClick={() => setUserProfileStatusFilter('all')}
                  className="px-2.5 py-1 font-ui font-semibold text-xs tracking-wide cursor-pointer transition-all rounded-lg"
                  style={{
                    background: userProfileStatusFilter === 'all' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${userProfileStatusFilter === 'all' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: userProfileStatusFilter === 'all' ? '#ffffff' : '#6b7280',
                  }}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setUserProfileStatusFilter('incomplete')}
                  className="px-2.5 py-1 font-ui font-semibold text-xs tracking-wide cursor-pointer transition-all rounded-lg flex items-center gap-1.5"
                  style={{
                    background: userProfileStatusFilter === 'incomplete' ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.05)',
                    border: `1px solid ${userProfileStatusFilter === 'incomplete' ? '#f59e0b' : 'rgba(245,158,11,0.2)'}`,
                    color: userProfileStatusFilter === 'incomplete' ? '#fbbf24' : '#d97706',
                  }}
                >
                  <span>⚠️ Incomplete</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300 font-bold">{incompleteUsersCount}</span>
                </button>
                <button
                  onClick={() => setUserProfileStatusFilter('complete')}
                  className="px-2.5 py-1 font-ui font-semibold text-xs tracking-wide cursor-pointer transition-all rounded-lg"
                  style={{
                    background: userProfileStatusFilter === 'complete' ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${userProfileStatusFilter === 'complete' ? '#22c55e' : 'rgba(255,255,255,0.08)'}`,
                    color: userProfileStatusFilter === 'complete' ? '#4ade80' : '#6b7280',
                  }}
                >
                  ✓ Complete ({users.length - incompleteUsersCount})
                </button>
              </div>

              {/* Alert Incomplete Profiles Broadcast Button */}
              <button
                onClick={() => setShowIncompleteAlertModal(true)}
                className="ml-auto px-4 py-2 font-ui font-bold text-xs tracking-wider cursor-pointer flex items-center gap-2 transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: '1px solid rgba(245,158,11,0.6)',
                  color: '#ffffff',
                  borderRadius: 10,
                  boxShadow: '0 4px 15px rgba(245,158,11,0.25)',
                }}
                title="Send automated in-app alert to all participants with incomplete details"
              >
                <span>📢</span>
                <span>ALERT INCOMPLETE PROFILES ({incompleteUsersCount})</span>
              </button>
            </div>

            {loading ? (
              <div className="py-20 text-center text-gray-400 font-ui tracking-widest text-sm">
                LOADING STUDENTS...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="card-glass p-12 text-center text-gray-400 font-ui text-sm tracking-widest">
                NO USERS FOUND MATCHING YOUR CRITERIA.
              </div>
            ) : (
              <div className="card-glass overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-white/[0.02]" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">STUDENT / OPERATOR</th>
                        <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">PRN</th>
                        <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">PHONE</th>
                        <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">ACADEMICS</th>
                        <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">PASSES</th>
                        <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400">ROLE</th>
                        {isOriginalAdminEmail(user?.email) && (
                          <th className="p-4 font-ui font-semibold text-xs tracking-widest text-amber-400">🔑 PASSWORD</th>
                        )}
                        <th className="p-4 font-ui font-semibold text-xs tracking-widest text-gray-400 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-white/[0.015] transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-display text-sm font-bold text-white bg-indigo-950 border border-indigo-500/40 flex-shrink-0">
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{u.name.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-ui font-semibold text-sm text-white tracking-wide">{u.name}</p>
                                <p className="font-ui text-xs text-gray-400">{u.email}</p>
                                {getMissingProfileFields(u).length > 0 && (
                                  <span className="inline-flex items-center gap-1 mt-1 font-ui text-[10px] text-amber-300 font-bold bg-amber-500/15 border border-amber-500/35 px-1.5 py-0.5 rounded">
                                    <span>⚠️</span> Missing: {getMissingProfileFields(u).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <span className="font-mono text-xs px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                              {u.pnr || 'NOT SET'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="font-mono text-xs text-white">
                              {u.phoneNumber || 'N/A'}
                            </span>
                          </td>

                          <td className="p-4">
                            <p className="font-ui text-xs text-white font-semibold">{u.branch || 'Branch Unassigned'}</p>
                            <p className="font-ui text-xs text-gray-400">
                              {u.classYear} {u.division ? `· Div ${u.division}` : ''}
                            </p>
                          </td>

                          <td className="p-4">
                            <button
                              onClick={() => setSelectedUserForTickets(u)}
                              className="px-3 py-1 font-ui font-semibold text-xs tracking-wider inline-flex items-center gap-1.5 cursor-pointer hover:bg-cyan-500/20 transition-colors"
                              style={{
                                background: u.ticketsCount > 0 ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${u.ticketsCount > 0 ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                color: u.ticketsCount > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)',
                              }}
                            >
                              🎟 {u.ticketsCount} {u.ticketsCount === 1 ? 'PASS' : 'PASSES'}
                            </button>
                          </td>

                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className="px-2.5 py-0.5 font-ui font-semibold text-xs tracking-widest inline-block"
                                style={{
                                  background: u.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${u.role === 'admin' ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)'}`,
                                  color: u.role === 'admin' ? '#a5b4fc' : '#9ca3af',
                                }}
                              >
                                {u.role.toUpperCase()}
                              </span>
                              {u.scannerAccess && u.role !== 'admin' && (
                                <span
                                  className="px-2 py-0.5 font-ui font-semibold text-[10px] tracking-wider inline-flex items-center gap-1 rounded"
                                  style={{
                                    background: 'rgba(52,211,153,0.12)',
                                    border: '1px solid rgba(52,211,153,0.35)',
                                    color: '#34d399',
                                  }}
                                >
                                  📷 SCANNER ACCESS
                                </span>
                              )}
                            </div>
                          </td>

                          {isOriginalAdminEmail(user?.email) && (
                            <td className="p-4">
                              {u.passwordPlain ? (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="font-mono text-xs px-2.5 py-1 border font-bold tracking-wider select-all"
                                    style={{
                                      background: showPasswords[u.id] ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                                      border: '1px solid rgba(245,158,11,0.3)',
                                      color: showPasswords[u.id] ? '#fbbf24' : 'transparent',
                                      textShadow: showPasswords[u.id] ? 'none' : '0 0 8px rgba(251,191,36,0.8)',
                                      filter: showPasswords[u.id] ? 'none' : 'blur(4px)',
                                      userSelect: showPasswords[u.id] ? 'all' : 'none',
                                      minWidth: 80,
                                      transition: 'all 0.2s',
                                    }}
                                  >
                                    {showPasswords[u.id] ? u.passwordPlain : '••••••••'}
                                  </span>
                                  <button
                                    onClick={() => setShowPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                    title={showPasswords[u.id] ? 'Hide password' : 'Reveal password'}
                                    style={{
                                      background: 'rgba(245,158,11,0.1)',
                                      border: '1px solid rgba(245,158,11,0.25)',
                                      borderRadius: 6,
                                      padding: '4px 8px',
                                      cursor: 'pointer',
                                      color: '#f59e0b',
                                      fontSize: 13,
                                      lineHeight: 1,
                                      transition: 'all 0.15s',
                                    }}
                                  >
                                    {showPasswords[u.id] ? '🙈' : '👁'}
                                  </button>
                                </div>
                              ) : (
                                <span className="font-ui text-xs text-gray-600 italic">Not captured</span>
                              )}
                            </td>
                          )}

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {getMissingProfileFields(u).length > 0 && (
                                <button
                                  onClick={() => handleSendIndividualAlert(u)}
                                  className="px-2.5 py-1 font-ui text-xs font-bold tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer flex items-center gap-1 rounded"
                                  title="Send profile completion reminder to this student"
                                >
                                  <span>🔔</span> Alert
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleScannerAccess(u)}
                                className="px-3 py-1 font-ui text-xs tracking-wider cursor-pointer rounded"
                                style={{
                                  background: u.scannerAccess ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
                                  border: u.scannerAccess ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(255,255,255,0.1)',
                                  color: u.scannerAccess ? '#34d399' : '#9ca3af',
                                }}
                                title={u.scannerAccess ? 'Revoke QR scanner access' : 'Grant QR scanner access (no admin privileges)'}
                              >
                                {u.scannerAccess ? '📷 Revoke Scanner' : '📷 Grant Scanner'}
                              </button>
                              <button
                                onClick={() => handleToggleUserRole(u)}
                                className="px-3 py-1 font-ui text-xs tracking-wider text-gray-400 hover:text-white border border-white/10 hover:border-white/30 cursor-pointer rounded"
                              >
                                {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 cursor-pointer rounded"
                                title={`Delete user ${u.name}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SYSTEM & DATABASE */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="card-glass p-8">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <span className="font-ui text-[10px] tracking-widest text-amber-400 font-bold block mb-1">DATABASE & SETTINGS</span>
                  <h2 className="font-display text-2xl text-white">DATABASE CONFIGURATION & HEALTH</h2>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Ecell is connected to Supabase for its relational PostgreSQL tables, authentication, and file storage.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-black/40 border border-white/10">
                  <span className="font-ui text-xs text-gray-500 block mb-1">SUPABASE STATUS</span>
                  <span className="font-ui font-bold text-sm" style={{ color: isConfigured ? '#10B981' : '#F59E0B' }}>
                    {isConfigured ? '✓ ACTIVE & CONNECTED' : '⚠ LOCAL FALLBACK MODE'}
                  </span>
                </div>

                <div className="p-4 bg-black/40 border border-white/10">
                  <span className="font-ui text-xs text-gray-500 block mb-1">ENVIRONMENT FILE</span>
                  <span className="font-mono text-xs text-white">.env / .env.local</span>
                </div>
              </div>

              <div className="p-5 border border-indigo-500/20 bg-indigo-500/5">
                <h3 className="font-ui font-bold text-sm text-indigo-300 tracking-wider mb-2">HOW TO UPDATE DATABASE SCHEMA</h3>
                <p className="font-ui text-xs text-gray-400 leading-relaxed mb-4">
                  The SQL schema is located in <code className="text-cyan-400">supabase/schema.sql</code>. It includes all table definitions, security policies (RLS), auto-provision triggers, and storage buckets.
                </p>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary px-6 py-2 text-xs font-bold tracking-widest no-underline inline-block"
                >
                  OPEN SUPABASE DASHBOARD ↗
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TEAM CHATS (Original Admin Only) */}
        {activeTab === 'chats' && isOriginalAdminEmail(user?.email) && (
          <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <p className="font-ui text-[10px] tracking-widest text-amber-400 font-bold mb-1">ADMIN SURVEILLANCE</p>
                <h2 className="font-display text-2xl text-white">TEAM CHAT MONITOR</h2>
                <p className="font-ui text-xs text-gray-400 mt-1">
                  View all team conversations across every event. Read-only — you cannot send messages.
                </p>
              </div>
              <button
                onClick={async () => {
                  const allTeams = await adminService.getAllTeamsWithChats()
                  setTeamsWithChats(allTeams)
                }}
                className="px-4 py-2 font-ui font-semibold text-xs tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer flex items-center gap-2"
              >
                🔄 REFRESH TEAMS
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search teams by name or event..."
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: 44,
                  paddingRight: 16,
                  paddingTop: 12,
                  paddingBottom: 12,
                  background: 'rgba(0,0,0,0.5)',
                  border: chatSearch ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  color: '#ffffff',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 14,
                  outline: 'none',
                  boxShadow: chatSearch ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
                  transition: 'all 0.2s',
                }}
              />
            </div>

            {/* Team Grid */}
            {teamsWithChats.length === 0 ? (
              <div className="card-glass p-16 text-center">
                <div className="text-4xl mb-4">💬</div>
                <p className="font-ui text-sm text-gray-400 tracking-widest">
                  {isSupabaseConfigured() ? 'NO TEAMS FOUND ON THIS PLATFORM YET.' : 'SUPABASE NOT CONNECTED — TEAM DATA UNAVAILABLE.'}
                </p>
              </div>
            ) : (
              (() => {
                const filtered = teamsWithChats.filter(({ team }) => {
                  const q = chatSearch.toLowerCase()
                  return !q || team.name.toLowerCase().includes(q) || team.eventId.toLowerCase().includes(q)
                })

                const eventNames = events.reduce<Record<string, string>>((acc, e) => {
                  acc[e.id] = e.title
                  return acc
                }, {})

                return (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(({ team, members }) => (
                      <div
                        key={team.id}
                        className="card-glass p-5 border border-amber-500/15 hover:border-amber-500/40 transition-all group cursor-pointer"
                        onClick={() => setAdminChatTeam({ team, members })}
                        style={{ background: 'rgba(0,0,0,0.35)' }}
                      >
                        {/* Team Name */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-display text-lg text-white group-hover:text-amber-300 transition-colors">{team.name}</p>
                            <p className="font-ui text-xs text-gray-500 mt-0.5">
                              {eventNames[team.eventId] || team.eventId || 'Unknown Event'}
                            </p>
                          </div>
                          <span
                            className="px-2 py-0.5 font-ui font-bold text-[10px] tracking-widest"
                            style={{
                              background: 'rgba(245,158,11,0.1)',
                              border: '1px solid rgba(245,158,11,0.3)',
                              color: '#f59e0b',
                            }}
                          >
                            {members.length} MEMBER{members.length !== 1 ? 'S' : ''}
                          </span>
                        </div>

                        {/* Member Avatars */}
                        <div className="flex items-center gap-1 mb-4">
                          {members.slice(0, 5).map((m, idx) => (
                            <div
                              key={m.id}
                              title={m.userName || 'Member'}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: m.userId === team.createdBy
                                  ? 'linear-gradient(135deg,#059669,#10b981)'
                                  : 'linear-gradient(135deg,#6366f1,#06b6d4)',
                                border: '2px solid rgba(0,0,0,0.5)',
                                marginLeft: idx > 0 ? -6 : 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#fff',
                                flexShrink: 0,
                              }}
                            >
                              {(m.userName?.charAt(0) || '?').toUpperCase()}
                            </div>
                          ))}
                          {members.length > 5 && (
                            <span className="font-ui text-xs text-gray-500 ml-2">+{members.length - 5} more</span>
                          )}
                        </div>

                        {/* Open Chat & Delete Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setAdminChatTeam({ team, members }) }}
                            className="flex-1 py-2 font-ui font-semibold text-xs tracking-widest cursor-pointer transition-all flex items-center justify-center gap-2"
                            style={{
                              background: 'rgba(245,158,11,0.1)',
                              border: '1px solid rgba(245,158,11,0.3)',
                              color: '#f59e0b',
                              borderRadius: 8,
                            }}
                          >
                            👁 VIEW CHAT
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id, team.name) }}
                            className="px-3 py-2 font-ui font-semibold text-xs tracking-widest cursor-pointer transition-all flex items-center justify-center gap-1.5"
                            style={{
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              color: '#f87171',
                              borderRadius: 8,
                            }}
                            title={`Delete team ${team.name}`}
                          >
                            🗑 DELETE
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()
            )}
          </div>
        )}

        {/* TAB 6: ANALYTICS (Original Admin Only) */}
        {activeTab === 'analytics' && isOriginalAdminEmail(user?.email) && (
          <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <p className="font-ui text-[10px] tracking-widest font-bold mb-1" style={{ color: 'var(--color-primary)' }}>
                  PLATFORM INTELLIGENCE
                </p>
                <h2 className="font-display text-2xl text-white">USER ANALYTICS</h2>
                <p className="font-ui text-xs text-gray-400 mt-1">
                  Real session data — time on site, page visits, activity, and more.
                </p>
              </div>
              <button
                onClick={async () => {
                  setAnalyticsLoading(true)
                  const data = await analyticsService.getAllUsersAnalytics()
                  setUserAnalytics(data)
                  setAnalyticsLoading(false)
                }}
                className="px-4 py-2 font-ui font-semibold text-xs tracking-widest cursor-pointer flex items-center gap-2"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
              >
                🔄 REFRESH DATA
              </button>
            </div>

            {/* Platform KPI Row */}
            {(() => {
              const totalTime = userAnalytics.reduce((s, u) => s + u.totalTimeSeconds, 0)
              const todayTotalTime = userAnalytics.reduce((s, u) => s + u.todaySeconds, 0)
              const totalSessions = userAnalytics.reduce((s, u) => s + u.totalSessions, 0)
              const activeUsers = userAnalytics.filter(u => u.totalSessions > 0).length
              const todayActiveUsers = userAnalytics.filter(u => u.todaySeconds > 0).length
              const totalMsgs = userAnalytics.reduce((s, u) => s + u.messagesSent, 0)
              const platformDaily = getPlatformDailyBreakdown(userAnalytics)
              const maxDailySec = Math.max(...platformDaily.map(d => d.totalSeconds), 1)

              return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: "TODAY'S TIME ON SITE", value: formatDuration(todayTotalTime), color: '#38bdf8', sub: `${todayActiveUsers} active today` },
                      { label: 'TOTAL TIME (ALL-TIME)', value: formatDuration(totalTime), color: '#6366f1', sub: 'across all students' },
                      { label: 'TOTAL SESSIONS', value: totalSessions.toString(), color: '#22d3ee', sub: `${activeUsers} total active accounts` },
                      { label: 'CHAT MESSAGES', value: totalMsgs.toString(), color: '#34d399', sub: 'in all team channels' },
                    ].map(card => (
                      <div key={card.label} className="card-glass p-5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: card.color }} />
                        <span className="font-ui text-[10px] font-semibold tracking-widest text-gray-400 block mb-1">{card.label}</span>
                        <div className="font-display text-3xl text-white">{analyticsLoading ? '…' : card.value}</div>
                        <p className="font-ui text-xs text-gray-500 mt-1">{card.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Platform-wide Daily Activity Trend */}
                  {platformDaily.length > 0 && (
                    <div className="card-glass p-5 mb-8 border border-cyan-500/20">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <p className="font-ui text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                            EVERYDAY PLATFORM ENGAGEMENT (LAST {platformDaily.length} DAYS)
                          </p>
                          <p className="font-ui text-xs text-gray-400">
                            Total daily time spent on the platform by all students combined
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-ui">
                          <span className="text-gray-400">Today: <strong className="text-cyan-400">{formatDuration(todayTotalTime)}</strong></span>
                          <span className="text-gray-400">Active Students: <strong className="text-indigo-400">{todayActiveUsers}</strong></span>
                        </div>
                      </div>

                      {/* Daily bar chart */}
                      <div className="flex items-end gap-2 h-28 pt-4 pb-2 px-2 bg-black/30 rounded-lg border border-white/5">
                        {platformDaily.map(d => {
                          const pct = d.totalSeconds / maxDailySec
                          const barH = Math.max(6, Math.round(pct * 80))
                          return (
                            <div
                              key={d.date}
                              className="flex-1 flex flex-col items-center gap-1.5 min-w-0 group relative cursor-pointer"
                              title={`${d.label}: ${formatDuration(d.totalSeconds)} across ${d.activeUsersCount} student(s) (${d.sessionCount} sessions)`}
                            >
                              <div
                                style={{ height: barH }}
                                className="w-full rounded-t transition-all group-hover:brightness-125 bg-gradient-to-t from-indigo-600/70 via-cyan-500/80 to-cyan-300"
                              />
                              <span className="font-ui text-[9px] text-gray-500 truncate w-full text-center group-hover:text-cyan-300">
                                {d.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            {/* Search + Sort */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="relative flex-1 min-w-60">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search student by name or email..."
                  value={analyticsSearch}
                  onChange={e => setAnalyticsSearch(e.target.value)}
                  style={{
                    width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                    background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none', borderRadius: 8,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-ui text-[10px] tracking-widest text-gray-500">SORT BY:</span>
                {([
                  { id: 'today', label: "TODAY'S TIME" },
                  { id: 'time', label: 'TOTAL TIME' },
                  { id: 'dailyAvg', label: 'DAILY AVG' },
                  { id: 'sessions', label: 'SESSIONS' },
                  { id: 'lastSeen', label: 'LAST SEEN' },
                  { id: 'messages', label: 'MESSAGES' },
                  { id: 'events', label: 'EVENTS' },
                ] as const).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setAnalyticsSort(s.id as any)}
                    className="px-3 py-1.5 font-ui font-semibold text-[10px] tracking-widest cursor-pointer"
                    style={{
                      background: analyticsSort === s.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${analyticsSort === s.id ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: analyticsSort === s.id ? '#818cf8' : '#6b7280',
                      borderRadius: 6,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            {analyticsLoading ? (
              <div className="card-glass p-16 text-center">
                <div className="flex items-center justify-center gap-3 text-indigo-400">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                  <span className="font-ui text-sm tracking-widest">LOADING ANALYTICS DATA…</span>
                </div>
              </div>
            ) : userAnalytics.length === 0 ? (
              <div className="card-glass p-16 text-center">
                <div className="text-4xl mb-4">📊</div>
                <p className="font-ui text-sm text-gray-400 tracking-widest">
                  {isSupabaseConfigured() ? 'NO SESSION DATA YET — USERS NEED TO LOG IN TO GENERATE ANALYTICS.' : 'SUPABASE NOT CONNECTED.'}
                </p>
              </div>
            ) : (
              (() => {
                const q = analyticsSearch.toLowerCase()
                const filtered = userAnalytics
                  .filter(u => !q || u.userName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                  .sort((a, b) => {
                    if (analyticsSort === 'today') return b.todaySeconds - a.todaySeconds
                    if (analyticsSort === 'time') return b.totalTimeSeconds - a.totalTimeSeconds
                    if (analyticsSort === 'dailyAvg') return b.avgDailySeconds - a.avgDailySeconds
                    if (analyticsSort === 'sessions') return b.totalSessions - a.totalSessions
                    if (analyticsSort === 'lastSeen') return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
                    if (analyticsSort === 'messages') return b.messagesSent - a.messagesSent
                    return b.ticketsCount - a.ticketsCount
                  })

                const colStyle: React.CSSProperties = {
                  padding: '14px 16px',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  verticalAlign: 'middle',
                }

                return (
                  <div className="card-glass overflow-hidden">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            {['STUDENT', "TODAY'S TIME", 'TOTAL TIME', 'DAILY AVG', 'ACTIVE DAYS', 'SESSIONS', 'LAST SEEN', 'PAGES', 'EVENTS', 'MSGS', ''].map(h => (
                              <th key={h} style={{ padding: '12px 16px', fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#6b7280', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(u => (
                            <tr
                              key={u.userId}
                              style={{ transition: 'background 0.15s', cursor: 'pointer' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              onClick={() => setSelectedAnalyticsUser(u)}
                            >
                              {/* User */}
                              <td style={colStyle}>
                                <div className="flex items-center gap-3">
                                  <div
                                    style={{
                                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                      background: 'linear-gradient(135deg,#6366f1,#06b6d4)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 13, fontWeight: 700, color: '#fff',
                                      fontFamily: 'var(--font-display)',
                                    }}
                                  >
                                    {u.userName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-ui text-sm text-white font-semibold">{u.userName}</p>
                                    <p className="font-ui text-xs text-gray-500">{u.email}</p>
                                  </div>
                                </div>
                              </td>
                              {/* Today's time */}
                              <td style={colStyle}>
                                <span style={{ color: u.todaySeconds > 0 ? '#38bdf8' : '#4b5563', fontWeight: 700 }}>
                                  {formatDuration(u.todaySeconds)}
                                </span>
                              </td>
                              {/* Total time on site */}
                              <td style={colStyle}>
                                <span style={{ color: u.totalTimeSeconds > 0 ? '#818cf8' : '#4b5563', fontWeight: 600 }}>
                                  {formatDuration(u.totalTimeSeconds)}
                                </span>
                              </td>
                              {/* Daily Avg */}
                              <td style={{ ...colStyle, color: u.avgDailySeconds > 0 ? '#a78bfa' : '#4b5563', fontWeight: 600 }}>
                                {formatDuration(u.avgDailySeconds)}
                              </td>
                              {/* Active Days */}
                              <td style={{ ...colStyle, color: '#9ca3af' }}>
                                {u.activeDaysCount} {u.activeDaysCount === 1 ? 'day' : 'days'}
                              </td>
                              {/* Sessions */}
                              <td style={colStyle}>
                                <span
                                  className="px-2 py-0.5 font-ui font-bold text-[10px] tracking-widest"
                                  style={{
                                    background: u.totalSessions > 0 ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${u.totalSessions > 0 ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                    color: u.totalSessions > 0 ? '#22d3ee' : '#4b5563',
                                    borderRadius: 4,
                                  }}
                                >
                                  {u.totalSessions}
                                </span>
                              </td>
                              {/* Last seen */}
                              <td style={colStyle}>
                                <span style={{ color: '#34d399', fontSize: 11 }}>{formatRelativeTime(u.lastSeen)}</span>
                              </td>
                              {/* Pages */}
                              <td style={colStyle}>
                                <div className="flex flex-wrap gap-1 max-w-36">
                                  {u.pagesVisited.slice(0, 2).map(pg => (
                                    <span key={pg} style={{ padding: '1px 6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, fontSize: 10, color: '#9ca3af', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>
                                      {pg}
                                    </span>
                                  ))}
                                  {u.pagesVisited.length > 2 && <span style={{ fontSize: 10, color: '#6b7280' }}>+{u.pagesVisited.length - 2}</span>}
                                </div>
                              </td>
                              {/* Events */}
                              <td style={{ ...colStyle, color: '#f59e0b', fontWeight: 600 }}>{u.ticketsCount}</td>
                              {/* Messages */}
                              <td style={{ ...colStyle, color: '#34d399', fontWeight: 600 }}>{u.messagesSent}</td>
                              {/* Detail */}
                              <td style={colStyle}>
                                <button
                                  onClick={e => { e.stopPropagation(); setSelectedAnalyticsUser(u) }}
                                  style={{ padding: '4px 10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: 5, whiteSpace: 'nowrap' }}
                                >
                                  VIEW REPORT →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filtered.length === 0 && (
                      <p className="text-center py-10 font-ui text-xs text-gray-500 tracking-widest">NO USERS MATCH YOUR SEARCH.</p>
                    )}
                  </div>
                )
              })()
            )}
          </div>
        )}
      </div>

      {/* User Analytics Detail Modal */}
      {selectedAnalyticsUser && (
        <div
          onClick={() => setSelectedAnalyticsUser(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(5,5,15,0.92)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'pointer' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', borderRadius: 20, background: 'linear-gradient(145deg,#0a0a18,#0f0f22)', border: '1px solid rgba(99,102,241,0.35)', boxShadow: '0 30px 100px rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'default' }}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                  {selectedAnalyticsUser.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.18em', color: '#818cf8', fontWeight: 700, marginBottom: 2 }}>STUDENT ACTIVITY & TIME REPORT</p>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#fff', margin: 0 }}>{selectedAnalyticsUser.userName}</h3>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#6b7280', margin: 0 }}>{selectedAnalyticsUser.email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAnalyticsUser(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✕</button>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: "TODAY'S TIME", value: formatDuration(selectedAnalyticsUser.todaySeconds), color: '#38bdf8' },
                { label: 'TOTAL TIME', value: formatDuration(selectedAnalyticsUser.totalTimeSeconds), color: '#6366f1' },
                { label: 'DAILY AVG', value: formatDuration(selectedAnalyticsUser.avgDailySeconds), color: '#a78bfa' },
                { label: 'ACTIVE DAYS', value: `${selectedAnalyticsUser.activeDaysCount}d`, color: '#22d3ee' },
                { label: 'SESSIONS', value: selectedAnalyticsUser.totalSessions.toString(), color: '#f59e0b' },
                { label: 'MESSAGES', value: selectedAnalyticsUser.messagesSent.toString(), color: '#34d399' },
              ].map(c => (
                <div key={c.label} style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 8, letterSpacing: '0.12em', color: '#6b7280', fontWeight: 700, display: 'block', marginBottom: 4 }}>{c.label}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: c.color, display: 'block' }}>{c.value}</span>
                </div>
              ))}
            </div>

            {/* Pages & meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.14em', color: '#6b7280', fontWeight: 700, marginBottom: 6 }}>PAGES VISITED</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedAnalyticsUser.pagesVisited.length === 0
                    ? <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#4b5563' }}>No page data yet</span>
                    : selectedAnalyticsUser.pagesVisited.map(pg => (
                        <span key={pg} style={{ padding: '2px 8px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 4, fontFamily: 'var(--font-ui)', fontSize: 11, color: '#818cf8' }}>{pg}</span>
                      ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#6b7280' }}>First seen</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#9ca3af' }}>{new Date(selectedAnalyticsUser.firstSeen).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#6b7280' }}>Last seen</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#34d399' }}>{formatRelativeTime(selectedAnalyticsUser.lastSeen)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#6b7280' }}>Avg per session</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#818cf8' }}>{formatDuration(selectedAnalyticsUser.avgSessionSeconds)}</span>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Daily time breakdown */}
              {(() => {
                const daily = getDailyBreakdown(selectedAnalyticsUser.sessions)
                if (daily.length === 0) return (
                  <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.18em', color: '#6b7280', fontWeight: 700, marginBottom: 8 }}>DAILY TIME BREAKDOWN</p>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#4b5563' }}>No daily data yet — will appear as sessions accumulate.</p>
                  </div>
                )
                const maxSec = Math.max(...daily.map(d => d.totalSeconds), 1)
                return (
                  <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.18)', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.18em', color: '#818cf8', fontWeight: 700, margin: 0 }}>DAILY TIME ON SITE</p>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: '#6b7280' }}>last {daily.length} day{daily.length !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Bar chart */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                      {daily.map(d => {
                        const pct = d.totalSeconds / maxSec
                        const barH = Math.max(4, Math.round(pct * 72))
                        return (
                          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }} title={`${d.label}: ${formatDuration(d.totalSeconds)} (${d.sessionCount} session${d.sessionCount !== 1 ? 's' : ''})`}>
                            <div style={{ width: '100%', height: barH, borderRadius: '4px 4px 2px 2px', background: `linear-gradient(to top, rgba(99,102,241,${0.4 + pct * 0.6}), rgba(34,211,238,${0.3 + pct * 0.4}))`, boxShadow: pct > 0.5 ? '0 0 8px rgba(99,102,241,0.4)' : 'none', transition: 'all 0.2s', marginTop: 'auto' }} />
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, color: '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>{d.label}</span>
                          </div>
                        )
                      })}
                    </div>
                    {/* Daily table */}
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[...daily].reverse().slice(0, 7).map(d => (
                        <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#6b7280', minWidth: 60 }}>{d.label}</span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div style={{ width: `${(d.totalSeconds / maxSec) * 100}%`, height: '100%', background: 'linear-gradient(to right,#6366f1,#22d3ee)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#818cf8', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{formatDuration(d.totalSeconds)}</span>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: '#4b5563', minWidth: 30, textAlign: 'right' }}>{d.sessionCount}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Per-session list */}
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.18em', color: '#6b7280', fontWeight: 700, marginBottom: 10 }}>SESSION HISTORY ({selectedAnalyticsUser.sessions.length})</p>
                {selectedAnalyticsUser.sessions.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '24px 0' }}>No session data recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedAnalyticsUser.sessions.map((s, idx) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#818cf8', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-display)' }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#9ca3af' }}>
                              {new Date(s.startedAt).toLocaleString()}
                            </span>
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: s.durationSeconds > 0 ? '#818cf8' : '#4b5563' }}>
                              {formatDuration(s.durationSeconds)}
                            </span>
                          </div>
                          {s.pagesVisited.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {s.pagesVisited.map((pg, i) => (
                                <span key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 3 }}>{pg}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* TAB: QR SCANNER */}
        {activeTab === 'qrscanner' && (
          <div>
            <QRScannerTab />
          </div>
        )}

      {/* Admin Team Chat Viewer Modal */}
      {adminChatTeam && user && (
        <TeamChatModal
          team={adminChatTeam.team}
          members={adminChatTeam.members}
          currentUserId={user.id}
          currentUserName={user.name}
          onClose={() => setAdminChatTeam(null)}
          readOnly={true}
          adminView={true}
        />
      )}


      {/* Selected Enrollment Student Details Modal */}
      {selectedEnrollmentForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="card-glass w-full max-w-2xl p-8 max-h-[85vh] flex flex-col overflow-hidden border border-cyan-500/30">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
              <div>
                <span className="font-ui text-[10px] tracking-widest text-cyan-400 font-bold block mb-1">ENROLLMENT ROSTER RECORD</span>
                <h3 className="font-display text-3xl text-white">{selectedEnrollmentForModal.studentName}</h3>
              </div>
              <button
                onClick={() => setSelectedEnrollmentForModal(null)}
                className="font-ui text-xs text-gray-400 hover:text-white p-2 cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Event card */}
              <div className="p-5 bg-indigo-950/40 border border-indigo-500/30">
                <span className="font-ui text-[10px] tracking-widest text-indigo-300 font-bold block mb-1">REGISTERED EVENT</span>
                <h4 className="font-display text-2xl text-white mb-2">{selectedEnrollmentForModal.eventTitle}</h4>
                <div className="flex flex-wrap gap-4 text-xs font-ui text-gray-300">
                  <span>📅 {selectedEnrollmentForModal.eventDate}</span>
                  <span>📍 {selectedEnrollmentForModal.eventLocation}</span>
                  {selectedEnrollmentForModal.teamName && (
                    <span className="text-pink-300 font-bold">Team: {selectedEnrollmentForModal.teamName}</span>
                  )}
                </div>
              </div>

              {/* Student info grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 bg-black/40 border border-white/10">
                  <span className="font-ui text-xs text-gray-500 block mb-1">STUDENT PRN</span>
                  <span className="font-mono text-sm text-cyan-300 font-bold">{selectedEnrollmentForModal.pnr || 'Not Provided'}</span>
                </div>

                <div className="p-4 bg-black/40 border border-white/10">
                  <span className="font-ui text-xs text-gray-500 block mb-1">CONTACT EMAIL</span>
                  <span className="font-ui text-sm text-white font-semibold">{selectedEnrollmentForModal.studentEmail}</span>
                </div>

                <div className="p-4 bg-black/40 border border-white/10">
                  <span className="font-ui text-xs text-gray-500 block mb-1">BRANCH / DEPARTMENT</span>
                  <span className="font-ui text-sm text-white font-semibold">{selectedEnrollmentForModal.branch || 'Unassigned'}</span>
                </div>

                <div className="p-4 bg-black/40 border border-white/10">
                  <span className="font-ui text-xs text-gray-500 block mb-1">CLASS YEAR & DIVISION</span>
                  <span className="font-ui text-sm text-white font-semibold">
                    {selectedEnrollmentForModal.classYear} {selectedEnrollmentForModal.division ? `· Division ${selectedEnrollmentForModal.division}` : ''}
                  </span>
                </div>
              </div>

              {selectedEnrollmentForModal.bio && (
                <div className="p-4 bg-black/40 border border-white/10">
                  <span className="font-ui text-xs text-gray-500 block mb-1">STUDENT BIO & TECH INTERESTS</span>
                  <p className="font-body text-sm text-gray-300 leading-relaxed">{selectedEnrollmentForModal.bio}</p>
                </div>
              )}

              <div className="p-4 bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs font-ui text-gray-400">
                <span>PASS ID: <code className="font-mono text-cyan-400">{selectedEnrollmentForModal.id}</code></span>
                <span>ENROLLED: {new Date(selectedEnrollmentForModal.enrolledAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Tickets Modal */}
      {selectedUserForTickets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="card-glass w-full max-w-xl p-8 max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div>
                <h3 className="font-display text-2xl text-white">{selectedUserForTickets.name}'S PASSES</h3>
                <p className="font-ui text-xs text-gray-400">{selectedUserForTickets.email}</p>
              </div>
              <button
                onClick={() => setSelectedUserForTickets(null)}
                className="font-ui text-xs text-gray-400 hover:text-white p-2 cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {selectedUserForTickets.tickets.length === 0 ? (
                <p className="text-center py-8 text-gray-500 font-ui text-xs tracking-widest">
                  NO REGISTERED PASSES FOUND FOR THIS USER.
                </p>
              ) : (
                selectedUserForTickets.tickets.map((t) => (
                  <div key={t.id} className="p-4 bg-black/40 border border-cyan-500/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-display text-lg text-white">{t.eventTitle}</span>
                      <span className="font-ui text-xs text-cyan-400 font-semibold">{t.status}</span>
                    </div>
                    <p className="font-ui text-xs text-gray-400">{t.date} · {t.location}</p>
                    {t.teamName && (
                      <p className="font-ui text-xs text-indigo-400 mt-1">Team: {t.teamName}</p>
                    )}
                    <span className="font-mono text-xs text-gray-600 block mt-2">ID: {t.id}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Editor Modal */}
      <EventEditorModal
        event={editingEvent}
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingEvent(null)
        }}
        onSave={handleSaveEvent}
      />

      {/* Admin Event Teams & Winners Modal */}
      {selectedEventForTeamsModal && (
        <AdminEventTeamsModal
          event={selectedEventForTeamsModal}
          onClose={() => setSelectedEventForTeamsModal(null)}
          onWinnerUpdated={loadData}
        />
      )}

      {/* Incomplete Profiles Alert Broadcast Modal */}
      {showIncompleteAlertModal && (
        <IncompleteProfilesAlertModal
          users={users}
          onClose={() => setShowIncompleteAlertModal(false)}
          onAlertSent={(count) => {
            showNotification(`Dispatched profile completion alert to ${count} students!`)
          }}
        />
      )}
    </div>
  )
}
