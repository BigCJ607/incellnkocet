import { useState, useEffect, useRef } from 'react'
import { teamService } from '../../services/teamService'
import type { PlatformUserSearchResult } from '../../mocks/types'

const AV_COLORS = [
  ['#6366f1','#818cf8'],['#06b6d4','#22d3ee'],['#8b5cf6','#a78bfa'],
  ['#ec4899','#f472b6'],['#10b981','#34d399'],['#f59e0b','#fbbf24'],
]

function Avatar({ name, size = 38, idx = 0 }: { name: string; size?: number; idx?: number }) {
  const [bg, fg] = AV_COLORS[idx % AV_COLORS.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${bg}55, ${fg}33)`,
      border: `1.5px solid ${fg}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: fg, flexShrink: 0,
    }}>
      {(name.charAt(0) || '?').toUpperCase()}
    </div>
  )
}

interface Props {
  teamId: string
  captainId: string
  teamName: string
  existingMemberIds: string[]
  onClose: () => void
}

export default function InviteModal({ teamId, captainId, teamName, existingMemberIds, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlatformUserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, 'pending' | 'accepted' | 'rejected' | 'loading'>>({})
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    teamService.getTeamInviteStatuses(teamId).then(statuses => {
      setInviteStatuses(prev => ({ ...prev, ...statuses } as Record<string, 'pending' | 'accepted' | 'rejected' | 'loading'>))
    })
  }, [teamId])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const found = await teamService.searchPlatformUsers(query)
        setResults(found.filter(u => u.id !== captainId && !existingMemberIds.includes(u.id)))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, captainId, existingMemberIds])

  const handleInvite = async (user: PlatformUserSearchResult) => {
    setError('')
    setInviteStatuses(prev => ({ ...prev, [user.id]: 'loading' }))
    try {
      await teamService.sendInvitation(teamId, captainId, user.id)
      setInviteStatuses(prev => ({ ...prev, [user.id]: 'pending' }))
    } catch (err: any) {
      setError(err.message || 'Failed to send invite.')
      setInviteStatuses(prev => { const n = { ...prev }; delete n[user.id]; return n })
    }
  }

  const statusLabel = (userId: string): { label: string; color: string; canInvite: boolean } => {
    const s = inviteStatuses[userId]
    if (s === 'loading') return { label: 'Sending...', color: '#9ca3af', canInvite: false }
    if (s === 'pending') return { label: '✓ Invited', color: '#34d399', canInvite: false }
    if (s === 'accepted') return { label: '✓ In Team', color: '#22d3ee', canInvite: false }
    if (s === 'rejected') return { label: '↻ Re-invite', color: '#f59e0b', canInvite: true }
    return { label: 'Send Invite', color: '#818cf8', canInvite: true }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'linear-gradient(145deg, rgba(14,14,24,0.98), rgba(10,10,18,0.98))',
        border: '1px solid rgba(129,140,248,0.25)',
        borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(99,102,241,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-ui)', letterSpacing: '0.05em' }}>
                ✉ INVITE MEMBERS
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-ui)', marginTop: 3 }}>
                Send invitations to <strong style={{ color: '#818cf8' }}>{teamName}</strong>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#9ca3af', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginTop: 16 }}>
            <svg
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }}
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by name, email, or PRN..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                paddingLeft: 42, paddingRight: 16, paddingTop: 11, paddingBottom: 11,
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#fff',
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            {searching && (
              <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#818cf8', fontSize: 11, fontFamily: 'var(--font-ui)' }}>
                Searching...
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: '8px 0' }}>
          {error && (
            <div style={{ margin: '8px 16px', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 12, fontFamily: 'var(--font-ui)' }}>
              {error}
            </div>
          )}
          {!query.trim() ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
              Start typing to search for students on the platform
            </div>
          ) : results.length === 0 && !searching ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
              No students found for "{query}"
            </div>
          ) : (
            results.map((user, idx) => {
              const { label, color, canInvite } = statusLabel(user.id)
              return (
                <div
                  key={user.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar name={user.name} size={38} idx={idx} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-ui)', marginTop: 2 }}>
                      {[user.branch, user.classYear, user.division && `Div ${user.division}`].filter(Boolean).join(' · ')}
                      {user.pnr && <span style={{ marginLeft: 6, fontFamily: 'monospace', color: '#6366f1', fontSize: 10 }}>#{user.pnr}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-ui)', marginTop: 1 }}>
                      {user.email}
                    </div>
                  </div>
                  <button
                    onClick={() => canInvite && handleInvite(user)}
                    disabled={!canInvite}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-ui)',
                      cursor: canInvite ? 'pointer' : 'default',
                      background: canInvite ? `${color}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${canInvite ? color + '50' : 'rgba(255,255,255,0.08)'}`,
                      color: canInvite ? color : 'rgba(255,255,255,0.3)',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.2)',
          fontFamily: 'var(--font-ui)',
          fontSize: 10,
          letterSpacing: '0.08em',
        }}>
          INVITED USERS WILL SEE THE INVITE IN THEIR TEAMS PAGE AND CAN ACCEPT OR REJECT.
        </div>
      </div>
    </div>
  )
}
