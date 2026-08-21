import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import TransitionLink from './TransitionLink'
import { useApp } from '../../context/AppContext'
import { teamService } from '../../services/teamService'
import { teamChatService } from '../../services/teamChatService'
import { notificationService } from '../../services/notificationService'
import { isOriginalAdminEmail } from '../../services/authService'
import NotificationsDropdown from '../layout/NotificationsDropdown'
import gsap from 'gsap'

const BASE_NAV_ITEMS = [
  { label: 'Home', href: '/', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { label: 'Events', href: '/events', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> },
  { label: 'Past Events', href: '/past-events', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { label: 'Teams', href: '/teams', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { label: 'About', href: '/about', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg> },
]

export default function NavMenu() {
  const [scrolled, setScrolled] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [scrollDirection, setScrollDirection] = useState<'up'|'down'>('up')
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLUListElement>(null)
  const location = useLocation()
  const { user, logout, hasScannerAccess } = useApp()
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [pendingInviteCount, setPendingInviteCount] = useState(0)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const isAdmin = user?.role === 'admin' || isOriginalAdminEmail(user?.email)

  const navItems = [
    { label: 'Home', href: '/', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { label: 'Events', href: '/events', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> },
    { label: 'Past Events', href: '/past-events', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: 'Teams', href: '/teams', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    ...(hasScannerAccess || isAdmin ? [{
      label: 'QR Scanner',
      href: '/qr-scanner',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    }] : []),
    { label: 'About', href: '/about', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg> },
    ...(isAdmin ? [{ label: 'Admin', href: '/admin', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }] : []),
  ]

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setScrolled(currentScrollY > 40);
      
      if (currentScrollY > lastScrollY && currentScrollY > 10) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      }
      lastScrollY = currentScrollY;
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
    return () => { isMounted = false; clearInterval(interval) }
  }, [user?.id, location.pathname])

  // Poll for pending team invitations
  useEffect(() => {
    if (!user?.id) { setPendingInviteCount(0); return }
    let isMounted = true
    const check = async () => {
      try {
        const count = await teamService.getPendingInviteCount(user.id)
        if (isMounted) setPendingInviteCount(count)
      } catch { /* silent */ }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [user?.id, location.pathname])

  // Poll and subscribe to unread in-app notifications
  useEffect(() => {
    if (!user?.id) { setUnreadNotifCount(0); return }
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

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return
    const handler = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  useEffect(() => { 
    setProfileOpen(false)
    setMenuOpen(false)
    if (menuOpen) {
      document.body.style.overflow = 'auto'
    }
  }, [location.pathname])

  useEffect(() => {
    if (menuOpen && mobileMenuRef.current) {
      gsap.fromTo(mobileMenuRef.current.children, 
        { x: -30, opacity: 0 }, 
        { x: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power3.out' }
      )
    }
  }, [menuOpen])

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
    document.body.style.overflow = !menuOpen ? 'hidden' : 'auto'
  }

  const [hovered, setHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleLogout = async () => {
    setProfileOpen(false)
    await logout()
  }

  const [forceToggle, setForceToggle] = useState<'show'|'hide'|null>(null);

  useEffect(() => {
    if (forceToggle) setForceToggle(null);
  }, [scrollY]);

  useEffect(() => {
    let lastY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const currentY = e.clientY;
      // Active area is 50% of screen if near the top, otherwise 18%
      const activeArea = window.scrollY < 100 ? window.innerHeight / 2 : window.innerHeight * 0.18;
      
      if (currentY < 80) { 
        // physically close to the top edge / nav area
        setHovered(true);
      } else if (lastY - currentY > 10 && currentY < activeArea) { 
        // moving up fast in the active area
        setHovered(true);
      } else if (currentY - lastY > 10 && currentY > 80) {
        // moving down fast and away from the nav area
        setHovered(false);
      }
      lastY = currentY;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  let navHidden = true;
  if (scrollY > 10) {
    navHidden = scrollDirection === 'down' && !menuOpen && !profileOpen && !notificationsOpen && !hovered;
  } else {
    navHidden = !menuOpen && !profileOpen && !notificationsOpen && !hovered;
  }
  if (forceToggle === 'show') navHidden = false;
  if (forceToggle === 'hide') navHidden = true;
  if (location.pathname === '/my-tickets') navHidden = false;

  let isActiveBg = scrolled || hovered || menuOpen || (isMobile && !navHidden);
  if (location.pathname === '/my-tickets') isActiveBg = true;

  return (
    <>
      <div 
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ height: 'var(--nav-h)' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div 
          className="absolute top-0 left-0 right-0 h-6 pointer-events-auto cursor-pointer"
          onClick={() => setForceToggle('show')}
        />
        
        <nav
          className="pointer-events-auto flex items-center justify-between px-6 md:px-12 transition-all duration-500 w-full h-full relative"
          style={{
            transform: navHidden ? 'translateY(calc(-100% + 20px))' : 'translateY(0)',
            background: isActiveBg ? 'rgba(251, 249, 244, 0.45)' : 'transparent',
            backdropFilter: isActiveBg ? 'blur(16px) saturate(180%)' : 'none',
            borderBottom: isActiveBg ? '1px solid var(--color-cream)' : '1px solid transparent',
          }}
        >
          {/* Logo */}
          <TransitionLink to="/" className="flex items-center no-underline text-2xl" aria-label="Ecell Home">
            <span 
              className="font-display font-black tracking-widest transition-colors duration-300"
              style={{ color: (isActiveBg || !(location.pathname === '/' || /^\/events\/[^/]+$/.test(location.pathname))) ? '#6B705C' : '#FFFFFF' }}
            >
              ECELL
            </span>
          </TransitionLink>



          {/* Toggle Arrow */}
          {location.pathname !== '/my-tickets' && (
            <button 
              onClick={() => setForceToggle(navHidden ? 'show' : 'hide')}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="absolute left-1/2 -translate-x-1/2 z-[60] flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-125"
              style={{  
                bottom: '-28px', 
                width: '44px', 
                height: '28px',
                background: 'transparent',
                border: 'none',
                color: (isActiveBg || !(location.pathname === '/' || /^\/events\/[^/]+$/.test(location.pathname))) ? '#6B705C' : '#FFFFFF',
                filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.4))'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: navHidden ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.4s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-10 list-none m-0">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))
            return (
              <li key={item.href}>
                <TransitionLink
                  to={item.href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                  {item.href === '/teams' && (unreadChatCount > 0 || pendingInviteCount > 0) && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-12px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--color-dusty-blue)',
                      }}
                      title="New updates"
                    />
                  )}
                </TransitionLink>
              </li>
            )
          })}
        </ul>

        {/* Auth section */}
        <div className="hidden md:flex items-center">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    setProfileOpen(false);
                  }}
                  className="relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200"
                  style={{
                    background: notificationsOpen ? 'rgba(34, 211, 238, 0.15)' : 'rgba(0, 0, 0, 0.04)',
                    border: notificationsOpen ? '1px solid #22d3ee' : '1px solid var(--color-sand)',
                    color: notificationsOpen ? '#22d3ee' : (isActiveBg || !(location.pathname === '/' || /^\/events\/[^/]+$/.test(location.pathname))) ? 'var(--color-slate-blue)' : '#FFFFFF',
                  }}
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {unreadNotifCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold font-ui leading-none flex items-center justify-center shadow-md animate-pulse"
                      style={{
                        background: '#ef4444',
                        color: '#ffffff',
                        minWidth: '16px',
                        height: '16px',
                        border: '1.5px solid var(--color-ivory)',
                      }}
                    >
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </button>

                <NotificationsDropdown
                  userId={user.id}
                  isOpen={notificationsOpen}
                  onClose={() => setNotificationsOpen(false)}
                  onNotificationsChanged={() => {
                    notificationService.getUnreadCount(user.id).then(setUnreadNotifCount);
                  }}
                />
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => {
                    setProfileOpen(!profileOpen);
                    setNotificationsOpen(false);
                  }}
                  className="flex items-center gap-3 cursor-pointer p-0"
                  style={{ background: 'none', border: 'none' }}
                >
                  <div className="flex flex-col items-end text-right">
                    <span className="font-body text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {user.name.split(' ')[0]}
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] font-body tracking-widest text-editorial uppercase">Admin</span>
                    )}
                  </div>
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-display text-sm font-bold"
                    style={{
                      background: user.avatarUrl ? 'transparent' : 'var(--color-cream)',
                      color: 'var(--color-slate-blue)',
                      border: '1px solid var(--color-sand)'
                    }}
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{(user.name.charAt(0) || 'U').toUpperCase()}</span>
                    )}
                  </div>
                </button>

                {/* Profile Dropdown Content */}
                <div
                  className={`absolute right-0 top-full mt-4 w-64 bg-[var(--color-ivory)] shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl transition-all duration-300 ease-out origin-top-right z-50 ${profileOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
                  style={{ border: '1px solid var(--color-cream)' }}
                >
                  {/* Pointer / Caret */}
                  <div className="absolute -top-[9px] right-4 w-4 h-4 bg-[var(--color-ivory)] rotate-45 border-l border-t border-[var(--color-cream)] pointer-events-none" />

                  <div className="px-5 pt-5 pb-4 mb-2 border-b border-[var(--color-cream)] relative z-10 bg-[var(--color-ivory)] rounded-t-2xl">
                    <p className="font-display font-bold text-lg text-[var(--color-text-primary)] truncate">{user.name}</p>
                    <p className="font-body text-[11px] font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase truncate mt-1">{user.email}</p>
                  </div>

                  <div className="px-2 pb-2 relative z-10 bg-[var(--color-ivory)] rounded-b-2xl">
                    {[
                      { label: 'My Profile', href: '/profile' },
                      { label: 'My Passes', href: '/my-tickets' },
                      { label: 'QR Scanner', href: '/qr-scanner', show: hasScannerAccess },
                      { label: 'Admin Console', href: '/admin', show: isAdmin },
                    ].filter(item => item.show !== false).map(({ label, href }) => (
                      <TransitionLink
                        key={href}
                        to={href}
                        className="block px-4 py-3 min-h-[44px] font-body text-sm font-medium text-[var(--color-slate-blue)] hover:bg-[var(--color-cream)] hover:text-[var(--color-text-primary)] rounded-xl transition-colors mb-1 flex items-center"
                      >
                        {label}
                      </TransitionLink>
                    ))}

                    <div className="mt-1 pt-2 border-t border-[var(--color-cream)]">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 min-h-[44px] font-body text-sm font-medium text-[#ef4444] hover:bg-[#fef2f2] hover:text-[#dc2626] rounded-xl transition-colors flex items-center cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <TransitionLink
              to="/auth"
              className="btn-primary py-2 px-6"
            >
              Sign In
            </TransitionLink>
          )}
        </div>

        {/* Mobile: Notifications + Avatar + Hamburger */}
        <div className="md:hidden flex items-center gap-2 z-[60]">
          {user && (
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer relative"
                style={{
                  background: notificationsOpen ? 'rgba(34, 211, 238, 0.15)' : 'rgba(0, 0, 0, 0.04)',
                  border: notificationsOpen ? '1px solid #22d3ee' : '1px solid var(--color-sand)',
                  color: notificationsOpen ? '#22d3ee' : (isActiveBg || !(location.pathname === '/' || /^\/events\/[^/]+$/.test(location.pathname))) ? 'var(--color-slate-blue)' : '#FFFFFF',
                }}
                aria-label="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadNotifCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full text-[8px] font-extrabold leading-none flex items-center justify-center shadow-md animate-pulse"
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      minWidth: '14px',
                      height: '14px',
                      border: '1.5px solid var(--color-ivory)',
                    }}
                  >
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              <NotificationsDropdown
                userId={user.id}
                isOpen={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                onNotificationsChanged={() => {
                  notificationService.getUnreadCount(user.id).then(setUnreadNotifCount);
                }}
              />
            </div>
          )}

          {/* Mobile avatar (tap → drawer where profile links live) */}
          {user && (
            <button
              onClick={toggleMenu}
              className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-display text-sm font-bold flex-shrink-0"
              style={{
                background: user.avatarUrl ? 'transparent' : 'var(--color-cream)',
                color: 'var(--color-slate-blue)',
                border: '1px solid var(--color-sand)',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label="Open menu"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span>{(user.name.charAt(0) || 'U').toUpperCase()}</span>
              )}
            </button>
          )}
          {/* Hamburger — 44×44 tap target */}
          <button
            onClick={toggleMenu}
            className="w-11 h-11 flex flex-col items-center justify-center gap-1.5"
            aria-label="Toggle menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className={`block w-6 h-[1.5px] transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} style={{ backgroundColor: (isActiveBg || !(location.pathname === '/' || /^\/events\/[^/]+$/.test(location.pathname))) ? '#0f172a' : '#FFFFFF' }} />
            <span className={`block w-6 h-[1.5px] transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} style={{ backgroundColor: (isActiveBg || !(location.pathname === '/' || /^\/events\/[^/]+$/.test(location.pathname))) ? '#0f172a' : '#FFFFFF' }} />
            <span className={`block w-6 h-[1.5px] transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} style={{ backgroundColor: (isActiveBg || !(location.pathname === '/' || /^\/events\/[^/]+$/.test(location.pathname))) ? '#0f172a' : '#FFFFFF' }} />
          </button>
        </div>
        </nav>
      </div>

      {/* Mobile Drawer Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/30 backdrop-blur-md z-[55] md:hidden transition-opacity duration-300 ${menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleMenu}
      />

      {/* Mobile Fullscreen Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-[85%] max-w-sm z-[55] shadow-2xl flex flex-col md:hidden transition-transform duration-500 ease-out ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--color-ivory)', borderLeft: '1px solid var(--color-cream)' }}
      >
        <div className="flex flex-col h-full pt-20 px-6 pb-10 overflow-y-auto">
          {/* Top Logo / Title in Drawer */}
          <div className="mb-10 pl-2">
            <span className="font-display font-black tracking-widest text-2xl" style={{ color: 'var(--color-slate-blue)' }}>
              ECELL
            </span>
          </div>

          <ul ref={mobileMenuRef} className="flex flex-col gap-2 list-none p-0 m-0 flex-grow">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <TransitionLink
                    to={item.href}
                    onClick={toggleMenu}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${isActive ? 'bg-[var(--color-slate-blue)]' : 'hover:bg-[var(--color-cream)]'}`}
                    style={{ color: isActive ? '#fff' : 'var(--color-slate-blue)' }}
                  >
                    <span className="opacity-80">
                      {item.icon}
                    </span>
                    <span className={`font-body text-base font-medium tracking-wide ${isActive ? 'text-white' : ''}`}>
                      {item.label}
                    </span>
                    {item.href === '/teams' && (unreadChatCount > 0 || pendingInviteCount > 0) && (
                      <span className="ml-auto inline-block w-2 h-2 rounded-full bg-[var(--color-dusty-blue)] align-middle shadow-sm" />
                    )}
                  </TransitionLink>
                </li>
              )
            })}
          </ul>

          <div className="pt-6 mt-6 border-t border-[var(--color-cream)]">
            {user ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 p-2 mb-4">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-[var(--color-cream)] text-[var(--color-slate-blue)] font-display text-base">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{(user.name.charAt(0) || 'U').toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-display font-medium text-base text-[var(--color-text-primary)] leading-none truncate">{user.name.split(' ')[0]}</p>
                    <p className="font-body text-xs text-[var(--color-text-secondary)] mt-1 truncate">{user.email}</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      toggleMenu();
                      setNotificationsOpen(true);
                    }}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-[var(--color-cream)] transition-all duration-300 font-body text-sm text-[var(--color-text-secondary)] w-full text-left"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                  >
                    <div className="flex items-center gap-4">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                      Notifications
                    </div>
                    {unreadNotifCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500 text-white shadow-sm">
                        {unreadNotifCount}
                      </span>
                    )}
                  </button>
                  <TransitionLink to="/profile" onClick={toggleMenu} className="flex items-center gap-4 p-4 rounded-xl hover:bg-[var(--color-cream)] transition-all duration-300 font-body text-sm text-[var(--color-text-secondary)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    My Profile
                  </TransitionLink>
                  <TransitionLink to="/my-tickets" onClick={toggleMenu} className="flex items-center gap-4 p-4 rounded-xl hover:bg-[var(--color-cream)] transition-all duration-300 font-body text-sm text-[var(--color-text-secondary)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>
                    My Passes
                  </TransitionLink>
                  <button onClick={handleLogout} className="flex items-center gap-4 p-4 rounded-xl hover:bg-red-50 transition-all duration-300 font-body text-sm text-red-500 cursor-pointer text-left w-full" style={{ border: 'none', background: 'transparent' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <TransitionLink
                to="/auth"
                onClick={toggleMenu}
                className="btn-primary w-full text-center"
              >
                Sign In
              </TransitionLink>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
