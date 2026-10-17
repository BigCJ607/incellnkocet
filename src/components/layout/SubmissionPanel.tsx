import { useEffect, useRef, useState } from 'react'
import { useShatter } from '../../hooks/useShatter'
import type { Submission } from '../../mocks/types'
import { submissionService } from '../../services/submissionService'
import { useApp } from '../../context/AppContext'

type PanelState = 'checking' | 'already_submitted' | 'form' | 'submitting' | 'done'
type SubmitMode = 'file' | 'url'

interface SubmissionPanelProps {
  eventId: string
  eventTitle: string
  teamId?: string
  onClose?: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function SubmissionPanel({ eventId, eventTitle, teamId, onClose }: SubmissionPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [panelState, setPanelState] = useState<PanelState>('checking')
  const [submitMode, setSubmitMode] = useState<SubmitMode>('file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<Submission | null>(null)
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [warningAcknowledged, setWarningAcknowledged] = useState(false)
  const { user } = useApp()

  const { state: shatterState, fire: shatterFire } = useShatter(
    panelRef as React.RefObject<HTMLElement>,
    () => {}
  )

  // Check if this team has already submitted
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const subs = await submissionService.getSubmissions(eventId)
        const effectiveTeamId = teamId || (user ? user.id : null)
        if (effectiveTeamId && subs.length > 0) {
          const idLower = effectiveTeamId.toLowerCase()
          // Flexible match: by teamId prop, user ID, or user name
          const found = subs.find(s =>
            (s.teamId || '').toLowerCase() === idLower ||
            (user && (s.teamId || '').toLowerCase() === user.id.toLowerCase())
          )
          if (found) {
            setExistingSubmission(found)
            setPanelState('already_submitted')
            return
          }
        }
      } catch (e) { /* ignore */ }
      setPanelState('form')
    }
    checkExisting()
  }, [eventId, teamId, user])

  const handleFile = (file: File) => {
    setErrors(prev => ({ ...prev, file: '', url: '', general: '' }))
    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    const hasFile = Boolean(selectedFile)
    const hasUrl = Boolean(urlInput.trim())

    if (!hasFile && !hasUrl) {
      if (submitMode === 'file') {
        errs.file = 'Please upload a project document / file (or switch to URL to provide a link).'
      } else {
        errs.url = 'Please enter a project URL (or switch to File to upload a deliverable).'
      }
    }

    if (hasUrl && !urlInput.trim().startsWith('http://') && !urlInput.trim().startsWith('https://')) {
      errs.url = 'Please enter a valid URL starting with http:// or https://'
    }

    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSubmitError('')
    setPanelState('submitting')

    try {
      const effectiveTeamId = teamId || (user ? user.id : 'guest')
      const submission = await submissionService.submitProject(effectiveTeamId, eventId, {
        file: selectedFile,
        repoUrl: urlInput.trim(),
        description: description.trim(),
      })

      setResult(submission)
      shatterFire()
      setTimeout(() => setPanelState('done'), 1200)
    } catch (err: any) {
      console.error('Submission failed', err)
      setSubmitError(err?.message || 'Submission failed. Please try again.')
      setPanelState('form')
    }
  }

  /* ── CHECKING STATE ─────────────────────────────────────────────── */
  if (panelState === 'checking') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-ui)' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        Checking submission status...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── ALREADY SUBMITTED STATE ─────────────────────────────────────── */
  if (panelState === 'already_submitted' && existingSubmission) {
    const hasSeparateUrl = existingSubmission.repoUrl &&
      (existingSubmission.repoUrl.startsWith('http') || existingSubmission.repoUrl.includes('.')) &&
      existingSubmission.repoUrl !== existingSubmission.fileUrl;

    return (
      <div
        className="p-6 sm:p-8 rounded-3xl flex flex-col gap-5 text-left"
        style={{
          border: '1px solid rgba(34,211,238,0.4)',
          background: 'linear-gradient(145deg, #131722 0%, #0c0f17 100%)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.85)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,211,238,0.15)', border: '2px solid #22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            ✅
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: '#22d3ee', margin: 0 }}>SUBMISSION LOCKED IN</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#ffffff', margin: 0 }}>Project Already Submitted</h2>
          </div>
        </div>

        <div style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.14em', margin: 0 }}>SUBMITTED DELIVERABLES</p>
          
          {/* File Deliverable */}
          {existingSubmission.fileName && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 20 }}>📦</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#ffffff', fontWeight: 700, margin: 0, wordBreak: 'break-all' }}>
                    {existingSubmission.fileName}
                  </p>
                  {existingSubmission.fileSize ? (
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
                      {formatBytes(existingSubmission.fileSize)}
                    </p>
                  ) : null}
                </div>
              </div>
              {(existingSubmission.fileUrl || existingSubmission.fileData) && (
                <a
                  href={existingSubmission.fileUrl || existingSubmission.fileData}
                  download={existingSubmission.fileName}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    background: 'rgba(34,211,238,0.15)',
                    border: '1px solid #22d3ee',
                    color: '#22d3ee',
                    fontFamily: 'var(--font-ui)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  📥 Download File
                </a>
              )}
            </div>
          )}

          {/* Project URL / Repository */}
          {hasSeparateUrl && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 18 }}>🔗</span>
                <a
                  href={existingSubmission.repoUrl.startsWith('http') ? existingSubmission.repoUrl : `https://${existingSubmission.repoUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily: 'monospace', fontSize: 12, color: '#22d3ee', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {existingSubmission.repoUrl}
                </a>
              </div>
              <a
                href={existingSubmission.repoUrl.startsWith('http') ? existingSubmission.repoUrl : `https://${existingSubmission.repoUrl}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  background: 'rgba(99,102,241,0.18)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  color: '#a5b4fc',
                  fontFamily: 'var(--font-ui)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Open Link ↗
              </a>
            </div>
          )}

          {existingSubmission.description && (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#cbd5e1', margin: '4px 0 0', lineHeight: 1.6 }}>
              <em>"{existingSubmission.description}"</em>
            </p>
          )}

          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>
            Submitted: {new Date(existingSubmission.timestamp).toLocaleString()}
          </p>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#fcd34d', margin: 0, lineHeight: 1.6 }}>
            ⚠️ <strong>Submissions are final.</strong> Each team can only submit once. Contact your event organizer if you need to make changes.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '12px 28px',
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.12em',
              borderRadius: 30,
              border: '1px solid rgba(34,211,238,0.5)',
              color: '#22d3ee',
              background: 'rgba(34,211,238,0.12)',
              cursor: 'pointer',
              alignSelf: 'center',
              width: '100%',
              maxWidth: 240,
            }}
          >
            CLOSE
          </button>
        )}
      </div>
    )
  }

  /* ── DONE STATE ─────────────────────────────────────────────── */
  if (panelState === 'done' && result) {
    return (
      <div
        className="p-6 sm:p-10 rounded-3xl flex flex-col items-center text-center"
        style={{
          border: '1px solid rgba(34,211,238,0.4)',
          background: 'linear-gradient(145deg, #131722 0%, #0c0f17 100%)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.85)',
          color: '#ffffff',
          animation: 'fadeInUp 0.4s ease forwards',
        }}
      >
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 mb-5 flex items-center justify-center rounded-full"
          style={{
            border: '2px solid #22d3ee',
            background: 'rgba(34,211,238,0.12)',
            boxShadow: '0 0 30px rgba(34,211,238,0.3)',
          }}
        >
          <span className="font-display text-3xl sm:text-4xl" style={{ color: '#22d3ee' }}>✓</span>
        </div>

        <h2 className="font-display mb-2" style={{ fontSize: 'clamp(1.75rem,5vw,2.5rem)', color: '#ffffff', lineHeight: 1 }}>
          SUBMITTED.
        </h2>
        <p className="font-ui tracking-widest text-xs sm:text-sm mb-5" style={{ color: '#22d3ee', letterSpacing: '0.2em' }}>
          {eventTitle}
        </p>

        <div className="w-full mb-5 p-3.5 sm:p-4 rounded-xl flex flex-col gap-3 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
          {result.fileName && (
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-lg" style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#22d3ee' }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-ui font-semibold text-xs sm:text-sm truncate" style={{ color: '#ffffff', margin: 0 }}>
                    {result.fileName}
                  </p>
                  <p className="font-ui text-[11px] mt-0.5" style={{ color: '#94a3b8', margin: 0 }}>
                    {result.fileSize ? `${formatBytes(result.fileSize)} · ` : ''}
                    File Uploaded
                  </p>
                </div>
              </div>
              <span className="font-ui text-[10px] font-bold tracking-wider px-2 py-1 flex-shrink-0 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>FILE RECEIVED</span>
            </div>
          )}

          {result.repoUrl && result.repoUrl.startsWith('http') && result.repoUrl !== result.fileUrl && (
            <div className="flex items-center justify-between gap-3 min-w-0 pt-2 border-t border-white/10">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-lg" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <span style={{ fontSize: 16 }}>🔗</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-ui font-semibold text-xs sm:text-sm truncate" style={{ color: '#22d3ee', margin: 0 }}>
                    {result.repoUrl}
                  </p>
                  <p className="font-ui text-[11px] mt-0.5" style={{ color: '#94a3b8', margin: 0 }}>
                    Project URL Saved
                  </p>
                </div>
              </div>
              <span className="font-ui text-[10px] font-bold tracking-wider px-2 py-1 flex-shrink-0 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>LINK SAVED</span>
            </div>
          )}
        </div>

        <p className="text-xs sm:text-sm mb-6" style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
          Your project is locked in. Judges and administrators will review your deliverables after the deadline closes.
        </p>

        {onClose && (
          <button
            onClick={onClose}
            className="font-ui font-extrabold text-xs sm:text-sm tracking-widest px-8 py-3.5 rounded-full shadow-lg"
            style={{ border: '1px solid rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.15)', cursor: 'pointer', letterSpacing: '0.12em' }}
          >
            CLOSE
          </button>
        )}
      </div>
    )
  }

  /* ── FORM / SUBMITTING STATE ────────────────────────────────── */
  const bothAttached = Boolean(selectedFile && urlInput.trim())

  return (
    <div
      ref={panelRef}
      className="p-6 sm:p-10 rounded-3xl relative w-[calc(100vw-24px)] sm:w-full max-w-[680px] mx-auto box-border max-h-[90vh] overflow-y-auto bg-[#FAFAF9] shadow-xl border border-slate-200"
      style={{
        visibility: shatterState === 'shattering' ? 'hidden' : 'visible',
      }}
    >
      {/* Header — Eyebrow & Title */}
      <div className="mb-6 text-left">
        <p className="font-ui font-bold tracking-[0.2em] text-[10px] sm:text-xs mb-2 text-cyan-600 uppercase">
          PROJECT SUBMISSION · {eventTitle}
        </p>
        <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900 leading-tight m-0">
          SUBMIT YOUR <span className="text-cyan-600">DELIVERABLES</span>
        </h2>
      </div>

      {/* ⚠️ ONE-TIME SUBMISSION WARNING */}
      {!warningAcknowledged ? (
        <div
          className="p-5 sm:p-6 rounded-2xl mb-6 text-left border border-slate-200 bg-white shadow-sm relative overflow-hidden"
        >
          {/* Amber Accent Top Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-400"></div>
          
          <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 border border-amber-100 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500 sm:w-6 sm:h-6">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h3 className="font-display text-lg sm:text-xl text-slate-900 m-0 mb-1 font-extrabold tracking-wide">
                Read Before Submitting
              </h3>
              <p className="font-ui text-xs sm:text-sm text-slate-500 m-0">Please review these submission guidelines carefully.</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 sm:p-5 mb-5 border border-slate-100">
            <ul className="font-ui text-[13px] sm:text-sm text-slate-700 m-0 pl-4 sm:pl-5 leading-relaxed flex flex-col gap-2.5">
              <li><strong className="text-slate-900">You can only submit once.</strong> Submissions are final and locked in upon completion.</li>
              <li>Only the <strong className="text-slate-900">team captain</strong> can submit on behalf of the team.</li>
              <li>All document types are accepted: <strong className="text-cyan-700">PPT, PPTX, PDF, DOCX, Word, Excel, CSV, ZIP, RAR, Images (PNG/JPG/SVG)</strong>, and more.</li>
              <li>You can upload a file, paste a project URL (GitHub / Google Drive / Live Demo), or <strong className="text-slate-900">submit BOTH together</strong>.</li>
            </ul>
          </div>
          
          <button
            onClick={() => setWarningAcknowledged(true)}
            className="w-full min-h-[48px] sm:min-h-[50px] py-3.5 px-4 sm:px-6 rounded-xl text-[12px] sm:text-[13px] font-extrabold font-ui tracking-wider uppercase text-white cursor-pointer flex items-center justify-center transition-all shadow-md border-none bg-cyan-600 hover:bg-cyan-700 text-center leading-tight"
          >
            I UNDERSTAND — PROCEED TO SUBMIT
          </button>
        </div>
      ) : (
        <>
          {/* Info Banner */}
          <div className="mb-5 p-4 rounded-xl flex items-start gap-3 text-left bg-blue-50 border border-blue-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan-600 mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            <div className="font-ui text-[13px] sm:text-sm leading-relaxed text-slate-700 m-0">
              <p className="m-0">
                Upload your document <strong>(PPT, PDF, Word, Excel, ZIP, image)</strong> or provide a <strong>GitHub / Drive URL</strong> (or attach both).
              </p>
              <span className="text-red-500 font-bold block mt-1">This submission is final — you cannot resubmit.</span>
            </div>
          </div>

          {/* Submission Mode Switcher — 2 Tabs (Document/File & URL/GitHub) */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 mb-5">
            <button
              type="button"
              onClick={() => setSubmitMode('file')}
              className={`py-3 px-3 text-[11px] sm:text-xs font-bold tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                submitMode === 'file'
                  ? 'bg-white text-cyan-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 bg-transparent'
              }`}
            >
              <span>📁 DOCUMENT / FILE</span>
              {selectedFile && <span className="bg-cyan-100 text-cyan-700 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">✓ Attached</span>}
            </button>
            <button
              type="button"
              onClick={() => setSubmitMode('url')}
              className={`py-3 px-3 text-[11px] sm:text-xs font-bold tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                submitMode === 'url'
                  ? 'bg-white text-cyan-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 bg-transparent'
              }`}
            >
              <span>🔗 URL / GITHUB</span>
              {urlInput.trim() && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">✓ Attached</span>}
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="text-left flex flex-col gap-5">

            {/* FILE UPLOAD SECTION */}
            {submitMode === 'file' && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="font-ui font-bold text-[11px] tracking-widest block text-slate-700 uppercase">
                    PROJECT DELIVERABLE FILE (PPT, PDF, DOCX, ZIP, EXCEL...)
                  </label>
                  <span className="font-ui text-[10px] text-slate-400 font-semibold">Max 100 MB</span>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.ppt,.pptx,.pot,.potx,.odp,.doc,.docx,.rtf,.odt,.txt,.xls,.xlsx,.csv,.ods,.tsv,.zip,.rar,.7z,.tar,.gz,.bz2,.png,.jpg,.jpeg,.webp,.svg,.gif,.bmp,.json,.md,.mp4,.mov,*"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  disabled={panelState === 'submitting'}
                />

                {selectedFile ? (
                  <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50 flex items-center justify-between gap-3 shadow-sm">
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-lg bg-white border border-cyan-100 shadow-sm text-cyan-600 font-bold text-base">
                      {selectedFile.name.endsWith('.pdf') ? '📕' :
                       selectedFile.name.match(/\.(ppt|pptx)$/i) ? '📊' :
                       selectedFile.name.match(/\.(doc|docx)$/i) ? '📝' :
                       selectedFile.name.match(/\.(xls|xlsx|csv)$/i) ? '📈' :
                       selectedFile.name.match(/\.(zip|rar|7z)$/i) ? '📦' :
                       selectedFile.name.match(/\.(png|jpg|jpeg|webp|svg)$/i) ? '🖼️' : '📄'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-ui font-bold text-[13px] sm:text-sm truncate text-slate-800 m-0">{selectedFile.name}</p>
                      <p className="font-ui text-xs mt-0.5 text-slate-500 m-0">{formatBytes(selectedFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      disabled={panelState === 'submitting'}
                      className="font-ui text-[11px] font-bold tracking-wider px-3 py-2 flex-shrink-0 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer shadow-sm uppercase transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`min-h-[150px] p-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                      isDragging ? 'border-cyan-400 bg-cyan-50' : 'border-slate-300 bg-white hover:border-cyan-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-cyan-50 border border-cyan-100 mb-3 text-cyan-600 shadow-sm">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="font-ui font-semibold text-[13px] sm:text-sm text-slate-700 m-0 mb-1">
                      Drop your file here or <span className="text-cyan-600 underline">browse</span>
                    </p>
                    <p className="font-ui text-[11px] text-slate-500 m-0">
                      All formats supported: <strong>PPT, PDF, Word, Excel, ZIP, Images & docs</strong>
                    </p>
                  </div>
                )}
                {errors.file && <p className="text-[11px] mt-2 text-red-500 m-0 font-semibold">{errors.file}</p>}

                {/* Optional note if URL is also attached */}
                {urlInput.trim() && (
                  <div className="mt-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">🔗</span>
                      <p className="font-ui text-xs text-indigo-900 truncate m-0">
                        <strong>URL also attached:</strong> <span className="font-mono">{urlInput.trim()}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubmitMode('url')}
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-md border border-indigo-200 cursor-pointer flex-shrink-0"
                    >
                      Edit URL
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* URL SECTION */}
            {submitMode === 'url' && (
              <div>
                <label className="font-ui font-bold text-[11px] tracking-widest block mb-2.5 text-slate-700 uppercase">
                  PROJECT / REPOSITORY / DRIVE URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/your-team/project or https://drive.google.com/..."
                  value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); setErrors(prev => ({ ...prev, url: '', file: '' })) }}
                  disabled={panelState === 'submitting'}
                  className="w-full p-4 rounded-xl bg-white border border-slate-300 text-slate-800 text-[13px] sm:text-sm font-ui placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none box-border shadow-sm transition-all"
                />
                {errors.url && <p className="text-[11px] mt-2 text-red-500 m-0 font-semibold">{errors.url}</p>}
                <p className="font-ui text-[11px] text-slate-500 mt-2 m-0">
                  Provide GitHub repository, Google Drive link, Figma design, or live demo deployment.
                </p>

                {/* Optional note if File is also attached */}
                {selectedFile && (
                  <div className="mt-3 p-3 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">📦</span>
                      <p className="font-ui text-xs text-cyan-900 truncate m-0">
                        <strong>File also attached:</strong> {selectedFile.name} ({formatBytes(selectedFile.size)})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubmitMode('file')}
                      className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 bg-white px-2.5 py-1 rounded-md border border-cyan-200 cursor-pointer flex-shrink-0"
                    >
                      Change File
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* BOTH ATTACHED SUMMARY BADGE */}
            {bothAttached && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                <span>✨</span>
                <span>Both your <strong>uploaded file ({selectedFile?.name})</strong> and <strong>project link</strong> will be submitted together!</span>
              </div>
            )}

            {/* DESCRIPTION */}
            <div>
              <label className="font-ui font-bold text-[11px] tracking-widest block mb-2.5 text-slate-700 uppercase">
                PROJECT DESCRIPTION & PITCH <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="submission-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full min-h-[90px] max-h-[130px] p-4 rounded-xl bg-white border border-slate-300 text-slate-800 text-[13px] sm:text-sm font-ui placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none box-border resize-y shadow-sm transition-all"
                placeholder="Briefly describe what your project does, problem solved, and key features..."
                disabled={panelState === 'submitting'}
              />
              <div className="flex justify-end items-center mt-1.5">
                <span className="font-ui text-[11px] font-medium tracking-wide text-slate-400">
                  {description.length} chars
                </span>
              </div>
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="p-4 text-[13px] font-ui font-semibold rounded-xl bg-red-50 border border-red-200 text-red-600 shadow-sm">
                ⚠️ {submitError}
              </div>
            )}

            {/* CANCEL & FINAL SUBMIT ACTION STACK */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 sm:pt-5 border-t border-slate-200 mt-1">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={panelState === 'submitting'}
                  className="w-full sm:w-[140px] min-h-[48px] py-3 px-4 rounded-xl text-[11px] sm:text-xs font-bold font-ui tracking-widest uppercase text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 cursor-pointer flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
                >
                  CANCEL
                </button>
              )}
              <button
                type="submit"
                disabled={panelState === 'submitting'}
                className="w-full min-h-[48px] py-3 px-6 rounded-xl text-[13px] sm:text-sm font-extrabold font-ui tracking-wider uppercase text-white cursor-pointer flex items-center justify-center gap-2.5 transition-all shadow-md border-none flex-1 bg-cyan-600 hover:bg-cyan-700"
                style={{
                  opacity: panelState === 'submitting' ? 0.75 : 1,
                }}
              >
                {panelState === 'submitting' ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    SUBMITTING...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    SUBMIT PROJECT — FINAL
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
