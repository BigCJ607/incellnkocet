import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import type { UserProfile, ClassYear } from '../mocks/types'
import { profileService } from '../services/profileService'
import { authService } from '../services/authService'
import { getShortBranch } from '../utils/formatters'

const CLASS_YEARS: ClassYear[] = ['First Year', 'Second Year', 'Third Year', 'Fourth Year']

const PRESET_BRANCHES = [
  'Computer Science & Engineering',
  'Artificial Intelligence & Data Science',
  'Electronics & Telecommunication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
]

const generateAvatarUrl = (style: string, seed: string) =>
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f5f1e8,fbf9f4,e9ddc9`

const PRESET_AVATARS = [
  { id: 'bot-1', name: 'Cyber Android', url: generateAvatarUrl('bottts-neutral', 'Zephyr-9') },
  { id: 'bot-2', name: 'Neon Glitch', url: generateAvatarUrl('bottts-neutral', 'Vortex-X') },
  { id: 'bot-3', name: 'Quantum Core', url: generateAvatarUrl('bottts-neutral', 'Aegis-7') },
  { id: 'bot-4', name: 'Pulse Mech', url: generateAvatarUrl('bottts-neutral', 'Nova-Prime') },
  { id: 'shape-1', name: 'Matrix Grid', url: generateAvatarUrl('shapes', 'Hexagon') },
  { id: 'shape-2', name: 'Cyber Poly', url: generateAvatarUrl('shapes', 'Prism-Cyber') },
  { id: 'pixel-1', name: 'Pixel Hacker', url: generateAvatarUrl('pixel-art', 'Ghost-In-Shell') },
  { id: 'pixel-2', name: 'Retro Coder', url: generateAvatarUrl('pixel-art', 'Zero-One') },
]

// Shared input style — light theme
const inp: CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 13,
  backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-sand)',
  color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box',
  outline: 'none', transition: 'border-color 0.2s',
}

// Reusable section label
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--color-text-secondary)', fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase' }}>
      {children}
    </p>
  )
}

export default function ProfilePage() {
  const { user, loading: authLoading, refreshProfile } = useApp()
  const { userId: paramUserId } = useParams<{ userId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Are we viewing someone else's profile?
  const isViewingOther = !!(paramUserId && paramUserId !== user?.id)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null)
  const [otherLoading, setOtherLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('edit') === 'true';
    }
    return false;
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editName, setEditName] = useState('')
  const [editPnr, setEditPnr] = useState('')
  const [editYear, setEditYear] = useState<ClassYear>('First Year')
  const [editDivision, setEditDivision] = useState('')
  const [editBranch, setEditBranch] = useState('Computer Science & Engineering')
  const [editEmail, setEditEmail] = useState('')
  const [editPhoneNumber, setEditPhoneNumber] = useState('')
  const [editBio, setEditBio] = useState('')

  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarTab, setAvatarTab] = useState<'presets' | 'generate' | 'upload'>('presets')
  const [generatedSeed, setGeneratedSeed] = useState('')

  // Password Change States
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    profileService.getProfile(user.id).then(p => {
      setProfile(p)
      if (p) {
        setEditName(p.name); setEditPnr(p.pnr || ''); setEditYear(p.classYear)
        setEditDivision(p.division); setEditBranch(p.branch || 'Computer Science & Engineering')
        setEditEmail(p.contactEmail); setEditPhoneNumber(p.phoneNumber || ''); setEditBio(p.bio || '')
        setCurrentAvatarUrl(p.avatarUrl || ''); setAvatarPreview(p.avatarUrl || '')
      } else {
        setEditName(user.name); setEditEmail(user.email)
        setCurrentAvatarUrl(''); setAvatarPreview('')
      }
      setLoading(false)
    })
  }, [user])

  // Fetch other user's profile when viewing via /profile/:userId
  useEffect(() => {
    if (!isViewingOther || !paramUserId) return
    setOtherLoading(true)
    profileService.getProfile(paramUserId).then(p => {
      setOtherProfile(p)
    }).finally(() => setOtherLoading(false))
  }, [paramUserId, isViewingOther])

  // Auto-enter edit mode when navigated from registration panel or notification alert
  useEffect(() => {
    const handleOpenEdit = () => {
      setIsEditing(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('open_profile_edit_mode', handleOpenEdit)

    const params = new URLSearchParams(location.search)
    const wantsEdit = params.get('edit') === 'true' || Boolean((location.state as any)?.autoEdit)
    if (wantsEdit) {
      handleOpenEdit()
    }

    return () => window.removeEventListener('open_profile_edit_mode', handleOpenEdit)
  }, [location.search, location.state, location.pathname])

  const handleAvatarFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file))
  }
  const handleSelectPresetAvatar = (url: string) => { setAvatarFile(null); setCurrentAvatarUrl(url); setAvatarPreview(url) }
  const handleClearAvatar = () => { setAvatarFile(null); setCurrentAvatarUrl(''); setAvatarPreview('') }
  const handleGenerateRandomAvatar = () => {
    const seed = `${editName || 'EventZero'}-${Math.random().toString(36).slice(2, 8)}`
    setGeneratedSeed(seed)
    const styles = ['bottts-neutral', 'shapes', 'pixel-art', 'identicon']
    const url = generateAvatarUrl(styles[Math.floor(Math.random() * styles.length)], seed)
    setAvatarFile(null); setCurrentAvatarUrl(url); setAvatarPreview(url)
  }

  const handleSave = async () => {
    if (!user) return; setSaving(true)
    try {
      let finalAvatarUrl = currentAvatarUrl
      if (avatarFile) {
        try { finalAvatarUrl = await profileService.uploadAvatar(user.id, avatarFile) }
        catch (e) { console.warn('Avatar upload failed', e) }
      }
      const updated = await profileService.updateProfile(user.id, {
        name: editName, pnr: editPnr, classYear: editYear,
        division: editDivision, branch: editBranch,
        contactEmail: editEmail, phoneNumber: editPhoneNumber, bio: editBio, avatarUrl: finalAvatarUrl || '',
      })
      setProfile(updated); setCurrentAvatarUrl(finalAvatarUrl || '')
      setAvatarPreview(finalAvatarUrl || ''); setAvatarFile(null)
      setIsEditing(false); setSaveSuccess(true)
      if (refreshProfile) {
        await refreshProfile()
      }
      setTimeout(() => {
        setSaveSuccess(false)
        const fromPath = (location.state as any)?.from
        if (fromPath && typeof fromPath === 'string' && fromPath !== '/profile' && fromPath !== '/profile?edit=true') {
          navigate(fromPath)
        } else if (window.history.length > 1) {
          navigate(-1)
        } else {
          navigate('/events')
        }
      }, 1200)
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordLoading(true)
    try {
      await authService.changePassword(newPassword, currentPassword || undefined)
      setPasswordSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 4000)
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setEditName(profile.name); setEditPnr(profile.pnr || ''); setEditYear(profile.classYear)
      setEditDivision(profile.division); setEditBranch(profile.branch || 'Computer Science & Engineering')
      setEditEmail(profile.contactEmail); setEditPhoneNumber(profile.phoneNumber || ''); setEditBio(profile.bio || '')
      setCurrentAvatarUrl(profile.avatarUrl || ''); setAvatarPreview(profile.avatarUrl || '')
    }
    setAvatarFile(null)
    setIsEditing(false)
    if (location.search.includes('edit=true')) {
      navigate('/profile', { replace: true })
    }
  }

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--color-slate-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)', gap: 20 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Access Restricted</p>
      <Link to="/auth" style={{ padding: '14px 36px', textDecoration: 'none', backgroundColor: 'var(--color-slate-blue)', color: 'var(--color-white)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Sign In</Link>
    </div>
  )

  // ── READ-ONLY VIEW FOR ANOTHER USER'S PROFILE ──────────────────────────────
  if (isViewingOther) {
    const p = otherProfile
    const initials2 = (p?.name || '?').charAt(0).toUpperCase()
    const avatar2 = p?.avatarUrl || ''

    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Back button bar */}
        <div style={{ paddingTop: 'calc(var(--nav-h) + 1.5rem)', paddingBottom: '1rem' }}>
          <div className="page-container">
            <button
              onClick={() => navigate(-1)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-slate-blue)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              Back to Teams
            </button>
          </div>
        </div>

        {/* Header */}
        <div style={{ paddingBottom: '2rem', borderBottom: '1px solid var(--color-cream)' }}>
          <div className="page-container" style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.22em', color: 'var(--color-slate-blue)', fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase' }}>Teammate</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
              {otherLoading ? 'Loading…' : (p?.name || 'Unknown Member')}
            </h1>
          </div>
        </div>

        <div className="page-container" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {otherLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--color-slate-blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : !p ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-muted)' }}>Profile not found or not set up yet.</p>
            </div>
          ) : (
            <div style={{ maxWidth: 740, width: '100%', animation: 'fadeUp 0.35s ease' }}>
              <div style={{ backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', overflow: 'hidden' }}>
                <div style={{ height: 3, backgroundColor: 'var(--color-slate-blue)' }} />
                <div style={{ padding: '32px' }}>

                  {/* Avatar + Name Row */}
                  <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 28 }}>
                    <div style={{ width: 88, height: 88, overflow: 'hidden', backgroundColor: 'var(--color-cream)', border: '2px solid var(--color-sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {avatar2
                        ? <img src={avatar2} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, color: 'var(--color-slate-blue)' }}>{initials2}</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: 'var(--color-text-primary)', margin: 0 }}>{p.name}</h2>
                        {p.pnr && <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--color-slate-blue)', padding: '3px 10px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)' }}>PRN: {p.pnr}</span>}
                      </div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
                        {p.branch ? getShortBranch(p.branch) : 'Branch not set'}{p.division ? ` · Div ${p.division}` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {p.classYear && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 10px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }}>{p.classYear}</span>}
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 10px', backgroundColor: 'var(--color-slate-blue)', color: 'var(--color-white)', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }}>{p.role === 'admin' ? 'Administrator' : 'Student'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                    {[
                      { label: 'Email', value: p.contactEmail || '—' },
                      { label: 'Phone Number', value: p.phoneNumber || '—' },
                      { label: 'Branch / Dept', value: p.branch ? getShortBranch(p.branch) : '—' },
                      { label: 'Class Year', value: p.classYear || '—' },
                      { label: 'Division', value: p.division || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '14px 18px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)' }}>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase' }}>{label}</p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600, margin: 0, wordBreak: 'break-all' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bio */}
                  {p.bio && (
                    <div style={{ padding: '18px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)', borderLeft: '3px solid var(--color-slate-blue)' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase' }}>About</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.7 }}>{p.bio}</p>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
  // ── END OF READ-ONLY VIEW ───────────────────────────────────────────────────

  const viewAvatar = profile?.avatarUrl || ''
  const initials = (profile?.name || user.name || 'U').charAt(0).toUpperCase()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .inp-field:focus { border-color: var(--color-slate-blue) !important; }
        .av-pick:hover { transform: scale(1.08); box-shadow: 0 0 0 2px var(--color-slate-blue); }
        .av-pick { transition: all 0.2s; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ paddingTop: 'calc(var(--nav-h) + 4rem)', paddingBottom: '3rem', borderBottom: '1px solid var(--color-cream)' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.22em', color: 'var(--color-slate-blue)', fontWeight: 600, margin: '0 0 12px', textTransform: 'uppercase', textAlign: 'center' }}>My Account</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem, 5vw, 4rem)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1, letterSpacing: '-0.02em', textAlign: 'center' }}>Profile</h1>
        </div>
      </div>

      <div className="page-container" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ maxWidth: 740, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Save success */}
          {saveSuccess && (
            <div style={{ padding: '14px 20px', backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', borderLeft: '4px solid var(--color-slate-blue)', display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeUp 0.3s ease', borderRadius: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-slate-blue)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-slate-blue)', fontWeight: 700 }}>Profile updated successfully! Returning...</span>
            </div>
          )}

          {/* Incomplete Profile Alert Banner */}
          {profile && !isEditing && (() => {
            const missing = []
            if (!profile.pnr || !profile.pnr.trim() || profile.pnr === 'NOT SET') missing.push('PRN')
            if (!profile.phoneNumber || !profile.phoneNumber.trim()) missing.push('Phone Number')
            if (!profile.branch || !profile.branch.trim() || profile.branch.toLowerCase().includes('unassigned')) missing.push('Branch')
            if (!profile.classYear || !profile.classYear.trim()) missing.push('Year')
            if (!profile.division || !profile.division.trim()) missing.push('Division')
            if (missing.length === 0) return null
            return (
              <div style={{ padding: '14px 20px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, animation: 'fadeUp 0.3s ease', borderRadius: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#92400e', fontWeight: 700 }}>
                    Your profile is incomplete! Missing: <u>{missing.join(', ')}</u>. Please complete all details.
                  </span>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{ padding: '6px 14px', borderRadius: 6, background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                >
                  Edit Profile Now →
                </button>
              </div>
            )
          })()}

          {/* ── VIEW MODE ── */}
          {!isEditing ? (
            <div style={{ backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', overflow: 'hidden', animation: 'fadeUp 0.3s ease' }}>
              {/* 3px accent bar */}
              <div style={{ height: 3, backgroundColor: 'var(--color-slate-blue)' }} />

              <div style={{ padding: '28px 32px' }}>

                {/* Avatar + Name */}
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 28 }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      width: 80, height: 80, overflow: 'hidden',
                      backgroundColor: 'var(--color-cream)',
                      border: '2px solid var(--color-sand)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {viewAvatar
                        ? <img src={viewAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, color: 'var(--color-slate-blue)' }}>{initials}</span>
                      }
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
                        {profile?.name || user.name}
                      </h2>
                      {profile?.pnr && (
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--color-slate-blue)', padding: '3px 10px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)' }}>
                          PRN: {profile.pnr}
                        </span>
                      )}
                    </div>

                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
                      {profile?.branch ? getShortBranch(profile.branch) : 'Branch not set'}{profile?.division ? ` · Div ${profile.division}` : ''}
                    </p>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {profile?.classYear && (
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 10px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }}>
                          {profile.classYear}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 10px', backgroundColor: 'var(--color-slate-blue)', color: 'var(--color-white)', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }}>
                        {user.role === 'admin' ? 'Administrator' : 'Student'}
                      </span>
                      {profile?.scannerAccess && (
                        <Link
                          to="/qr-scanner"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            padding: '3px 10px',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            fontFamily: 'var(--font-body)',
                            textTransform: 'uppercase',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            borderRadius: 4,
                          }}
                        >
                          📷 Open QR Scanner →
                        </Link>
                      )}
                    </div>

                    {profile?.bio && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', margin: '12px 0 0', lineHeight: 1.65, maxWidth: 460 }}>
                        {profile.bio}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    style={{ flexShrink: 0, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid var(--color-sand)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                </div>

                {/* Divider */}
                <div style={{ height: 1, backgroundColor: 'var(--color-cream)', marginBottom: 24 }} />

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 0, border: '1px solid var(--color-cream)' }}>
                  {[
                    { label: 'Student PRN', value: profile?.pnr || '—' },
                    { label: 'Class Year', value: profile?.classYear || '—' },
                    { label: 'Division', value: profile?.division || '—' },
                    { label: 'Branch', value: profile?.branch ? getShortBranch(profile.branch) : '—' },
                    { label: 'Phone Number', value: profile?.phoneNumber || '—' },
                    { label: 'Contact Email', value: profile?.contactEmail || user.email },
                    { label: 'Account Email', value: user.email },
                  ].map(({ label, value }, i) => (
                    <div key={i} style={{
                      padding: '16px 18px',
                      backgroundColor: 'var(--color-bg)',
                      borderRight: '1px solid var(--color-cream)',
                      borderBottom: '1px solid var(--color-cream)',
                    }}>
                      <SectionLabel>{label}</SectionLabel>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: value === '—' ? 'var(--color-sand)' : 'var(--color-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>{value}</p>
                    </div>
                  ))}
                </div>

                {!profile && (
                  <div style={{ marginTop: 18, padding: '14px 18px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                    Your profile hasn't been set up yet. Click <strong style={{ color: 'var(--color-slate-blue)' }}>Edit</strong> to get started.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── EDIT MODE ── */
            <div style={{ backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', overflow: 'hidden', animation: 'fadeUp 0.25s ease' }}>
              <div style={{ height: 3, backgroundColor: 'var(--color-slate-blue)' }} />
              <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Edit header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <SectionLabel>Editing</SectionLabel>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-text-primary)', margin: 0 }}>Profile & Avatar</h2>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-sand)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Edit Mode</span>
                </div>

                {/* Avatar section */}
                <div style={{ padding: '20px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)' }}>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Preview */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 64, height: 64, overflow: 'hidden', backgroundColor: 'var(--color-cream)', border: '2px solid var(--color-sand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {avatarPreview
                          ? <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--color-slate-blue)' }}>{initials}</span>
                        }
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {avatarPreview ? 'Selected' : 'Initials'}
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                        {[{ key: 'presets', label: 'Gallery' }, { key: 'generate', label: 'Random' }, { key: 'upload', label: 'Upload' }].map(t => (
                          <button key={t.key} type="button" onClick={() => {
                            setAvatarTab(t.key as any)
                            if (t.key === 'generate' && !generatedSeed) handleGenerateRandomAvatar()
                            if (t.key === 'upload') fileInputRef.current?.click()
                          }} style={{
                            padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
                            backgroundColor: avatarTab === t.key ? 'var(--color-slate-blue)' : 'transparent',
                            border: '1px solid var(--color-sand)',
                            color: avatarTab === t.key ? 'var(--color-white)' : 'var(--color-text-secondary)',
                            transition: 'all 0.15s',
                          }}>{t.label}</button>
                        ))}
                        <button onClick={handleClearAvatar} style={{ padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', backgroundColor: 'transparent', border: '1px solid var(--color-cream)', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                          Remove
                        </button>
                      </div>

                      {avatarTab === 'presets' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6 }}>
                          {PRESET_AVATARS.map(av => (
                            <button key={av.id} className="av-pick" type="button" onClick={() => handleSelectPresetAvatar(av.url)} title={av.name} style={{ padding: 3, borderRadius: '50%', aspectRatio: '1', cursor: 'pointer', backgroundColor: 'var(--color-white)', border: avatarPreview === av.url ? '2px solid var(--color-slate-blue)' : '1px solid var(--color-cream)' }}>
                              <img src={av.url} alt={av.name} style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'block' }} />
                            </button>
                          ))}
                        </div>
                      )}
                      {avatarTab === 'generate' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)' }}>
                          <div>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 3px' }}>Generate Unique Avatar</p>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>Cryptographic SVG based on your profile seed</p>
                          </div>
                          <button type="button" onClick={handleGenerateRandomAvatar} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--color-slate-blue)', border: 'none', color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>
                            Roll New
                          </button>
                        </div>
                      )}
                      {avatarTab === 'upload' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)' }}>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                            {avatarFile ? `${avatarFile.name} (${(avatarFile.size / 1024).toFixed(1)} KB)` : 'PNG, JPG or GIF'}
                          </p>
                          <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--color-slate-blue)', border: 'none', color: 'var(--color-white)', fontFamily: 'var(--font-body)' }}>
                            Choose File
                          </button>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFileUpload} />
                    </div>
                  </div>
                </div>

                {/* Fields grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  <div>
                    <SectionLabel>Display Name *</SectionLabel>
                    <input className="inp-field" type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your full name" style={inp} />
                  </div>
                  <div>
                    <SectionLabel>PRN</SectionLabel>
                    <input className="inp-field" type="text" value={editPnr} onChange={e => setEditPnr(e.target.value.toUpperCase())} placeholder="e.g. 2024CS0129" style={{ ...inp, textTransform: 'uppercase', fontFamily: 'monospace' }} />
                  </div>
                  <div>
                    <SectionLabel>Class Year</SectionLabel>
                    <div style={{ position: 'relative' }}>
                      <select className="inp-field" value={editYear} onChange={e => setEditYear(e.target.value as ClassYear)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                        {CLASS_YEARS.map(y => <option key={y} value={y} style={{ backgroundColor: 'var(--color-white)' }}>{y}</option>)}
                      </select>
                      <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>
                  </div>
                  <div>
                    <SectionLabel>Division</SectionLabel>
                    <input className="inp-field" type="text" value={editDivision} onChange={e => setEditDivision(e.target.value.toUpperCase())} placeholder="e.g. A / B / 01" style={{ ...inp, textTransform: 'uppercase' }} />
                  </div>
                </div>

                <div>
                  <SectionLabel>Branch / Department</SectionLabel>
                  <div style={{ position: 'relative' }}>
                    <select className="inp-field" value={editBranch} onChange={e => setEditBranch(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                      {PRESET_BRANCHES.map(b => <option key={b} value={b} style={{ backgroundColor: 'var(--color-white)' }}>{b}</option>)}
                    </select>
                    <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                </div>

                <div>
                  <SectionLabel>Contact Email</SectionLabel>
                  <input className="inp-field" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Visible to team members" style={inp} />
                </div>

                <div>
                  <SectionLabel>Phone Number *</SectionLabel>
                  <input className="inp-field" type="tel" value={editPhoneNumber} onChange={e => setEditPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit phone number" style={inp} />
                </div>

                <div>
                  <SectionLabel>Short Bio (Optional)</SectionLabel>
                  <textarea className="inp-field" value={editBio} onChange={e => setEditBio(e.target.value)} rows={2} placeholder="Your tech stack, interests, hackathon goals..." style={{ ...inp, resize: 'vertical' }} />
                </div>

                {/* Save / Cancel */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-cream)' }}>
                  <button type="button" onClick={handleCancel} disabled={saving} style={{ padding: '10px 22px', fontSize: 13, backgroundColor: 'transparent', border: '1px solid var(--color-sand)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '10px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--color-slate-blue)', border: 'none', color: 'var(--color-white)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
                    {saving && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
                    {saving ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Security & Password ── */}
          <div style={{ backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', overflow: 'hidden' }}>
            <div style={{ height: 3, backgroundColor: 'var(--color-dusty-blue)' }} />

            {/* Header toggle */}
            <div
              onClick={() => setPasswordSectionOpen(v => !v)}
              style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', borderBottom: passwordSectionOpen ? '1px solid var(--color-cream)' : 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, border: '1px solid var(--color-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-slate-blue)', backgroundColor: 'var(--color-bg)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <SectionLabel>Security & Access</SectionLabel>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text-primary)', margin: 0 }}>Change Password</h3>
                </div>
              </div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 14, transition: 'transform 0.2s', display: 'inline-block', transform: passwordSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            </div>

            {/* Form */}
            {passwordSectionOpen && (
              <form onSubmit={handlePasswordChange} style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {passwordSuccess && (
                  <div style={{ padding: '12px 16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)', borderLeft: '3px solid var(--color-slate-blue)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-slate-blue)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-slate-blue)', fontWeight: 600 }}>{passwordSuccess}</span>
                  </div>
                )}
                {passwordError && (
                  <div style={{ padding: '12px 16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-cream)', borderLeft: '3px solid #b91c1c', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{passwordError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {/* Current */}
                  <div>
                    <SectionLabel>Current Password (Optional)</SectionLabel>
                    <div style={{ position: 'relative' }}>
                      <input className="inp-field" type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" style={{ ...inp, paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowCurrentPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 13, padding: 4 }}>{showCurrentPassword ? '👁' : '👁‍🗨'}</button>
                    </div>
                  </div>

                  {/* New */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <SectionLabel>New Password *</SectionLabel>
                      {newPassword && <span style={{ fontSize: 9, fontFamily: 'var(--font-body)', fontWeight: 700, color: newPassword.length >= 6 ? 'var(--color-slate-blue)' : '#b91c1c' }}>{newPassword.length >= 6 ? '✓ 6+ chars' : 'Too short'}</span>}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input className="inp-field" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" required style={{ ...inp, paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowNewPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 13, padding: 4 }}>{showNewPassword ? '👁' : '👁‍🗨'}</button>
                    </div>
                  </div>

                  {/* Confirm */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <SectionLabel>Confirm New Password *</SectionLabel>
                      {confirmPassword && <span style={{ fontSize: 9, fontFamily: 'var(--font-body)', fontWeight: 700, color: newPassword === confirmPassword ? 'var(--color-slate-blue)' : '#b91c1c' }}>{newPassword === confirmPassword ? '✓ Matches' : '✕ No match'}</span>}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input className="inp-field" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" required style={{ ...inp, paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 13, padding: 4 }}>{showConfirmPassword ? '👁' : '👁‍🗨'}</button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--color-cream)' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                    Use at least 6 characters with letters, numbers, and symbols.
                  </p>
                  <button
                    type="submit"
                    disabled={passwordLoading || !newPassword || !confirmPassword}
                    style={{
                      padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: (passwordLoading || !newPassword || !confirmPassword) ? 'not-allowed' : 'pointer',
                      backgroundColor: (newPassword && confirmPassword && newPassword === confirmPassword) ? 'var(--color-slate-blue)' : 'var(--color-sand)',
                      border: 'none',
                      color: (newPassword && confirmPassword && newPassword === confirmPassword) ? 'var(--color-white)' : 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)', display: 'inline-flex', alignItems: 'center', gap: 8,
                      opacity: (passwordLoading || !newPassword || !confirmPassword) ? 0.7 : 1,
                    }}
                  >
                    {passwordLoading ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        Updating…
                      </>
                    ) : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
