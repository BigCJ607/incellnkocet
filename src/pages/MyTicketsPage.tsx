import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { useApp } from '../context/AppContext'
import type { UserTicket, UserProfile, Team } from '../mocks/types'
import { teamService } from '../services/teamService'
import { getShortBranch } from '../utils/formatters'
import { eventService } from '../services/eventService'
import { profileService } from '../services/profileService'
import SubmissionPanel from '../components/layout/SubmissionPanel'

// ── Standard QR Code image component ─────────────────────────────────────────
function QRImage({ data, size = 260, className = '' }: { data: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>('')

  useEffect(() => {
    if (!data) return
    QRCode.toDataURL(data, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#0a0a14',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(url => setSrc(url))
      .catch(err => console.error('QRCode generation error:', err))
  }, [data, size])

  if (!src) {
    return (
      <div style={{ width: size, height: size, background: '#ffffff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #06b6d4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt="QR Code Pass"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', borderRadius: 12, background: '#ffffff' }}
    />
  )
}

// ── Helper function to download Ticket Pass as PNG Image ─────────────────────
async function downloadTicketPass(ticket: UserTicket, profile: UserProfile | null) {
  const canvas = document.createElement('canvas')
  const width = 1200
  const height = 630
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height)
  bgGrad.addColorStop(0, '#0a0a16')
  bgGrad.addColorStop(0.5, '#121226')
  bgGrad.addColorStop(1, '#080812')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // Border & Glow
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)'
  ctx.lineWidth = 4
  ctx.strokeRect(20, 20, width - 40, height - 40)

  // Top Accent Bar
  const topGrad = ctx.createLinearGradient(0, 0, width, 0)
  topGrad.addColorStop(0, '#6366f1')
  topGrad.addColorStop(0.5, '#06b6d4')
  topGrad.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = topGrad
  ctx.fillRect(20, 20, width - 40, 8)

  // Title & Header Text
  ctx.fillStyle = '#22d3ee'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('OFFICIAL EVENT ENTRY PASS · Ecell', 60, 75)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(ticket.eventTitle.toUpperCase(), 60, 135)

  // Event Date & Location
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.font = '20px sans-serif'
  ctx.fillText(`📅 ${ticket.date}   📍 ${ticket.location}`, 60, 180)

  // Divider Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(60, 210)
  ctx.lineTo(720, 210)
  ctx.stroke()

  // Attendee Details Column
  ctx.fillStyle = '#818cf8'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText('ATTENDEE CREDENTIALS', 60, 250)

  const details = [
    { label: 'NAME', val: profile?.name || 'Student' },
    { label: 'EMAIL', val: profile?.contactEmail || 'N/A' },
    { label: 'PRN', val: profile?.pnr || 'N/A' },
    { label: 'BRANCH / YEAR', val: `${getShortBranch(profile?.branch)} · ${profile?.classYear || ''}` },
    { label: 'TEAM', val: ticket.teamName || 'No Team Joined' },
    { label: 'TICKET STATUS', val: ticket.status.toUpperCase() },
    { label: 'PASS ID', val: ticket.id },
  ]

  let startY = 295
  details.forEach(({ label, val }) => {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.8)'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(`${label}:`, 60, startY)

    ctx.fillStyle = '#ffffff'
    ctx.font = '16px sans-serif'
    ctx.fillText(val, 200, startY)

    startY += 38
  })

  // Render QR Code onto Canvas Right Column
  const qrPayload = JSON.stringify({
    passId: ticket.id,
    event: ticket.eventTitle,
    date: ticket.date,
    location: ticket.location,
    status: ticket.status,
    name: profile?.name || 'Student',
    email: profile?.contactEmail || '',
    pnr: profile?.pnr || 'N/A',
    branch: getShortBranch(profile?.branch),
    classYear: profile?.classYear || 'N/A',
    division: profile?.division || 'N/A',
    team: ticket.teamName || 'No Team',
  })

  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 500,
      margin: 1,
      color: { dark: '#0a0a14', light: '#ffffff' },
    })

    const qrImg = new Image()
    qrImg.src = qrDataUrl
    await new Promise(res => { qrImg.onload = res })

    // White QR Container Card
    ctx.fillStyle = '#ffffff'
    ctx.roundRect(790, 110, 340, 340, 16)
    ctx.fill()

    ctx.drawImage(qrImg, 810, 130, 300, 300)

    // QR Label
    ctx.fillStyle = '#22d3ee'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SCAN TO VERIFY ENTRY', 960, 485)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '14px sans-serif'
    ctx.fillText('Authorized Digital Ticket', 960, 515)
    ctx.textAlign = 'left'

  } catch (e) {
    console.error('Download canvas QR error:', e)
  }

  // Trigger File Download
  const link = document.createElement('a')
  link.download = `EventPass-${ticket.eventTitle.replace(/[^a-z0-9]/gi, '_')}-${ticket.id.slice(0, 8)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

// ── Premium Aesthetic QR Box Component ───────────────────────────────────────
function CoolQRBox({ data, size = 260 }: { data: string; size?: number; onClick?: () => void }) {
  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Ambient glow orbs behind card */}
      <div style={{
        position: 'absolute', width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)',
        top: '10%', left: '5%', filter: 'blur(28px)', pointerEvents: 'none',
        animation: 'qrOrb1 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 160, height: 160, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.18) 0%, transparent 70%)',
        bottom: '5%', right: '5%', filter: 'blur(24px)', pointerEvents: 'none',
        animation: 'qrOrb2 7s ease-in-out infinite',
      }} />

      {/* Rotating gradient border ring */}
      <div style={{
        position: 'relative', padding: 2, borderRadius: 20,
        background: 'linear-gradient(135deg, #6366f1, #22d3ee, #8b5cf6, #6366f1)',
        backgroundSize: '300% 300%',
        boxShadow: '0 0 32px rgba(99,102,241,0.35), 0 0 60px rgba(34,211,238,0.15)',
      }}>
        {/* Frosted glass inner card */}
        <div style={{
          borderRadius: 18,
          background: 'linear-gradient(145deg, rgba(18,18,32,0.97), rgba(12,12,24,0.99))',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}>
          {/* QR itself — white bg with subtle purple shadow glow */}
          <div style={{
            borderRadius: 12,
            background: '#ffffff',
            padding: 10,
            boxShadow: '0 8px 48px rgba(99,102,241,0.45), 0 2px 12px rgba(0,0,0,0.6)',
          }}>
            <QRImage data={data} size={size} />
          </div>
        </div>
      </div>
    </div>
  )
}

function PassCard({
  ticket,
  profile,
  onSubmit,
  onCancel,
  onOpenQRModal,
  cancelling,
  isLeader,
  hasTeam,
}: {
  ticket: UserTicket
  profile: UserProfile | null
  onSubmit: (t: UserTicket) => void
  onCancel: (t: UserTicket) => void
  onOpenQRModal: (t: UserTicket) => void
  cancelling: boolean
  isLeader: boolean
  hasTeam: boolean
}) {
  const [downloading, setDownloading] = useState(false)
  const isConfirmed = ticket.status === 'Confirmed'
  const submissionsOpen = !!ticket.submissionsEnabled && isConfirmed

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadTicketPass(ticket, profile)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="w-full max-w-[850px] mx-auto rounded-xl bg-white border border-[#e2dfd7] my-8 shadow-sm flex flex-col font-body relative overflow-hidden">
      
      {/* Background Watermark */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 select-none opacity-60">
        <span className="font-display font-black text-[8rem] sm:text-[12rem] text-[#eaf8f8] tracking-widest rotate-[-4deg] whitespace-nowrap">
          PASSES
        </span>
      </div>

      <div className="p-8 sm:p-12 flex flex-col gap-8 relative z-10">
        {/* Event Info */}
        <div className="flex flex-col gap-2 text-center sm:text-left relative">
          {ticket.status === 'Confirmed' && (
            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-[#eaf8f8] text-[#13807d] rounded-full text-[10px] font-bold tracking-widest uppercase self-center sm:self-start mb-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              CONFIRMED
            </div>
          )}
          <h2 className="font-body text-4xl sm:text-5xl font-black text-[#1a232c] leading-tight tracking-tighter">
            {ticket.eventTitle}
          </h2>
          <div className="text-[12px] font-bold text-[#5c6873] uppercase tracking-widest flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-3 mt-3">
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {ticket.date}
            </span>
            <span className="text-[#e2dfd7]">|</span>
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {ticket.location}
            </span>
            <span className="text-[#e2dfd7]">|</span>
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {ticket.teamName ? `TEAM: ${ticket.teamName}` : 'NO TEAM JOINED'}
            </span>
            <span className="text-[#e2dfd7]">|</span>
            <span className="flex items-center gap-2">
              PASS: <span className="text-[#10b981] font-extrabold bg-[#ecfdf5] px-1.5 py-0.5 rounded">ACTIVE</span>
            </span>
          </div>
        </div>

        <div className="w-full border-t border-dashed border-[#e2dfd7] my-2"></div>

        {/* Attendee Info */}
        {profile && (
          <div className="flex items-center justify-center sm:justify-start gap-5 text-left bg-[#f9f8f5] p-6 rounded-lg border border-[#f0ede6]">
             <div className="w-16 h-16 rounded-full bg-[#e8e6f9] flex items-center justify-center text-2xl font-display text-[#5a4897] flex-shrink-0">
               {(profile.name?.charAt(0) || '?').toUpperCase()}
             </div>
             <div className="flex-1 min-w-0">
               <div className="text-lg font-bold text-[#1a232c] truncate">
                 {profile.name}
               </div>
               <div className="text-[13px] text-[#5c6873] mt-1 truncate">
                 {[getShortBranch(profile.branch), profile.classYear, profile.division && `Div ${profile.division}`].filter(Boolean).join(' · ')}
               </div>
               {profile.pnr && (
                 <div className="text-[13px] text-[#5c6873] mt-1">
                   PRN: {profile.pnr}
                 </div>
               )}
             </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-4 mt-2">
          {submissionsOpen ? (
            isLeader ? (
              <button
                onClick={() => onSubmit(ticket)}
                className="w-full min-h-[56px] rounded-lg flex items-center justify-center gap-2 text-[13px] font-bold tracking-widest uppercase bg-[#136280] hover:bg-[#0f4e66] text-white transition-all shadow-sm cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                SUBMIT PROJECT (TEAM LEADER)
              </button>
            ) : hasTeam ? (
              <div className="w-full min-h-[48px] px-4 rounded-lg flex items-center justify-center text-[12px] font-bold tracking-wider uppercase bg-[#f8fafc] text-slate-500 border border-slate-200 gap-2">
                <span style={{ fontSize: 14 }}>👑</span>
                <span>Only Team Leader Can Submit Project</span>
              </div>
            ) : (
              <div className="w-full min-h-[48px] px-4 rounded-lg flex items-center justify-center text-[12px] font-bold tracking-wider uppercase bg-[#f8fafc] text-slate-500 border border-slate-200 gap-2">
                <span style={{ fontSize: 14 }}>👑</span>
                <span>Only Team Leader Can Submit Project</span>
              </div>
            )
          ) : (
            <button disabled className="w-full min-h-[56px] rounded-lg flex items-center justify-center text-[13px] font-bold tracking-widest uppercase bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200">
              SUBMISSIONS CLOSED
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             <Link to={`/events/${ticket.eventId}`} className="w-full min-h-[48px] rounded-lg text-[11px] flex items-center justify-center gap-2 font-bold tracking-widest uppercase bg-white text-[#2a3844] border border-[#e2dfd7] hover:bg-slate-50 transition-all no-underline">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
               VIEW DETAILS
             </Link>
             <button onClick={() => onOpenQRModal(ticket)} className="w-full min-h-[48px] rounded-lg text-[11px] flex items-center justify-center gap-2 font-bold tracking-widest uppercase bg-white text-[#2a3844] border border-[#e2dfd7] hover:bg-slate-50 transition-all cursor-pointer">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
               VIEW QR CODE
             </button>
             <button onClick={handleDownload} disabled={downloading} className="w-full min-h-[48px] rounded-lg text-[11px] flex items-center justify-center gap-2 font-bold tracking-widest uppercase bg-white text-[#2a3844] border border-[#e2dfd7] hover:bg-slate-50 transition-all disabled:opacity-50 cursor-pointer">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
               {downloading ? 'SAVING...' : 'DOWNLOAD PASS'}
             </button>
          </div>

          <div className="flex justify-center pt-8 mt-2">
            <button onClick={() => onCancel(ticket)} disabled={cancelling} className="min-h-[40px] px-6 text-[#dc3545] hover:text-[#b02a37] text-[12px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              {cancelling ? 'CANCELLING...' : 'UNENROLL FROM EVENT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── QR Code Pop Up Modal (Cool Holographic & Scannable QR Display) ──────────
function QRPassModal({
  ticket,
  profile,
  onClose,
}: {
  ticket: UserTicket
  profile: UserProfile | null
  onClose: () => void
}) {
  const [downloading, setDownloading] = useState(false)

  const qrPayload = JSON.stringify({
    passId: ticket.id,
    event: ticket.eventTitle,
    date: ticket.date,
    location: ticket.location,
    status: ticket.status,
    name: profile?.name || 'Student',
    email: profile?.contactEmail || '',
    pnr: profile?.pnr || 'N/A',
    branch: getShortBranch(profile?.branch),
    classYear: profile?.classYear || 'N/A',
    division: profile?.division || 'N/A',
    team: ticket.teamName || 'No Team',
    role: profile?.role || 'student',
  })

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadTicketPass(ticket, profile)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5,5,15,0.92)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        animation: 'fadeIn 0.2s ease', cursor: 'pointer',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460, borderRadius: 24, overflow: 'hidden',
          background: '#11111d',
          border: '1px solid rgba(34,211,238,0.4)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.9), 0 0 60px rgba(34,211,238,0.2)',
          position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
          cursor: 'default',
        }}
      >
        {/* Modal Top Header */}
        <div style={{
          width: '100%', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)', boxSizing: 'border-box',
        }}>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.2em', color: '#22d3ee', fontWeight: 700, margin: 0 }}>
              VERIFIED ENTRY QR PASS
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#ffffff', margin: 0, fontWeight: 700 }}>
              {ticket.eventTitle}
            </h2>
          </div>

          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#ffffff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Modal Body: Premium QR */}
        <div style={{ padding: '36px 32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, width: '100%', boxSizing: 'border-box' }}>
          <CoolQRBox data={qrPayload} size={240} />

          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)',
              fontFamily: 'var(--font-ui)', margin: 0,
            }}>
              All credentials encoded · Present this pass at entry
            </p>
          </div>
        </div>

        {/* Modal Footer with Download Button */}
        <div style={{
          width: '100%', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'rgba(0,0,0,0.3)', boxSizing: 'border-box',
        }}>
          <button onClick={handleDownload} disabled={downloading} style={{
            padding: '9px 18px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
            color: '#34d399', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {downloading ? 'Downloading…' : 'Download Pass (PNG)'}
          </button>

          <button onClick={onClose} style={{
            padding: '9px 20px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
            background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.4)',
            color: '#22d3ee', fontFamily: 'var(--font-ui)',
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function MyTicketsPage() {
  const { tickets, loading, user, refreshTickets } = useApp()
  const [submittingTicket, setSubmittingTicket] = useState<UserTicket | null>(null)
  const [qrModalTicket, setQrModalTicket] = useState<UserTicket | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userTeams, setUserTeams] = useState<Team[]>([])

  useEffect(() => {
    if (user?.id) {
      profileService.getProfile(user.id).then(p => { if (p) setProfile(p) })
      teamService.getUserTeams(user.id).then(teams => setUserTeams(teams))
    }
  }, [user?.id])

  const handleCancelTicket = async (ticket: UserTicket) => {
    if (!window.confirm(`Unenroll from "${ticket.eventTitle}"? Your pass will be cancelled.`)) return
    setCancellingId(ticket.id)
    try { await eventService.cancelTicket(ticket.id); await refreshTickets() }
    catch (err: any) { alert(`Failed: ${err.message}`) }
    finally { setCancellingId(null) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', gap: 16 }}>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)' }}>ACCESS RESTRICTED</p>
      <Link to="/auth" className="btn-primary" style={{ padding: '12px 32px', textDecoration: 'none', borderRadius: 10 }}>Sign In</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f9f8f5] pb-24 sm:pb-32 overflow-x-hidden relative" style={{ paddingTop: 'calc(var(--nav-h) + 2rem)' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:translateY(0)} }
      `}</style>
      
      {/* Background Dots Pattern (Subtle) */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(#e2dfd7 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }}></div>

      <div className="page-container w-full relative z-10 max-w-[850px] mx-auto px-4 sm:px-8">

        {/* Page Header */}
        <div className="py-8 sm:py-12 mb-8 relative flex flex-col gap-4">
          <div className="flex flex-col items-start gap-2 border-l-[3px] border-[#136280] pl-5">
            <p className="font-body text-[11px] font-bold tracking-[0.2em] text-[#5c6873] uppercase mb-1 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {user.name.toUpperCase()} · PASSES · DASHBOARD
            </p>
            <Link to="/events" className="mt-2 inline-flex items-center gap-2 text-[12px] font-bold text-[#136280] hover:text-[#0f4e66] tracking-widest uppercase transition-colors no-underline">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              RETURN TO EVENTS
            </Link>
          </div>
          
          {/* Decorative Divider */}
          <div className="flex items-center justify-center w-full mt-6 opacity-60">
            <div className="flex-1 h-px bg-[#e2dfd7]"></div>
            <div className="mx-4 text-[#e2dfd7]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" transform="rotate(45 12 12)" transform-origin="center"/></svg>
            </div>
            <div className="flex-1 h-px bg-[#e2dfd7]"></div>
          </div>
        </div>

        {/* Tickets List */}
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center py-20 px-10 rounded-xl border border-dashed border-[#e2dfd7] bg-white shadow-sm animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-[#eaf8f8] border border-[#b2dfdb] flex items-center justify-center text-[#13807d] shadow-sm">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 1-2 2v2z"/>
              </svg>
            </div>
            <div className="mt-2">
              <h2 className="font-display text-3xl font-bold text-[#1a232c] mb-3">No Passes Yet</h2>
              <p className="font-body text-[15px] text-[#5c6873] mb-8 max-w-sm mx-auto">Register for an upcoming event to receive your verified digital entry pass.</p>
              <Link to="/events" className="inline-flex items-center justify-center min-h-[48px] bg-[#136280] hover:bg-[#0f4e66] text-white rounded-lg text-[13px] font-bold px-8 uppercase tracking-widest transition-all shadow-sm no-underline">Browse Events</Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-12 sm:gap-16">
            {tickets.map((ticket) => {
              const eventTeam = userTeams.find(
                t => t.eventId === ticket.eventId || (ticket.teamName && t.name.toLowerCase() === ticket.teamName.toLowerCase())
              );
              const hasTeam = !!eventTeam || !!ticket.teamName;
              const isLeader = eventTeam ? (eventTeam.createdBy === user?.id) : false;

              return (
                <PassCard
                  key={ticket.id}
                  ticket={ticket}
                  profile={profile}
                  onSubmit={setSubmittingTicket}
                  onCancel={handleCancelTicket}
                  onOpenQRModal={setQrModalTicket}
                  cancelling={cancellingId === ticket.id}
                  isLeader={isLeader}
                  hasTeam={hasTeam}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code Pop Up Modal */}
      {qrModalTicket && (
        <QRPassModal
          ticket={qrModalTicket}
          profile={profile}
          onClose={() => setQrModalTicket(null)}
        />
      )}

      {/* Project Submission Modal */}
      {submittingTicket && (
        <div
          onClick={() => setSubmittingTicket(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: 'rgba(10,10,15,0.88)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 580,
              maxHeight: '88vh',
              overflowY: 'auto',
              position: 'relative',
              borderRadius: 24,
            }}
          >
            {(() => {
              const matchedTeam = userTeams.find(
                t => t.eventId === submittingTicket.eventId || (submittingTicket.teamName && t.name.toLowerCase() === submittingTicket.teamName.toLowerCase())
              );
              const effectiveSubmissionTeamId = matchedTeam ? matchedTeam.id : (submittingTicket.teamName || submittingTicket.id || user?.id || 'guest');

              return (
                <SubmissionPanel
                  eventId={submittingTicket.eventId}
                  eventTitle={submittingTicket.eventTitle}
                  teamId={effectiveSubmissionTeamId}
                  onClose={() => setSubmittingTicket(null)}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
