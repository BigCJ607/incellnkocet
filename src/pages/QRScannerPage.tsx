import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import QRScannerTab from '../components/admin/QRScannerTab'

export default function QRScannerPage() {
  const { user, hasScannerAccess, loading } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth', { replace: true })
      } else if (!hasScannerAccess) {
        navigate('/', { replace: true })
      }
    }
  }, [user, hasScannerAccess, loading, navigate])

  if (loading || !user || !hasScannerAccess) return null

  return (
    <div
      className="min-h-screen text-slate-100"
      style={{
        background: '#090d16',
        paddingTop: 'calc(var(--nav-h) + 2rem)',
        paddingBottom: '6rem',
      }}
    >
      <div className="page-container max-w-7xl mx-auto px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-8">
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
                background: 'rgba(52,211,153,0.12)',
                border: '1px solid rgba(52,211,153,0.35)',
                color: '#34d399',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              OPERATOR CLEARANCE ACTIVE
            </span>
          </div>
        </div>

        {/* QR Scanner Component */}
        <div className="card-glass p-6 sm:p-10 rounded-2xl" style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <QRScannerTab />
        </div>
      </div>
    </div>
  )
}

