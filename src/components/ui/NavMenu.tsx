import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TransitionLink from './TransitionLink'
import { useApp } from '../../context/AppContext'
import { teamService } from '../../services/teamService'
import { teamChatService } from '../../services/teamChatService'
import { notificationService } from '../../services/notificationService'
import { isOriginalAdminEmail } from '../../services/authService'
import NotificationsDropdown from '../layout/NotificationsDropdown'

export default function NavMenu() {
  const [scrolled, setScrolled] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [pendingInviteCount, setPendingInviteCount] = useState(0)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)

  const navbarRef = useRef<HTMLElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const moreSheetRef = useRef<HTMLDivElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const lastScrollYRef = useRef(0)
  const hideTimeoutRef = useRef<number | null>(null)
  const isTouchDeviceRef = useRef(false)
  const touchStartYRef = useRef(0)

  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, hasScannerAccess } = useApp()

  const isAdmin = user?.role === 'admin' || isOriginalAdminEmail(user?.email)

  // Detect touch device
  useEffect(() => {
    isTouchDeviceRef.current = window.matchMedia('(hover: none)').matches
  }, [])

  // Detect virtual keyboard opening to hide bottom tab bar
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.78
        document.body.classList.toggle('keyboard-open', isKeyboard)
      }
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize)
      return () => window.visualViewport?.removeEventListener('resize', handleViewportResize)
    }
  }, [])

  // Navigation Items
  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      label: 'Events',
      href: '/events',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Past Events',
      href: '/past-events',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'News & Blogs',
      href: '/news',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 14h-8" />
          <path d="M15 18h-5" />
          <path d="M10 6h8v4h-8V6Z" />
        </svg>
      ),
    },
    {
      label: 'Teams',
      href: '/teams',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    ...(hasScannerAccess || isAdmin
      ? [
          {
            label: 'QR Scanner',
            href: '/qr-scanner',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            ),
          },
        ]
      : []),
    {
      label: 'About',
      href: '/about',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="16" y2="12" />
          <line x1="12" x2="12.01" y1="8" y2="8" />
        </svg>
      ),
    },
    ...(isAdmin
      ? [
          {
            label: 'Admin',
            href: '/admin',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            ),
          },
        ]
      : []),
  ]

  // RequestAnimationFrame-throttled scroll listener for auto-hide & scrolled styling
  useEffect(() => {
    let ticking = false
    lastScrollYRef.current = window.scrollY

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY
          const lastY = lastScrollYRef.current
          const diff = currentY - lastY

          // Scrolled styling change (> 10px)
          const isNowScrolled = currentY > 10
          setScrolled(prev => (prev !== isNowScrolled ? isNowScrolled : prev))

          // Check if any menu/dropdown is open - NEVER hide if open!
          const hasOpenMenu = profileOpen || notificationsOpen || moreSheetOpen

          if (currentY < 10) {
            // Rule 1: At top of page, always visible
            setIsHidden(false)
          } else if (!hasOpenMenu) {
            if (diff > 80 && currentY > 80) {
              // Rule 2: Scroll DOWN more than 80px -> slide up & out of view
              setIsHidden(true)
              lastScrollYRef.current = currentY
            } else if (diff < -20) {
              // Rule 3b: Scroll UP more than 20px -> reveal navbar
              setIsHidden(false)
              lastScrollYRef.current = currentY
            }
          }

          if (Math.abs(diff) > 20) {
            lastScrollYRef.current = currentY
          }
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [profileOpen, notificationsOpen, moreSheetOpen])

  // Hover triggers for navbar & top hover zone
  const handleMouseEnterNav = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    setIsHovered(true)
    setIsHidden(false)
  }

  const handleMouseLeaveNav = () => {
    setIsHovered(false)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)

    // Hide after 600ms delay if scrolled > 80px and no menus open
    hideTimeoutRef.current = window.setTimeout(() => {
      if (window.scrollY > 80 && !profileOpen && !notificationsOpen && !moreSheetOpen) {
        setIsHidden(true)
      }
    }, 600)
  }

  const handleTopHoverZoneEnter = () => {
    if (!isTouchDeviceRef.current) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
      setIsHidden(false)
    }
  }

  // Poll for unread team chat messages
  useEffect(() => {
    if (!user?.id) return
    let isMounted = true
    const checkUnread = async () => {
      try {
        const teams = await teamService.getUserTeams(user.id)
        if (!isMounted || teams.length === 0) {
          if (isMounted) setUnreadChatCount(0)
          return
        }
        let total = 0
        for (const t of teams) {
          const count = await teamChatService.getUnreadCount(t.id, user.id)
          total += count
        }
        if (isMounted) setUnreadChatCount(total)
      } catch (err) {
        console.warn('Check unread error:', err)
      }
    }
    checkUnread()
    const interval = setInterval(checkUnread, 5000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [user?.id, location.pathname])

  // Poll for pending team invitations
  useEffect(() => {
    if (!user?.id) {
      setPendingInviteCount(0)
      return
    }
    let isMounted = true
    const check = async () => {
      try {
        const count = await teamService.getPendingInviteCount(user.id)
        if (isMounted) setPendingInviteCount(count)
      } catch {
        /* silent */
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [user?.id, location.pathname])

  // Poll and subscribe to unread in-app notifications
  useEffect(() => {
    if (!user?.id) {
      setUnreadNotifCount(0)
      return
    }
    let isMounted = true
    const checkNotifs = async () => {
      try {
        const count = await notificationService.getUnreadCount(user.id)
        if (isMounted) setUnreadNotifCount(count)
      } catch {}
    }
    checkNotifs()
    const interval = setInterval(checkNotifs, 8000)
    const handleLocalUpdate = () => checkNotifs()
    window.addEventListener('app_notifications_updated', handleLocalUpdate)
    const unsubscribe = notificationService.subscribeToNotifications(user.id, () => {
      checkNotifs()
    })
    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('app_notifications_updated', handleLocalUpdate)
      unsubscribe()
    }
  }, [user?.id, location.pathname])

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (profileOpen && profileDropdownRef.current && !profileDropdownRef.current.contains(target)) {
        setProfileOpen(false)
      }
      if (moreSheetOpen && moreSheetRef.current && !moreSheetRef.current.contains(target) && !moreTriggerRef.current?.contains(target)) {
        closeMoreSheet()
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [profileOpen, moreSheetOpen])

  // Close menus on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (moreSheetOpen) closeMoreSheet()
        if (profileOpen) setProfileOpen(false)
        if (notificationsOpen) setNotificationsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moreSheetOpen, profileOpen, notificationsOpen])

  // Close menus on route change
  useEffect(() => {
    setProfileOpen(false)
    setNotificationsOpen(false)
    setMoreSheetOpen(false)
    setIsHidden(false)
  }, [location.pathname])

  const openMoreSheet = () => {
    setMoreSheetOpen(true)
    setIsHidden(false)
    setProfileOpen(false)
    setNotificationsOpen(false)
  }

  const closeMoreSheet = useCallback(() => {
    setMoreSheetOpen(false)
    moreTriggerRef.current?.focus()
  }, [])

  const handleLogout = async () => {
    setProfileOpen(false)
    setMoreSheetOpen(false)
    await logout()
  }

  // Swipe-down to close on "More" sheet
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - touchStartYRef.current
    if (diff > 50) {
      closeMoreSheet()
    }
  }

  // Check if "More" tab is active (any sheet sub-route)
  const isMoreRouteActive =
    location.pathname === '/past-events' ||
    location.pathname === '/about' ||
    location.pathname === '/qr-scanner' ||
    location.pathname === '/admin' ||
    location.pathname.startsWith('/admin/') ||
    location.pathname === '/profile' ||
    location.pathname === '/my-tickets' ||
    location.pathname === '/auth'

  return (
    <>
      {/* ── Invisible Top Hover Zone (60-80px tall, active only when navbar is hidden) ── */}
      <div
        className={`nav-top-hover-zone ${isHidden ? 'active' : ''}`}
        onMouseEnter={handleTopHoverZoneEnter}
        aria-hidden="true"
      />

      {/* ── Persistent Reveal Handle visible at top center when navbar is hidden ── */}
      {isHidden && (
        <button
          onClick={() => setIsHidden(false)}
          className="glass-top-reveal-handle animate-fade-in"
          aria-label="Reveal navigation bar"
          title="Show Navigation"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* ── Top Liquid Glass Navbar ── */}
      <header
        className={`glass-nav-wrapper ${isHidden ? 'nav-hidden' : ''}`}
        ref={navbarRef}
        onMouseEnter={handleMouseEnterNav}
        onMouseLeave={handleMouseLeaveNav}
        onFocusCapture={() => setIsHidden(false)}
        aria-hidden={isHidden}
      >
        <nav
          className={`glass-nav-pill ${scrolled ? 'scrolled' : ''}`}
          aria-label="Primary"
        >
          {/* Brand Logo with proper left padding */}
          <div className="flex items-center">
            <TransitionLink
              to="/"
              className="flex items-center no-underline pl-1 sm:pl-2 select-none"
              aria-label="E-Cell NKOCET Home"
            >
              <span
                className="font-display font-black tracking-widest text-xl sm:text-2xl transition-colors duration-200"
                style={{ color: 'var(--color-slate-blue)' }}
              >
                ECELL
              </span>
            </TransitionLink>
          </div>

          {/* Desktop Nav Links (hidden < 1100px via .nav-desktop-links) */}
          <ul className="nav-desktop-links items-center gap-1 list-none m-0 p-0">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href))
              return (
                <li key={item.href} className="relative">
                  <TransitionLink
                    to={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                    {item.href === '/teams' && (unreadChatCount > 0 || pendingInviteCount > 0) && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-dusty-blue)',
                        }}
                        title="New team updates"
                      />
                    )}
                  </TransitionLink>
                </li>
              )
            })}
          </ul>

          {/* Right: Actions (Notification bell + Profile/Sign In) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                {/* Notification Bell Button */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotificationsOpen(!notificationsOpen)
                      setProfileOpen(false)
                    }}
                    className="glass-icon-btn"
                    aria-label="Notifications"
                    aria-expanded={notificationsOpen}
                    title="Notifications"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {unreadNotifCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '7px',
                          right: '7px',
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          border: '1.5px solid #ffffff',
                          boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)',
                        }}
                        title={`${unreadNotifCount} unread`}
                      />
                    )}
                  </button>

                  <NotificationsDropdown
                    userId={user.id}
                    isOpen={notificationsOpen}
                    onClose={() => setNotificationsOpen(false)}
                    onNotificationsChanged={() => {
                      notificationService.getUnreadCount(user.id).then(setUnreadNotifCount)
                    }}
                  />
                </div>

                {/* Profile Area wrapped in a glass pill */}
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    onClick={() => {
                      setProfileOpen(!profileOpen)
                      setNotificationsOpen(false)
                    }}
                    className="glass-profile-btn"
                    aria-label="User profile menu"
                    aria-expanded={profileOpen}
                  >
                    {/* Avatar (40px circle with 2px white ring) */}
                    <div
                      className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-display text-sm font-bold flex-shrink-0"
                      style={{
                        border: '2px solid #ffffff',
                        background: user.avatarUrl ? 'transparent' : 'rgba(233, 221, 201, 0.8)',
                        color: 'var(--color-slate-blue)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(user.name.charAt(0) || 'U').toUpperCase()}</span>
                      )}
                    </div>

                    {/* Name and Role (Desktop) */}
                    <div className="hidden sm:flex flex-col items-start leading-tight pr-1">
                      <span className="font-body text-xs font-semibold text-[#20282B] max-w-[90px] truncate">
                        {user.name.split(' ')[0]}
                      </span>
                      {isAdmin ? (
                        <span className="glass-role-pill">Admin</span>
                      ) : (
                        <span className="glass-role-pill" style={{ opacity: 0.85 }}>
                          Member
                        </span>
                      )}
                    </div>

                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`hidden sm:block opacity-60 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Profile Dropdown Panel with matching frosted glass styling */}
                  {profileOpen && (
                    <div className="glass-dropdown-panel" role="menu">
                      <div className="px-4 py-3 border-b border-[rgba(233,221,201,0.5)] mb-1">
                        <p className="font-display font-bold text-sm text-[#20282B] truncate">{user.name}</p>
                        <p className="font-body text-[11px] text-[var(--color-text-secondary)] truncate">{user.email}</p>
                        <div className="mt-1.5">
                          {isAdmin ? <span className="glass-role-pill">Admin</span> : <span className="glass-role-pill">Member</span>}
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <TransitionLink
                          to="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl font-body text-xs font-semibold uppercase tracking-wider text-[#20282B] hover:bg-[rgba(59,83,104,0.08)] transition-colors min-h-[38px]"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          Profile
                        </TransitionLink>

                        <TransitionLink
                          to="/my-tickets"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl font-body text-xs font-semibold uppercase tracking-wider text-[#20282B] hover:bg-[rgba(59,83,104,0.08)] transition-colors min-h-[38px]"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="20" height="14" x="2" y="5" rx="2" />
                            <path d="M2 10h20" />
                          </svg>
                          Passes & Settings
                        </TransitionLink>

                        {hasScannerAccess && (
                          <TransitionLink
                            to="/qr-scanner"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl font-body text-xs font-semibold uppercase tracking-wider text-[#20282B] hover:bg-[rgba(59,83,104,0.08)] transition-colors min-h-[38px]"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="7" height="7" />
                              <rect x="14" y="3" width="7" height="7" />
                              <rect x="14" y="14" width="7" height="7" />
                              <rect x="3" y="14" width="7" height="7" />
                            </svg>
                            QR Scanner
                          </TransitionLink>
                        )}

                        {isAdmin && (
                          <TransitionLink
                            to="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl font-body text-xs font-semibold uppercase tracking-wider text-[var(--color-slate-blue)] hover:bg-[rgba(59,83,104,0.08)] transition-colors min-h-[38px]"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            Admin Console
                          </TransitionLink>
                        )}

                        <div className="pt-1 mt-1 border-t border-[rgba(233,221,201,0.5)]">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-body text-xs font-semibold uppercase tracking-wider text-[#ef4444] hover:bg-red-50/80 transition-colors cursor-pointer text-left min-h-[38px]"
                            style={{ border: 'none', background: 'transparent' }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <polyline points="16 17 21 12 16 7" />
                              <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Logout
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <TransitionLink
                to="/auth"
                className="btn-primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  borderRadius: '9999px',
                }}
              >
                Sign In
              </TransitionLink>
            )}
          </div>

          {/* Chevron Toggle Handle attached to bottom center */}
          <button
            onClick={() => {
              if (window.scrollY > 80) {
                setIsHidden(true)
              } else {
                window.scrollTo({ top: 120, behavior: 'smooth' })
              }
            }}
            className="glass-chevron-handle hidden md:flex"
            aria-label="Toggle navigation bar"
            title="Hide Navigation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </nav>
      </header>

      {/* ── Mobile Bottom Tab Bar (Visible only below 1100px) ── */}
      <nav
        className="glass-bottom-bar"
        aria-label="Mobile Navigation"
      >
        {/* Tab 1: Home */}
        <TransitionLink
          to="/"
          className={`bottom-tab-item ${location.pathname === '/' ? 'active' : ''}`}
          aria-current={location.pathname === '/' ? 'page' : undefined}
          aria-label="Home"
        >
          {location.pathname === '/' && <div className="bottom-tab-pill" />}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="bottom-tab-label">Home</span>
        </TransitionLink>

        {/* Tab 2: Events */}
        <TransitionLink
          to="/events"
          className={`bottom-tab-item ${location.pathname === '/events' || location.pathname.startsWith('/events/') ? 'active' : ''}`}
          aria-current={location.pathname === '/events' || location.pathname.startsWith('/events/') ? 'page' : undefined}
          aria-label="Events"
        >
          {(location.pathname === '/events' || location.pathname.startsWith('/events/')) && <div className="bottom-tab-pill" />}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          <span className="bottom-tab-label">Events</span>
        </TransitionLink>

        {/* Tab 3: News */}
        <TransitionLink
          to="/news"
          className={`bottom-tab-item ${location.pathname === '/news' || location.pathname.startsWith('/news/') || location.pathname.startsWith('/blogs') ? 'active' : ''}`}
          aria-current={location.pathname === '/news' || location.pathname.startsWith('/news/') ? 'page' : undefined}
          aria-label="News"
        >
          {(location.pathname === '/news' || location.pathname.startsWith('/news/') || location.pathname.startsWith('/blogs')) && <div className="bottom-tab-pill" />}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <path d="M18 14h-8" />
            <path d="M15 18h-5" />
            <path d="M10 6h8v4h-8V6Z" />
          </svg>
          <span className="bottom-tab-label">News</span>
        </TransitionLink>

        {/* Tab 4: Teams */}
        <TransitionLink
          to="/teams"
          className={`bottom-tab-item ${location.pathname === '/teams' ? 'active' : ''}`}
          aria-current={location.pathname === '/teams' ? 'page' : undefined}
          aria-label="Teams"
        >
          {location.pathname === '/teams' && <div className="bottom-tab-pill" />}
          <div className="relative">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {(unreadChatCount > 0 || pendingInviteCount > 0) && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-4px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-dusty-blue)',
                }}
              />
            )}
          </div>
          <span className="bottom-tab-label">Teams</span>
        </TransitionLink>

        {/* Tab 5: More */}
        <button
          ref={moreTriggerRef}
          onClick={openMoreSheet}
          className={`bottom-tab-item ${moreSheetOpen || isMoreRouteActive ? 'active' : ''}`}
          aria-label="More navigation options"
          aria-haspopup="dialog"
          aria-expanded={moreSheetOpen}
        >
          {(moreSheetOpen || isMoreRouteActive) && <div className="bottom-tab-pill" />}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
          <span className="bottom-tab-label">More</span>
        </button>
      </nav>

      {/* ── "More" Bottom Sheet Backdrop ── */}
      <div
        className={`glass-more-sheet-backdrop ${moreSheetOpen ? 'open' : ''}`}
        onClick={closeMoreSheet}
        aria-hidden="true"
      />

      {/* ── "More" Bottom Sheet ── */}
      <div
        ref={moreSheetRef}
        className={`glass-more-sheet ${moreSheetOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="More Menu"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sheet-drag-handle" aria-hidden="true" />

        <div className="px-5 py-2 flex items-center justify-between border-b border-[rgba(233,221,201,0.5)] mb-2">
          <span className="font-display font-bold text-base text-[#20282B]">More Options</span>
          <button
            onClick={closeMoreSheet}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#20282B]/60 hover:text-[#20282B] cursor-pointer"
            style={{ background: 'transparent', border: 'none' }}
            aria-label="Close sheet"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto px-2 py-1">
          {/* Row 1: Past Events */}
          <TransitionLink
            to="/past-events"
            onClick={closeMoreSheet}
            className={`sheet-row-item ${location.pathname === '/past-events' ? 'active' : ''}`}
          >
            <div className="flex items-center gap-3.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Past Events</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </TransitionLink>

          {/* Row 2: About */}
          <TransitionLink
            to="/about"
            onClick={closeMoreSheet}
            className={`sheet-row-item ${location.pathname === '/about' ? 'active' : ''}`}
          >
            <div className="flex items-center gap-3.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="16" y2="12" />
                <line x1="12" x2="12.01" y1="8" y2="8" />
              </svg>
              <span>About E-Cell</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </TransitionLink>

          {/* Row 3: QR Scanner (If permitted) */}
          {(hasScannerAccess || isAdmin) && (
            <TransitionLink
              to="/qr-scanner"
              onClick={closeMoreSheet}
              className={`sheet-row-item ${location.pathname === '/qr-scanner' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>QR Scanner</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </TransitionLink>
          )}

          {/* Row 4: Admin Console (If Admin) */}
          {isAdmin && (
            <TransitionLink
              to="/admin"
              onClick={closeMoreSheet}
              className={`sheet-row-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3.5 text-[var(--color-slate-blue)] font-semibold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Admin Console</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </TransitionLink>
          )}

          {/* User Account / Auth Section */}
          <div className="mt-3 pt-3 border-t border-[rgba(233,221,201,0.6)]">
            {user ? (
              <div className="flex flex-col gap-1">
                {/* Profile Row */}
                <TransitionLink
                  to="/profile"
                  onClick={closeMoreSheet}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-[rgba(59,83,104,0.06)] transition-colors mx-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-display text-sm font-bold flex-shrink-0"
                      style={{
                        border: '2px solid #ffffff',
                        background: user.avatarUrl ? 'transparent' : 'rgba(233, 221, 201, 0.8)',
                        color: 'var(--color-slate-blue)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      }}
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(user.name.charAt(0) || 'U').toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-display font-bold text-sm text-[#20282B] leading-tight truncate">{user.name}</p>
                      <p className="font-body text-xs text-[var(--color-text-secondary)] truncate">{user.email}</p>
                    </div>
                  </div>
                  {isAdmin ? <span className="glass-role-pill">Admin</span> : <span className="glass-role-pill">Member</span>}
                </TransitionLink>

                {/* My Passes & Settings */}
                <TransitionLink
                  to="/my-tickets"
                  onClick={closeMoreSheet}
                  className="sheet-row-item"
                >
                  <div className="flex items-center gap-3.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <path d="M2 10h20" />
                    </svg>
                    <span>My Passes & Tickets</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </TransitionLink>

                {/* Sign Out Action */}
                <button
                  onClick={handleLogout}
                  className="sheet-row-item text-[#ef4444] hover:bg-red-50/80"
                >
                  <div className="flex items-center gap-3.5 font-semibold">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Logout</span>
                  </div>
                </button>
              </div>
            ) : (
              <div className="p-3">
                <TransitionLink
                  to="/auth"
                  onClick={closeMoreSheet}
                  className="btn-primary w-full text-center py-3"
                >
                  Sign In
                </TransitionLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
