import { useState } from 'react'
import { teamService } from '../../services/teamService'
import type { TeamInvitation } from '../../mocks/types'

interface Props {
  invitations: TeamInvitation[]
  userId: string
  maxTeamSize: number
  onUpdate: () => void
}

export default function InvitesInbox({ invitations, userId, maxTeamSize, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [localError, setLocalError] = useState<Record<string, string>>({})
  const [dismissed, setDismissed] = useState<string[]>([])

  const visible = invitations.filter(inv => !dismissed.includes(inv.id))
  if (visible.length === 0) return null

  const handleAccept = async (inv: TeamInvitation) => {
    setLocalError(prev => ({ ...prev, [inv.id]: '' }))
    setActionLoading(inv.id)
    try {
      await teamService.acceptInvitation(inv.id, inv.teamId, userId, inv.eventId, maxTeamSize)
      setDismissed(prev => [...prev, inv.id])
      onUpdate()
    } catch (err: any) {
      setLocalError(prev => ({ ...prev, [inv.id]: err.message || 'Failed to accept.' }))
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (inv: TeamInvitation) => {
    setLocalError(prev => ({ ...prev, [inv.id]: '' }))
    setActionLoading(inv.id)
    try {
      await teamService.rejectInvitation(inv.id)
      setDismissed(prev => [...prev, inv.id])
      onUpdate()
    } catch (err: any) {
      setLocalError(prev => ({ ...prev, [inv.id]: err.message || 'Failed to reject.' }))
    } finally {
      setActionLoading(null)
    }
  }

  const pulse: React.CSSProperties = {
    width: 8, height: 8, borderRadius: '50%',
    background: '#f59e0b',
    boxShadow: '0 0 0 0 rgba(245,158,11,0.5)',
    animation: 'invitePulse 1.8s infinite',
    flexShrink: 0,
    display: 'inline-block',
  }

  return (
    <>
      <style>{`
        @keyframes invitePulse {
          0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0.6); }
          70%  { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        }
        @keyframes inviteSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        marginBottom: 28,
        borderRadius: 16,
        border: '1px solid rgba(245,158,11,0.3)',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(251,191,36,0.03))',
        overflow: 'hidden',
        animation: 'inviteSlideIn 0.35s ease',
        boxShadow: '0 0 30px rgba(245,158,11,0.08)',
      }}>
        {/* Inbox header — clickable to collapse */}
        <div
          onClick={() => setExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 20px',
            cursor: 'pointer',
            userSelect: 'none',
            borderBottom: expanded ? '1px solid rgba(245,158,11,0.15)' : 'none',
          }}
        >
          <span style={pulse} />
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.14em',
              color: '#fbbf24', fontFamily: 'var(--font-ui)',
            }}>
              📬 TEAM INVITATIONS
            </span>
            <span style={{
              marginLeft: 10,
              padding: '2px 8px', borderRadius: 20,
              background: 'rgba(245,158,11,0.2)',
              border: '1px solid rgba(245,158,11,0.35)',
              color: '#fbbf24',
              fontSize: 10, fontWeight: 800,
              fontFamily: 'var(--font-ui)',
            }}>
              {visible.length}
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>
            ▾
          </span>
        </div>

        {/* Invitation list */}
        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {visible.map((inv, idx) => (
              <div
                key={inv.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: idx < visible.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: 'rgba(0,0,0,0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  {/* Info */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-ui)' }}>
                      {inv.teamName}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-ui)', marginTop: 3 }}>
                      <span style={{ color: '#a5b4fc' }}>{inv.eventTitle}</span>
                      {' · '}
                      Invited by <span style={{ color: '#fbbf24' }}>{inv.inviterName}</span>
                    </div>
                    {localError[inv.id] && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#f87171', fontFamily: 'var(--font-ui)' }}>
                        ⚠ {localError[inv.id]}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleAccept(inv)}
                      disabled={actionLoading === inv.id}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'var(--font-ui)',
                        cursor: actionLoading === inv.id ? 'default' : 'pointer',
                        background: 'rgba(34,211,238,0.15)',
                        border: '1px solid rgba(34,211,238,0.4)',
                        color: '#22d3ee',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { if (actionLoading !== inv.id) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,211,238,0.25)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,211,238,0.15)' }}
                    >
                      {actionLoading === inv.id ? '...' : '✓ Accept'}
                    </button>
                    <button
                      onClick={() => handleReject(inv)}
                      disabled={actionLoading === inv.id}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'var(--font-ui)',
                        cursor: actionLoading === inv.id ? 'default' : 'pointer',
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { if (actionLoading !== inv.id) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)' }}
                    >
                      {actionLoading === inv.id ? '...' : '✕ Reject'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
