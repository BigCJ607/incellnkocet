import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import './styles/index.css'
import NavMenu from './components/ui/NavMenu'
import EventsListingPage from './pages/EventsListingPage'
import EventDetailPage from './pages/EventDetailPage'
import AboutPage from './pages/AboutPage'
import AuthPage from './pages/AuthPage'
import PastEventsPage from './pages/PastEventsPage'
import MyTicketsPage from './pages/MyTicketsPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import AdminEventTeamsPage from './pages/AdminEventTeamsPage'
import TeamsPage from './pages/TeamsPage'
import QRScannerPage from './pages/QRScannerPage'

import { AppProvider } from './context/AppContext'
import { useApp } from './context/AppContext'
import { useSessionTracker } from './hooks/useSessionTracker'
import gsap from 'gsap'


// Inner shell — needs to be inside both AppProvider and BrowserRouter to access useLocation
function AppShell() {
  const { user } = useApp()
  const location = useLocation()
  useSessionTracker(user?.id)

  useEffect(() => {
    gsap.fromTo(
      '#main-content',
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
    )
  }, [location.pathname])

  return (
    <div id="app-root" className="relative flex flex-col min-h-screen overflow-hidden">

      <div id="page-wrapper" className="flex flex-col min-h-screen w-full relative z-0">
        <NavMenu />

        <main id="main-content" className="flex-1">
          <Routes>
            <Route path="/" element={<EventsListingPage />} />
            <Route path="/events" element={<EventsListingPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/past-events" element={<PastEventsPage />} />
            <Route path="/my-tickets" element={<MyTicketsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/events/:eventId/teams" element={<AdminEventTeamsPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/qr-scanner" element={<QRScannerPage />} />
          </Routes>
        </main>

        <footer
          style={{
            background: 'var(--color-bg)',
            borderTop: '1px solid var(--color-sand)',
            padding: '2.5rem 0',
          }}
        >
          <div className="px-6 md:px-12 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="font-display" style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.08em', color: 'var(--color-text-primary)' }}>
                E-Cell NKOCET
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                color: 'var(--color-text-muted)',
                margin: 0,
                textAlign: 'center',
              }}
            >
              © 2026 E-CELL NKOCET. ALL RIGHTS RESERVED.
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <a
                href="/about"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.1em',
                  color: 'var(--color-text-muted)',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-slate-blue)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-muted)')}
              >
                About
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppProvider>
  )
}
