import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import TransitionLink from '../components/ui/TransitionLink'
import { useApp } from '../context/AppContext'
import { teamService } from '../services/teamService'
import { teamChatService } from '../services/teamChatService'
import { eventService } from '../services/eventService'
import { isOriginalAdminEmail } from '../services/authService'
import { getShortBranch } from '../utils/formatters'
import InviteModal from '../components/layout/InviteModal'
import TeamChatModal from '../components/layout/TeamChatModal'
import MemberProfileModal from '../components/admin/MemberProfileModal'
import CompleteProfilePromptModal from '../components/ui/CompleteProfilePromptModal'
import type { Team, TeamMember, JoinRequest, TeamInvitation, EventData } from '../mocks/types'

// ── Types ─────────────────────────────────────────────────────────────────────
type RequestStatus = 'none' | 'pending' | 'accepted' | 'rejected'

// ── Avatar Component ──────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #22d3ee, #0284c7)',
  'linear-gradient(135deg, #a78bfa, #6366f1)',
  'linear-gradient(135deg, #34d399, #059669)',
  'linear-gradient(135deg, #fb923c, #ea580c)',
  'linear-gradient(135deg, #f472b6, #db2777)',
]

function MemberAvatar({
  name,
  isCaptain,
  size = 32,
  idx = 0,
}: {
  name: string
  isCaptain?: boolean
  size?: number
  idx?: number
}) {
  const initial = (name.charAt(0) || '?').toUpperCase()
  const bg = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        position: 'relative',
        boxShadow: isCaptain ? '0 0 10px rgba(34,211,238,0.5)' : 'none',
        border: isCaptain ? '2px solid #22d3ee' : '1.5px solid rgba(255,255,255,0.15)',
      }}
      title={`${name}${isCaptain ? ' (Captain)' : ''}`}
    >
      {initial}
      {isCaptain && (
        <span
          style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#22d3ee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 7,
            color: '#000',
            fontWeight: 900,
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
          }}
          title="Team Captain"
        >
          ★
        </span>
      )}
    </div>
  )
}

// ── Capacity Ring Gauge ───────────────────────────────────────────────────────
function CapacityRing({ current, max }: { current: number; max: number }) {
  const radius = 14
  const stroke = 3
  const circ = 2 * Math.PI * radius
  const frac = Math.min(1, current / max)
  const offset = circ * (1 - frac)
  const full = current >= max
  const color = full ? '#ef4444' : frac >= 0.75 ? '#f59e0b' : '#22d3ee'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <svg width={36} height={36} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        <circle cx={18} cy={18} r={radius} fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={18}
          cy={18}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-text-muted)', display: 'block', fontFamily: 'var(--font-body)' }}>
          ROSTER
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
          {current}/{max} {full ? '(Full)' : `(${max - current} open)`}
        </span>
      </div>
    </div>
  )
}

// ── Join Requests Review Panel (Captain) ──────────────────────────────────────
function RequestsPanel({
  requests,
  onAccept,
  onReject,
  loading,
}: {
  requests: JoinRequest[]
  onAccept: (req: JoinRequest) => void
  onReject: (req: JoinRequest) => void
  loading: string | null
}) {
  return (
    <div
      style={{
        marginBottom: 24,
        padding: '20px 24px',
        borderRadius: 16,
        background: 'rgba(34,211,238,0.04)',
        border: '1px solid rgba(34,211,238,0.3)',
        boxShadow: '0 8px 30px rgba(34,211,238,0.08)',
        animation: 'cardIn 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 10px #22d3ee', animation: 'pulse 1.5s infinite' }} />
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#fff', margin: 0 }}>
            Pending Join Applications ({requests.length})
          </h3>
        </div>
        <span style={{ fontSize: 11, color: '#22d3ee', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
          Review applicants for your team
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map((r) => (
          <div
            key={r.id}
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MemberAvatar name={r.userName || '?'} size={34} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 14, color: '#fff', fontFamily: 'var(--font-body)' }}>{r.userName}</strong>
                    {r.requestedRole && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }}>
                        Role: {r.requestedRole}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                    {[r.userPnr && `PRN: ${r.userPnr}`, r.userBranch ? getShortBranch(r.userBranch) : undefined, r.userYear, r.userDivision && `Div ${r.userDivision}`].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => onReject(r)}
                  disabled={loading === r.id}
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={() => onAccept(r)}
                  disabled={loading === r.id}
                  style={{
                    padding: '6px 18px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    background: 'rgba(34,211,238,0.2)',
                    border: '1px solid #22d3ee',
                    color: '#22d3ee',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {loading === r.id ? 'Adding...' : '✓ Accept to Team'}
                </button>
              </div>
            </div>

            {(r.userPitch || r.userSkills) && (
              <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.4 }}>
                {r.userSkills && <p style={{ margin: '0 0 4px', color: '#a5b4fc' }}><strong>Skills:</strong> {r.userSkills}</p>}
                {r.userPitch && <p style={{ margin: 0, fontStyle: 'italic' }}>"{r.userPitch}"</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Team Card Component ───────────────────────────────────────────────────────
function TeamCard({
  team,
  members,
  isMyTeam,
  isCaptain,
  isAdmin,
  maxSize,
  requestStatus,
  myRequestId,
  isEnrolled,
  eventId,
  userAlreadyHasTeam,
  teamFormationLive,
  onRequestJoin,
  onCancelRequest,
  onLeave,
  onKillTeam,
  onTransferCaptaincy,
  onOpenChat,
  onInvite,
  onShareLink,
  onEditDetails,
  onKickMember,
  onViewProfile,
  actionLoading,
  index,
}: {
  team: Team
  members: TeamMember[]
  isMyTeam: boolean
  isCaptain: boolean
  isAdmin?: boolean
  maxSize: number
  requestStatus: RequestStatus
  myRequestId?: string
  isEnrolled: boolean
  eventId: string
  userAlreadyHasTeam: boolean
  teamFormationLive?: boolean
  onRequestJoin: (team: Team, role?: string) => void
  onCancelRequest: (rid: string, tid: string) => void
  onLeave: (id: string) => void
  onKillTeam: (id: string) => void
  onTransferCaptaincy: (team: Team) => void
  onOpenChat?: (team: Team, members: TeamMember[]) => void
  onInvite?: () => void
  onShareLink?: () => void
  onEditDetails?: (team: Team) => void
  onKickMember?: (teamId: string, memberUserId: string, memberName?: string) => void
  onViewProfile?: (member: TeamMember, isCaptain: boolean, teamName: string) => void
  actionLoading: boolean
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const full = team.memberCount >= maxSize
  const isMine = isMyTeam || isCaptain
  const accent = isCaptain ? '#22d3ee' : isMyTeam ? '#818cf8' : full ? '#64748b' : '#34d399'

  const captainMember = members.find((m) => m.userId === team.createdBy) || members[0]

  const bannerStyle = team.bannerUrl
    ? { backgroundImage: `url(${team.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(135deg, ${accent}aa, #0f172a)` }

  const renderActionButtons = () => {
    // Captain or Admin Action Toolbar
    if (isCaptain || isAdmin) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {(isCaptain || isMyTeam) && (
            <button
              onClick={() => onOpenChat && onOpenChat(team, members)}
              style={{
                padding: '7px 14px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: 'rgba(34,211,238,0.12)',
                border: '1px solid rgba(34,211,238,0.4)',
                color: '#22d3ee',
                fontFamily: 'var(--font-body)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              💬 Team Chat
            </button>
          )}

          {isCaptain && (
            <>
              <button
                onClick={() => onInvite && onInvite()}
                style={{
                  padding: '7px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: 'rgba(129,140,248,0.14)',
                  border: '1px solid rgba(129,140,248,0.45)',
                  color: '#a5b4fc',
                  fontFamily: 'var(--font-body)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                ✉ Invite
              </button>

              <button
                onClick={() => onShareLink && onShareLink()}
                style={{
                  padding: '7px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: 'rgba(52,211,153,0.12)',
                  border: '1px solid rgba(52,211,153,0.35)',
                  color: '#34d399',
                  fontFamily: 'var(--font-body)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                🔗 Share
              </button>

              <button
                onClick={() => onLeave(team.id)}
                disabled={actionLoading}
                style={{
                  padding: '7px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 8,
                  cursor: 'pointer',
                  backgroundColor: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#f87171',
                  fontFamily: 'var(--font-body)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Exit team and transfer captaincy"
              >
                {actionLoading ? '...' : '🚪 Exit Team'}
              </button>
            </>
          )}

          <button
            onClick={() => onKillTeam(team.id)}
            disabled={actionLoading}
            style={{
              padding: '7px 14px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-body)',
            }}
            title={isAdmin ? "Admin: Delete Team" : "Disband/Delete Team"}
          >
            {actionLoading ? '...' : isAdmin && !isCaptain ? '🗑 Delete Team (Admin)' : 'Disband Team'}
          </button>
        </div>
      )
    }

    // Teammate Action Toolbar
    if (isMyTeam) {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onOpenChat && onOpenChat(team, members)}
            style={{
              padding: '7px 14px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 8,
              cursor: 'pointer',
              backgroundColor: 'rgba(34,211,238,0.12)',
              border: '1px solid rgba(34,211,238,0.4)',
              color: '#22d3ee',
              fontFamily: 'var(--font-body)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            💬 Team Chat
          </button>
          <button
            onClick={() => onLeave(team.id)}
            disabled={actionLoading}
            style={{
              padding: '7px 16px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 8,
              cursor: 'pointer',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#f87171',
              fontFamily: 'var(--font-body)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {actionLoading ? '...' : '🚪 Exit Team'}
          </button>
        </div>
      )
    }

    // Guest / Unenrolled state
    if (!isEnrolled) {
      return (
        <Link
          to={`/events/${eventId}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '7px 16px',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            backgroundColor: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.3)',
            color: '#22d3ee',
            fontFamily: 'var(--font-body)',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Enroll to Join →
        </Link>
      )
    }

    if (!teamFormationLive && !isAdmin) {
      return (
        <span
          style={{
            fontSize: 11,
            color: '#f87171',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          🔒 Formation Closed
        </span>
      )
    }

    if (userAlreadyHasTeam) {
      return (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
          In Another Team
        </span>
      )
    }

    return (
      <button
        onClick={(e) => { e.stopPropagation(); onRequestJoin(team) }}
        disabled={actionLoading || full}
        style={{
          padding: '8px 20px',
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 8,
          cursor: full ? 'not-allowed' : 'pointer',
          background: full ? 'rgba(255,255,255,0.03)' : 'rgba(34,211,238,0.12)',
          border: `1px solid ${full ? 'rgba(255,255,255,0.08)' : 'rgba(34,211,238,0.4)'}`,
          color: full ? '#64748b' : '#22d3ee',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.04em',
        }}
      >
        {actionLoading ? '...' : full ? 'Team Full' : 'Request to Join →'}
      </button>
    )
  }

  // COLLAPSED CARD MODE (Responsive 2-part structure to prevent mobile overflow)
  if (!expanded) {
    const yearDeptDivText = [
      captainMember?.userYear,
      captainMember?.userBranch ? getShortBranch(captainMember.userBranch) : undefined,
      captainMember?.userDivision && (captainMember.userDivision.toLowerCase().includes('div') ? captainMember.userDivision : `Div ${captainMember.userDivision}`),
    ].filter(Boolean).join(' · ')

    return (
      <div
        onClick={() => setExpanded(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: 14,
          cursor: 'pointer',
          padding: '12px 14px',
          backgroundColor: hovered ? 'var(--color-bg)' : 'var(--color-white)',
          border: isMine ? '1.5px solid rgba(34,211,238,0.45)' : '1px solid var(--color-sand)',
          boxShadow: isMine
            ? '0 4px 14px rgba(34,211,238,0.08)'
            : hovered
              ? '0 6px 18px rgba(0,0,0,0.04)'
              : 'none',
          transition: 'all 0.2s ease',
          animation: `cardIn 0.25s ease ${Math.min(index, 10) * 30}ms both`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          height: 'auto',
          minHeight: 88,
          overflow: 'hidden',
        }}
      >
        {/* TOP ROW: Avatar + Team Name + Badges + OPEN + View Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: `linear-gradient(135deg, ${accent}, #1e293b)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 800,
                color: '#fff',
                flexShrink: 0,
                boxShadow: `0 3px 8px ${accent}33`,
              }}
            >
              {(team.name.charAt(0) || '?').toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  lineHeight: 1.2,
                  wordBreak: 'break-word',
                }}
              >
                {team.name}
              </h3>
              {isCaptain && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'rgba(34,211,238,0.15)',
                    color: '#22d3ee',
                    border: '1px solid rgba(34,211,238,0.4)',
                    fontFamily: 'var(--font-body)',
                    flexShrink: 0,
                  }}
                >
                  ★ CAPTAIN
                </span>
              )}
              {isMyTeam && !isCaptain && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'rgba(129,140,248,0.12)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(129,140,248,0.3)',
                    fontFamily: 'var(--font-body)',
                    flexShrink: 0,
                  }}
                >
                  MY TEAM
                </span>
              )}
            </div>
          </div>

          {/* Right Side Status & View Action & Join Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: full ? 'rgba(71,85,105,0.15)' : 'rgba(52,211,153,0.12)',
                  color: full ? '#64748b' : '#34d399',
                  border: `1px solid ${full ? 'rgba(71,85,105,0.3)' : 'rgba(52,211,153,0.3)'}`,
                  fontFamily: 'var(--font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                {!full && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 6px #34d399' }} />}
                {full ? 'FULL' : 'OPEN'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                View <span style={{ fontSize: 12 }}>→</span>
              </span>
            </div>

            {/* Direct Exit Button for My Team / Captain */}
            {(isCaptain || isMyTeam) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onLeave(team.id)
                }}
                disabled={actionLoading}
                style={{
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: '#f87171',
                  fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s ease',
                }}
                title="Exit team"
              >
                {actionLoading ? '...' : 'Exit 🚪'}
              </button>
            )}

            {/* Direct Join Button Below View */}
            {!isCaptain && !isMyTeam && (
              !teamFormationLive && !isAdmin ? (
                <span
                  style={{
                    padding: '3px 8px',
                    fontSize: 10,
                    fontWeight: 800,
                    borderRadius: 6,
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#f87171',
                    fontFamily: 'var(--font-body)',
                  }}
                  title="Team formations are closed for this event"
                >
                  🔒 Closed
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isEnrolled) {
                      window.location.href = `/events/${eventId}`
                    } else if (!userAlreadyHasTeam && !full && requestStatus !== 'pending') {
                      onRequestJoin(team)
                    }
                  }}
                  disabled={actionLoading || (isEnrolled && (userAlreadyHasTeam || full || requestStatus === 'pending'))}
                  style={{
                    padding: '3px 10px',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                    borderRadius: 6,
                    cursor: (isEnrolled && (userAlreadyHasTeam || full || requestStatus === 'pending')) ? 'not-allowed' : 'pointer',
                    background: requestStatus === 'pending'
                      ? 'rgba(245,158,11,0.15)'
                      : (!isEnrolled || (!userAlreadyHasTeam && !full))
                        ? 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)'
                        : 'rgba(0,0,0,0.05)',
                    border: requestStatus === 'pending'
                      ? '1px solid rgba(245,158,11,0.4)'
                      : (!isEnrolled || (!userAlreadyHasTeam && !full))
                        ? '1px solid rgba(255,255,255,0.2)'
                        : '1px solid rgba(0,0,0,0.08)',
                    color: requestStatus === 'pending'
                      ? '#fbbf24'
                      : (!isEnrolled || (!userAlreadyHasTeam && !full))
                        ? '#ffffff'
                        : '#94a3b8',
                    fontFamily: 'var(--font-body)',
                    transition: 'all 0.15s ease',
                    boxShadow: (!isEnrolled || (!userAlreadyHasTeam && !full)) ? '0 2px 6px rgba(62,88,104,0.3)' : 'none',
                  }}
                >
                  {actionLoading
                    ? '...'
                    : !isEnrolled
                      ? 'Enroll'
                      : requestStatus === 'pending'
                        ? 'Pending'
                        : userAlreadyHasTeam
                          ? 'In Team'
                          : full
                            ? 'Full'
                            : 'Join +'}
                </button>
              )
            )}
          </div>
        </div>

        {/* INFORMATION SECTION: Captain name, Member count, Year & Division */}
        <div style={{ width: '100%', boxSizing: 'border-box', paddingTop: 2, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 2px', lineHeight: 1.35, wordBreak: 'break-word' }}>
            Captain: <strong style={{ color: 'var(--color-text-primary)' }}>{captainMember?.userName || 'Captain'}</strong>
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.35, wordBreak: 'break-word' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{team.memberCount} / {maxSize} members</span>
            {yearDeptDivText ? ` · ${yearDeptDivText}` : ''}
          </p>
        </div>
      </div>
    )
  }

  // EXPANDED CARD MODE (Full detail view revealed when user clicks row)
  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: 'var(--color-white)',
        border: '1.5px solid #22d3ee',
        boxShadow: '0 10px 30px rgba(34,211,238,0.12)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        animation: 'cardIn 0.25s ease both',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Banner Section */}
      <div style={{ height: 50, width: '100%', position: 'relative', ...bannerStyle }}>
        {isCaptain && onEditDetails && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditDetails(team) }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(0,0,0,0.65)',
              color: '#22d3ee',
              border: '1px solid rgba(34,211,238,0.4)',
              borderRadius: 6,
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
            }}
            title="Edit Team Details & Banner"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Edit Team</span>
          </button>
        )}

        {/* Collapse Button Top Right */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(0,0,0,0.65)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          ▲ Collapse
        </button>
      </div>

      <div style={{ padding: '16px 16px 14px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Header Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              {isCaptain && (
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 4, background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.4)', fontFamily: 'var(--font-body)' }}>
                  ★ CAPTAIN
                </span>
              )}
              {isMyTeam && !isCaptain && (
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 4, background: 'rgba(129,140,248,0.12)', color: '#a5b4fc', border: '1px solid rgba(129,140,248,0.3)', fontFamily: 'var(--font-body)' }}>
                  MY TEAM
                </span>
              )}
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: full ? 'rgba(71,85,105,0.15)' : 'rgba(52,211,153,0.1)', color: full ? '#64748b' : '#34d399', border: `1px solid ${full ? 'rgba(71,85,105,0.2)' : 'rgba(52,211,153,0.25)'}`, fontFamily: 'var(--font-body)' }}>
                {full ? 'FULL' : 'OPEN TO JOIN'}
              </span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {team.name}
            </h3>
          </div>
          <CapacityRing current={team.memberCount} max={maxSize} />
        </div>

        {/* Skills & Achievements */}
        {(team.skills || team.achievements) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, fontSize: 11, fontFamily: 'var(--font-body)', padding: '8px 10px', borderRadius: 8, background: 'var(--color-ivory)', border: '1px solid var(--color-cream)' }}>
            {team.skills && (
              <span style={{ color: 'var(--color-text-secondary)' }}>
                <strong>Skills:</strong> {team.skills}
              </span>
            )}
            {team.achievements && (
              <span style={{ color: 'var(--color-dusty-blue)' }}>
                🏆 <strong>Achievements:</strong> {team.achievements}
              </span>
            )}
          </div>
        )}

        {/* Open Roles */}
        {team.openRoles && team.openRoles.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--color-slate-blue)', fontFamily: 'var(--font-body)', display: 'block', marginBottom: 4 }}>
              OPEN ROLES WANTED:
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {team.openRoles.map((role, rIdx) => (
                <span
                  key={rIdx}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 5,
                    backgroundColor: 'rgba(62,88,104,0.08)',
                    border: '1px solid rgba(62,88,104,0.25)',
                    color: 'var(--color-slate-blue)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  + {role}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Expanded Roster Members List */}
        <div style={{ marginTop: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', display: 'block', marginBottom: 6 }}>
            TEAM MEMBERS ({members.length}/{maxSize})
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map((m, i) => {
              const isMemberCaptain = m.userId === team.createdBy
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--color-ivory)',
                    border: '1px solid var(--color-cream)',
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <Link
                    to={`/profile/${m.userId}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      minWidth: 0,
                      flex: 1,
                      textDecoration: 'none',
                    }}
                  >
                    <MemberAvatar name={m.userName || '?'} isCaptain={isMemberCaptain} size={30} idx={i} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
                        {m.userName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                        {[m.userBranch ? getShortBranch(m.userBranch) : undefined, m.userYear, m.userDivision && `Div ${m.userDivision}`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </Link>

                  {isCaptain && !isMemberCaptain && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onKickMember && onKickMember(team.id, m.userId, m.userName)
                      }}
                      disabled={actionLoading}
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 6,
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                      title={`Remove ${m.userName} from team`}
                    >
                      ✕ Kick
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--color-cream)' }}>
          {renderActionButtons()}
        </div>
      </div>
    </div>
  )
}

// ── Edit Team Details Modal ──────────────────────────────────────────────────
function EditTeamModal({
  team,
  onClose,
  onSave,
  saving,
}: {
  team: Team
  onClose: () => void
  onSave: (updates: { name: string; skills: string; achievements: string; openRoles: string[]; bannerUrl?: string }) => Promise<void>
  saving: boolean
}) {
  const [name, setName] = useState(team.name)
  const [skills, setSkills] = useState(team.skills || '')
  const [achievements, setAchievements] = useState(team.achievements || '')
  const [openRolesText, setOpenRolesText] = useState((team.openRoles || []).join(', '))
  const [bannerUrl, setBannerUrl] = useState(team.bannerUrl || '')
  const [error, setError] = useState('')

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Team name cannot be empty')
      return
    }
    setError('')
    try {
      const rolesArray = openRolesText
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)

      await onSave({
        name: name.trim(),
        skills: skills.trim(),
        achievements: achievements.trim(),
        openRoles: rolesArray,
        bannerUrl: bannerUrl.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update team details')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(5, 5, 10, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          margin: '0 auto',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          borderRadius: 20,
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-cream)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          padding: '22px 18px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.16em', color: '#22d3ee', fontWeight: 700, margin: 0 }}>
              CAPTAIN CONTROLS
            </p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text-primary)', margin: 0 }}>Edit Team Details</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && (
            <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 12px', borderRadius: 6 }}>
              ⚠ {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 3 }}>
              TEAM NAME *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quantum Coders"
              required
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 3 }}>
              SKILLS & TECH STACK (COMMA SEPARATED)
            </label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. React, Node.js, Python, Figma, OpenCV"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 3 }}>
              ACHIEVEMENTS & ACCOLADES (OPTIONAL)
            </label>
            <input
              type="text"
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder="e.g. 1st Place Eureka 2025, Top 5 HackSpark"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 3 }}>
              OPEN ROLES WANTED (COMMA SEPARATED)
            </label>
            <input
              type="text"
              value={openRolesText}
              onChange={(e) => setOpenRolesText(e.target.value)}
              placeholder="e.g. UI/UX Designer, Backend Lead, ML Engineer"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '3px 0 0', fontFamily: 'var(--font-body)' }}>
              These roles appear as clickable recruitment pills on your team card.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 3 }}>
              CUSTOM BANNER IMAGE URL (OPTIONAL)
            </label>
            <input
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                borderRadius: 8,
                backgroundColor: 'transparent',
                border: '1px solid var(--color-sand)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 20px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                background: 'rgba(34,211,238,0.2)',
                border: '1px solid #22d3ee',
                color: '#0891b2',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving Changes...' : 'Save Team Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Kick Teammate Confirmation Modal ──────────────────────────────────────────
function KickMemberModal({
  teamName,
  memberName,
  onClose,
  onConfirm,
  loading,
}: {
  teamName: string
  memberName: string
  onClose: () => void
  onConfirm: () => Promise<void>
  loading: boolean
}) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(5, 5, 10, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          margin: '0 auto',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          borderRadius: 20,
          backgroundColor: 'var(--color-bg)',
          border: '1px solid rgba(239,68,68,0.4)',
          boxShadow: '0 25px 60px rgba(239,68,68,0.2)',
          padding: '22px 18px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 20, marginBottom: 14 }}>
          ✕
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
          Remove Teammate?
        </h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
          Are you sure you want to kick <strong>{memberName}</strong> out of <strong>{teamName}</strong>? They will be removed from your team roster and can join or form another team.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, backgroundColor: 'transparent', border: '1px solid var(--color-sand)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 20px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid #ef4444',
              color: '#f87171',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Removing...' : 'Kick Teammate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Join Request Modal ────────────────────────────────────────────────────────
function JoinRequestModal({
  team,
  selectedRole,
  onClose,
  onSubmit,
  submitting,
}: {
  team: Team
  selectedRole?: string
  onClose: () => void
  onSubmit: (skills: string, pitch: string, role: string) => Promise<void>
  submitting: boolean
}) {
  const [skills, setSkills] = useState('')
  const [pitch, setPitch] = useState('')
  const [role, setRole] = useState(selectedRole || '')
  const [error, setError] = useState('')

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await onSubmit(skills.trim(), pitch.trim(), role.trim())
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(5, 5, 10, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          margin: '0 auto',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          borderRadius: 20,
          backgroundColor: 'var(--color-bg)',
          border: '1px solid rgba(34,211,238,0.3)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          padding: '20px 18px',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.16em', color: '#22d3ee', fontWeight: 700, margin: 0 }}>
              JOIN APPLICATION
            </p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text-primary)', margin: 0 }}>
              Apply to {team.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && (
            <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 3 }}>
              TARGET ROLE (OPTIONAL)
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Frontend Developer, Designer..."
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                borderRadius: 8,
                backgroundColor: 'var(--color-white)',
                border: '1px solid var(--color-cream)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-body)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 3 }}>
              YOUR SKILLS & EXPERIENCE (OPTIONAL)
            </label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. React, Node.js, Python, Figma, Supabase..."
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                borderRadius: 8,
                backgroundColor: 'var(--color-white)',
                border: '1px solid var(--color-cream)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-body)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 3 }}>
              MESSAGE TO TEAM CAPTAIN (OPTIONAL)
            </label>
            <textarea
              rows={2}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="Tell the captain why you'd be a great addition to the team..."
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                borderRadius: 8,
                backgroundColor: 'var(--color-white)',
                border: '1px solid var(--color-cream)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-body)',
                boxSizing: 'border-box',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                borderRadius: 8,
                backgroundColor: 'transparent',
                border: '1px solid var(--color-sand)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 20px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                background: 'rgba(34,211,238,0.2)',
                border: '1px solid #22d3ee',
                color: '#0891b2',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending...' : 'Send Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Transfer Captaincy Modal ──────────────────────────────────────────────────
function TransferCaptainModal({
  team,
  members,
  currentUserId,
  onClose,
  onTransfer,
}: {
  team: Team
  members: TeamMember[]
  currentUserId: string
  onClose: () => void
  onTransfer: (newCaptainId: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const candidates = members.filter((m) => m.userId !== currentUserId)

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleTransfer = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      await onTransfer(selectedId)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(5, 5, 10, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          margin: '0 auto',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          borderRadius: 20,
          backgroundColor: 'var(--color-bg)',
          border: '1px solid rgba(99,102,241,0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          padding: '22px 18px',
          boxSizing: 'border-box',
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
          Transfer Captaincy
        </h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
          Select a teammate to make them Captain of "{team.name}" before leaving.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {candidates.map((m) => (
            <div
              key={m.userId}
              onClick={() => setSelectedId(m.userId)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                background: selectedId === m.userId ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedId === m.userId ? 'rgba(34,211,238,0.4)' : 'var(--color-cream)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>{m.userName}</span>
              {selectedId === m.userId && <span style={{ fontSize: 11, color: '#22d3ee', fontWeight: 700 }}>Selected Captain</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, backgroundColor: 'transparent', border: '1px solid var(--color-sand)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedId || loading}
            style={{
              padding: '8px 20px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              background: 'rgba(99,102,241,0.18)',
              border: '1px solid rgba(99,102,241,0.4)',
              color: '#a5b4fc',
              cursor: selectedId ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Transferring...' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Universal Exit Team Modal (For Members and Captains) ──────────────────────
function ExitTeamModal({
  team,
  members,
  currentUserId,
  onClose,
  onConfirmExit,
  loading,
}: {
  team: Team
  members: TeamMember[]
  currentUserId: string
  onClose: () => void
  onConfirmExit: (newCaptainId?: string) => Promise<void>
  loading: boolean
}) {
  const isCaptain = team.createdBy === currentUserId
  const candidates = members.filter((m) => m.userId !== currentUserId)
  const isSolo = isCaptain && candidates.length === 0
  const [selectedCaptainId, setSelectedCaptainId] = useState<string>(
    candidates.length > 0 ? candidates[0].userId : ''
  )
  const [error, setError] = useState('')

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleExit = async () => {
    setError('')
    try {
      if (isCaptain && candidates.length > 0 && !selectedCaptainId) {
        setError('Please select a teammate to become the new captain.')
        return
      }
      await onConfirmExit(isCaptain && candidates.length > 0 ? selectedCaptainId : undefined)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to exit team.')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(5, 5, 10, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          margin: '0 auto',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          borderRadius: 20,
          backgroundColor: 'var(--color-bg)',
          border: '1px solid rgba(239,68,68,0.4)',
          boxShadow: '0 25px 60px rgba(239,68,68,0.2)',
          padding: '22px 18px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 20, marginBottom: 14 }}>
          🚪
        </div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
          {isSolo ? 'Disband & Exit Team?' : 'Exit Team?'}
        </h3>

        {isSolo ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
            You are currently the only member in <strong>"{team.name}"</strong>. Exiting will delete and disband the team. You will be free to join or create another team.
          </p>
        ) : isCaptain ? (
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
              As <strong>Team Captain</strong>, you can exit the team! Please select which teammate will take over as Captain of <strong>"{team.name}"</strong>.
            </p>

            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#22d3ee', fontFamily: 'var(--font-body)', display: 'block', marginBottom: 8 }}>
                CHOOSE NEW CAPTAIN:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {candidates.map((m) => {
                  const isSelected = selectedCaptainId === m.userId
                  return (
                    <div
                      key={m.userId}
                      onClick={() => setSelectedCaptainId(m.userId)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
                        border: isSelected ? '1.5px solid #22d3ee' : '1px solid var(--color-sand)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
                          {m.userName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                          {[m.userBranch, m.userYear, m.userDivision && `Div ${m.userDivision}`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {isSelected && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#22d3ee' }}>
                          ✓ New Captain
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
            Are you sure you want to leave <strong>"{team.name}"</strong>? Your team spot will open up and you can join another team.
          </p>
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 12px', borderRadius: 6, marginBottom: 14 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, backgroundColor: 'transparent', border: '1px solid var(--color-sand)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExit}
            disabled={loading}
            style={{
              padding: '9px 22px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid #ef4444',
              color: '#f87171',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {loading ? 'Exiting...' : isSolo ? 'Disband & Exit' : isCaptain ? 'Pass Captaincy & Exit' : 'Exit Team'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Teams Page Component ─────────────────────────────────────────────────
export default function TeamsPage() {
  const { user, tickets, isProfileComplete, missingProfileFields } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventData[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({})
  const [myTeam, setMyTeam] = useState<Team | null>(null)

  const isAdmin = user?.role === 'admin' || isOriginalAdminEmail(user?.email)

  const [loading, setLoading] = useState(true)
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>({})
  const [requestIds, setRequestIds] = useState<Record<string, string>>({})
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([])
  const [reqActionLoading, setReqActionLoading] = useState<string | null>(null)

  // Create team state
  const [showCreate, setShowCreate] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamSkills, setNewTeamSkills] = useState('')
  const [newTeamAchievements, setNewTeamAchievements] = useState('')
  const [newTeamOpenRoles, setNewTeamOpenRoles] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Modal States
  const [joinModalTeam, setJoinModalTeam] = useState<{ team: Team; role?: string } | null>(null)
  const [transferModalTeam, setTransferModalTeam] = useState<Team | null>(null)
  const [exitModalTeam, setExitModalTeam] = useState<{ team: Team; members: TeamMember[] } | null>(null)
  const [exitingLoading, setExitingLoading] = useState(false)
  const [activeChatTeam, setActiveChatTeam] = useState<{ team: Team; members: TeamMember[] } | null>(null)
  const [myTeamUnread, setMyTeamUnread] = useState(0)
  const [submittingJoin, setSubmittingJoin] = useState(false)

  // Edit Team & Kick Teammate states (Captain)
  const [editModalTeam, setEditModalTeam] = useState<Team | null>(null)
  const [savingTeamDetails, setSavingTeamDetails] = useState(false)
  const [kickConfirmData, setKickConfirmData] = useState<{ teamId: string; teamName: string; memberUserId: string; memberName: string } | null>(null)
  const [kickingLoading, setKickingLoading] = useState(false)

  // Member profile viewer (any teammate can see each other's profiles)
  const [viewingProfile, setViewingProfile] = useState<{ member: TeamMember; isCaptain: boolean; teamName: string } | null>(null)

  // Invite modal state (captain)
  const [inviteModalTeam, setInviteModalTeam] = useState<Team | null>(null)
  // Invitations inbox (invitee)
  const [myInvitations, setMyInvitations] = useState<TeamInvitation[]>([])
  // Share link toast
  const [linkCopied, setLinkCopied] = useState(false)
  const linkCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'recruiting' | 'myteam'>('all')

  // Incomplete profile prompt modal state
  const [showProfilePromptModal, setShowProfilePromptModal] = useState(false)
  const [profilePromptAction, setProfilePromptAction] = useState('join or create a team')

  useEffect(() => {
    eventService.getAllEvents().then((all) => {
      const upcoming = all.filter((e) => !e.isPast)
      setEvents(upcoming)

      // Handle ?join=teamId&event=eventId URL param
      const params = new URLSearchParams(location.search)
      const joinEventId = params.get('event')
      const target = joinEventId ? upcoming.find((e) => e.id === joinEventId) : upcoming[0]
      if (target) setSelectedEvent(target)
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll invitations for logged-in user
  useEffect(() => {
    if (!user?.id) return
    let mounted = true
    const poll = async () => {
      try {
        const invs = await teamService.getMyInvitations(user.id)
        if (mounted) setMyInvitations(invs)
      } catch {
        /* silent */
      }
    }
    poll()
    const iv = setInterval(poll, 30000)
    return () => {
      mounted = false
      clearInterval(iv)
    }
  }, [user?.id])

  // After teams load: if ?join=teamId URL param, auto-open that team's join modal
  const joinParamHandled = useRef(false)
  useEffect(() => {
    if (joinParamHandled.current || teamsLoading || !teams.length) return
    const params = new URLSearchParams(location.search)
    const joinTeamId = params.get('join')
    if (!joinTeamId) return
    joinParamHandled.current = true
    const target = teams.find((t) => t.id === joinTeamId)
    if (target && !myTeam) {
      setJoinModalTeam({ team: target })
    }
    navigate('/teams', { replace: true })
  }, [teamsLoading, teams, myTeam, location.search, navigate])

  // Poll unread message count for myTeam
  useEffect(() => {
    if (!myTeam || !user?.id) {
      setMyTeamUnread(0)
      return
    }
    let isMounted = true
    const checkUnread = async () => {
      const count = await teamChatService.getUnreadCount(myTeam.id, user.id)
      if (isMounted) setMyTeamUnread(count)
    }
    checkUnread()
    const interval = setInterval(checkUnread, 3000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [myTeam?.id, user?.id])

  const loadTeamsForEvent = useCallback(
    async (event: EventData) => {
      if (!event || !user) return
      setTeamsLoading(true)
      setError('')
      setMyTeam(null)
      setTeams([])
      setTeamMembers({})
      setRequestStatuses({})
      setRequestIds({})
      setPendingRequests([])
      setShowCreate(false)
      setNewTeamName('')
      setNewTeamSkills('')
      setNewTeamAchievements('')
      setNewTeamOpenRoles('')
      setCreateError('')

      const [allTeams, userTeam] = await Promise.all([
        teamService.getTeamsForEvent(event.id),
        teamService.getUserTeamForEvent(event.id, user.id),
      ])

      setTeams(allTeams)
      setMyTeam(userTeam)

      // Fetch members for all teams in parallel
      const membersMap: Record<string, TeamMember[]> = {}
      await Promise.all(
        allTeams.map(async (t) => {
          membersMap[t.id] = await teamService.getTeamMembers(t.id)
        })
      )
      setTeamMembers(membersMap)

      // If user is captain of a team for this event, fetch pending requests
      if (userTeam && userTeam.createdBy === user.id) {
        const reqs = await teamService.getRequestsForTeam(userTeam.id)
        setPendingRequests(reqs)
      }

      // Fetch user's own join request statuses
      const statuses = await teamService.getMyRequestStatuses(user.id)
      const statusMap: Record<string, RequestStatus> = {}
      const idMap: Record<string, string> = {}
      Object.entries(statuses).forEach(([tid, r]) => {
        statusMap[tid] = r.status as RequestStatus
        idMap[tid] = r.id
      })
      setRequestStatuses(statusMap)
      setRequestIds(idMap)

      setTeamsLoading(false)
    },
    [user]
  )

  useEffect(() => {
    if (selectedEvent && user) {
      loadTeamsForEvent(selectedEvent)
    }
  }, [selectedEvent?.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isEnrolled = (eventId: string) => {
    return tickets.some((t) => t.eventId === eventId && t.status === 'Confirmed')
  }

  const act = async (fn: () => Promise<void>, teamId?: string) => {
    if (teamId) setActionLoading(teamId)
    setError('')
    try {
      await fn()
      if (selectedEvent) await loadTeamsForEvent(selectedEvent)
    } catch (e: any) {
      setError(e.message || 'Action failed')
    } finally {
      if (teamId) setActionLoading(null)
    }
  }

  const handleOpenJoinModal = (team: Team, role?: string) => {
    if (!isProfileComplete) {
      setProfilePromptAction(`join team "${team.name}"`)
      setShowProfilePromptModal(true)
      return
    }
    setJoinModalTeam({ team, role })
  }

  const handleSendJoinRequestWithSkills = async (skills: string, pitch: string, role: string) => {
    if (!user || !selectedEvent || !joinModalTeam) return
    setSubmittingJoin(true)
    try {
      await teamService.sendJoinRequest(joinModalTeam.team.id, user.id, selectedEvent.id, {
        userSkills: skills,
        userPitch: pitch,
        requestedRole: role,
      })
      setJoinModalTeam(null)
      await loadTeamsForEvent(selectedEvent)
    } finally {
      setSubmittingJoin(false)
    }
  }

  const handleCancelRequest = (rid: string, tid: string) => act(() => teamService.cancelRequest(rid), tid)

  const handleShareLink = (team: Team) => {
    const url = `${window.location.origin}/teams?join=${team.id}&event=${selectedEvent?.id || ''}`
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setLinkCopied(true)
        if (linkCopiedTimer.current) clearTimeout(linkCopiedTimer.current)
        linkCopiedTimer.current = setTimeout(() => setLinkCopied(false), 2500)
      })
      .catch(() => {
        const el = document.createElement('textarea')
        el.value = url
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        setLinkCopied(true)
        if (linkCopiedTimer.current) clearTimeout(linkCopiedTimer.current)
        linkCopiedTimer.current = setTimeout(() => setLinkCopied(false), 2500)
      })
  }

  const handleOpenExitModal = (targetTeam: Team) => {
    const members = teamMembers[targetTeam.id] || []
    setExitModalTeam({ team: targetTeam, members })
  }

  const handleLeave = (tid: string) => {
    const targetTeam = teams.find(t => t.id === tid) || (myTeam && myTeam.id === tid ? myTeam : null)
    if (targetTeam) {
      handleOpenExitModal(targetTeam)
    } else if (user?.id) {
      if (!window.confirm('Leave this team?')) return
      act(() => teamService.leaveTeam(tid, user.id), tid)
    }
  }

  const handleConfirmExit = async (newCaptainId?: string) => {
    if (!exitModalTeam || !user?.id) return
    setExitingLoading(true)
    setError('')
    try {
      await teamService.leaveTeam(exitModalTeam.team.id, user.id, newCaptainId)
      if (selectedEvent) await loadTeamsForEvent(selectedEvent)
      setExitModalTeam(null)
    } catch (err: any) {
      setError(err.message || 'Failed to exit team')
    } finally {
      setExitingLoading(false)
    }
  }

  const handleKillTeam = (tid: string) => {
    if (!window.confirm('Kill team? This will delete the team and unassign all members. Cannot be undone.')) return
    act(() => teamService.deleteTeam(tid, user!.id), tid)
  }

  const handleTransferCaptaincy = async (newCaptainId: string) => {
    if (!transferModalTeam || !user) return
    await act(async () => {
      await teamService.transferCaptaincy(transferModalTeam.id, user.id, newCaptainId)
      await teamService.leaveTeam(transferModalTeam.id, user.id)
    }, transferModalTeam.id)
  }

  const handleSaveTeamDetails = async (updates: { name: string; skills: string; achievements: string; openRoles: string[]; bannerUrl?: string }) => {
    if (!editModalTeam || !user?.id) return
    setSavingTeamDetails(true)
    try {
      await teamService.updateTeamDetails(editModalTeam.id, user.id, updates)
      if (selectedEvent) await loadTeamsForEvent(selectedEvent)
      setEditModalTeam(null)
    } finally {
      setSavingTeamDetails(false)
    }
  }

  const handleConfirmKickMember = async () => {
    if (!kickConfirmData || !user?.id) return
    setKickingLoading(true)
    try {
      await teamService.kickMember(kickConfirmData.teamId, user.id, kickConfirmData.memberUserId)
      if (selectedEvent) await loadTeamsForEvent(selectedEvent)
      setKickConfirmData(null)
    } catch (err: any) {
      setError(err.message || 'Failed to kick teammate')
    } finally {
      setKickingLoading(false)
    }
  }

  const handleAcceptRequest = async (req: JoinRequest) => {
    setReqActionLoading(req.id)
    setError('')
    try {
      await teamService.acceptRequest(req.id, req.teamId, req.userId, selectedEvent!.maxTeamSize ?? 4)
      await loadTeamsForEvent(selectedEvent!)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setReqActionLoading(null)
    }
  }

  const handleRejectRequest = async (req: JoinRequest) => {
    setReqActionLoading(req.id)
    setError('')
    try {
      await teamService.rejectRequest(req.id)
      await loadTeamsForEvent(selectedEvent!)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setReqActionLoading(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedEvent || !newTeamName.trim()) {
      setCreateError('Team name is required.')
      return
    }
    if (myTeam) {
      setCreateError('You can only create or belong to 1 team per event.')
      return
    }
    if (newTeamName.trim().length < 2) {
      setCreateError('Minimum 2 characters required.')
      return
    }

    setCreating(true)
    setCreateError('')
    try {
      const parsedRoles = newTeamOpenRoles
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      await teamService.createTeam(selectedEvent.id, newTeamName.trim(), user.id, {
        skills: newTeamSkills.trim(),
        achievements: newTeamAchievements.trim(),
        openRoles: parsedRoles,
      })
      setShowCreate(false)
      setNewTeamName('')
      setNewTeamSkills('')
      setNewTeamAchievements('')
      setNewTeamOpenRoles('')
      await loadTeamsForEvent(selectedEvent)
    } catch (e: any) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRespondInvitation = async (invId: string, accept: boolean) => {
    if (!user?.id || !selectedEvent) return
    if (accept && !isProfileComplete) {
      setProfilePromptAction('accept this team invitation')
      setShowProfilePromptModal(true)
      return
    }
    try {
      await teamService.respondToInvitation(invId, accept, user.id, selectedEvent.maxTeamSize ?? 4)
      const updatedInvs = await teamService.getMyInvitations(user.id)
      setMyInvitations(updatedInvs)
      if (accept) {
        await loadTeamsForEvent(selectedEvent)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to respond to invitation.')
    }
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', gap: 16 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--color-text-muted)' }}>ACCESS RESTRICTED</p>
        <Link to="/auth" className="btn-primary" style={{ padding: '12px 32px', textDecoration: 'none', borderRadius: 10 }}>Sign In</Link>
      </div>
    )
  }

  const filtered = teams.filter((t) => {
    const q = searchQuery.toLowerCase().trim()
    if (q && !t.name.toLowerCase().includes(q) && !(teamMembers[t.id] || []).some((m) => m.userName?.toLowerCase().includes(q))) return false
    if (filterMode === 'recruiting') return t.memberCount < (selectedEvent?.maxTeamSize ?? 4)
    if (filterMode === 'myteam') return myTeam?.id === t.id
    return true
  })
  const openCount = teams.filter((t) => t.memberCount < (selectedEvent?.maxTeamSize ?? 4)).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingTop: 'calc(var(--nav-h) + 1.5rem)', paddingBottom: '5rem' }}>
      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .teams-page-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .teams-layout-grid {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 28px;
          align-items: start;
        }
        .teams-events-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .teams-search-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .teams-search-input-wrap {
          position: relative;
          flex: 1;
          min-width: 220px;
        }
        .teams-filter-group {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 2px;
        }
        .teams-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .teams-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 860px) {
          .teams-layout-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .teams-sidebar {
            width: 100%;
          }
          .teams-events-list {
            flex-direction: row;
            overflow-x: auto;
            padding-bottom: 8px;
            -webkit-overflow-scrolling: touch;
          }
          .teams-event-btn {
            min-width: 200px;
            flex-shrink: 0;
          }
          .teams-cards-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .teams-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="teams-page-container">
        {/* Back to Home Button */}
        <div style={{ paddingTop: 16, marginBottom: 8 }}>
          <TransitionLink
            to="/"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              backgroundColor: 'var(--color-white)',
              border: '1px solid var(--color-sand)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease',
            }}
          >
            ← BACK TO HOME
          </TransitionLink>
        </div>

        {/* Top Header */}
        <div style={{ padding: '12px 0 20px', borderBottom: '1px solid var(--color-cream)', marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.2em', color: '#22d3ee', fontWeight: 700, margin: '0 0 4px' }}>
              COLLABORATION HUB
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--color-text-primary)', lineHeight: 1, margin: 0 }}>
              Teams & Rosters
            </h1>
          </div>

          {/* User invitations notification indicator */}
          {myInvitations.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 10, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.4)', animation: 'cardIn 0.3s ease' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22d3ee', fontFamily: 'var(--font-body)' }}>
                You have {myInvitations.length} pending team invite{myInvitations.length > 1 ? 's' : ''}!
              </span>
            </div>
          )}
        </div>

        {/* Incomplete Profile Prompt Banner */}
        {user && !isProfileComplete && (
          <div style={{ marginBottom: 20, padding: '14px 20px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', fontFamily: 'var(--font-body)' }}>
                Your profile is incomplete (missing: {missingProfileFields.join(', ')}). You must complete all details to join or create teams.
              </span>
            </div>
            <TransitionLink
              to="/profile"
              style={{ padding: '6px 14px', borderRadius: 8, background: '#f59e0b', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 11, fontFamily: 'var(--font-body)' }}
            >
              Complete Profile Now →
            </TransitionLink>
          </div>
        )}

        {/* Pending Invitations Received Banner */}
        {myInvitations.length > 0 && (
          <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 14, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#a5b4fc', fontFamily: 'var(--font-body)' }}>
              TEAM INVITATIONS FOR YOU
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myInvitations.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-body)', display: 'block' }}>
                      {inv.inviterName} invited you to join "{inv.teamName}" ({inv.eventTitle})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleRespondInvitation(inv.id, false)}
                      style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: 'transparent', border: '1px solid var(--color-sand)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleRespondInvitation(inv.id, true)}
                      style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(34,211,238,0.2)', border: '1px solid #22d3ee', color: '#22d3ee', cursor: 'pointer' }}
                    >
                      ✓ Accept & Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Layout Grid */}
        <div className="teams-layout-grid">
          {/* Sidebar Event Selector */}
          <div className="teams-sidebar">
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 10 }}>
              SELECT EVENT
            </p>

            {loading ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Loading events...</div>
            ) : events.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No upcoming events</div>
            ) : (
              <div className="teams-events-list">
                {events.map((evt) => {
                  const isSelected = selectedEvent?.id === evt.id
                  const enrolled = isEnrolled(evt.id)
                  return (
                    <button
                      key={evt.id}
                      className="teams-event-btn"
                      onClick={() => setSelectedEvent(evt)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1.5px solid #22d3ee' : '1px solid var(--color-cream)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: isSelected ? '#22d3ee' : 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evt.title}
                        </span>
                        {enrolled ? (
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', flexShrink: 0 }}>
                            IN
                          </span>
                        ) : (
                          <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-muted)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                            GUEST
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                        {evt.date} · {evt.maxTeamSize ?? 4} max
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Main Content Workspace */}
          <div className="teams-main-workspace" style={{ minWidth: 0 }}>
            {selectedEvent && (
              <>
                {/* Event Workspace Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', display: 'block', marginBottom: 2 }}>
                      EVENT
                    </span>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--color-text-primary)', margin: 0 }}>
                      {selectedEvent.title}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {myTeam ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', fontFamily: 'var(--font-body)' }}>
                          {myTeam.createdBy === user.id ? `★ Captain of "${myTeam.name}"` : `Member of "${myTeam.name}"`}
                        </span>
                        <button
                          onClick={() => {
                            const members = teamMembers[myTeam.id] || []
                            setActiveChatTeam({ team: myTeam, members })
                          }}
                          style={{
                            padding: '7px 16px',
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 8,
                            cursor: 'pointer',
                            background: myTeamUnread > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,211,238,0.15)',
                            border: myTeamUnread > 0 ? '1px solid rgba(239,68,68,0.5)' : '1px solid #22d3ee',
                            color: myTeamUnread > 0 ? '#f87171' : '#22d3ee',
                            fontFamily: 'var(--font-body)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.2s',
                          }}
                        >
                          💬 Team Chat
                          {myTeamUnread > 0 && (
                            <span style={{ padding: '1px 6px', borderRadius: 10, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, boxShadow: '0 0 8px #ef4444', animation: 'pulse 2s infinite' }}>
                              {myTeamUnread}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenExitModal(myTeam)}
                          style={{
                            padding: '7px 16px',
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 8,
                            cursor: 'pointer',
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.4)',
                            color: '#f87171',
                            fontFamily: 'var(--font-body)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'all 0.2s',
                          }}
                          title="Exit this team"
                        >
                          🚪 Exit Team
                        </button>
                      </div>
                    ) : (
                      isEnrolled(selectedEvent.id) && (
                        !selectedEvent.teamFormationLive && !isAdmin ? (
                          <span
                            style={{
                              padding: '10px 18px',
                              minHeight: 44,
                              fontSize: 12,
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              borderRadius: 12,
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#f87171',
                              fontFamily: 'var(--font-body)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            🔒 Team Formations Closed
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              if (!isProfileComplete) {
                                setProfilePromptAction('create a team')
                                setShowProfilePromptModal(true)
                                return
                              }
                              setShowCreate((v) => !v)
                            }}
                            style={{
                              padding: '12px 24px',
                              minHeight: 48,
                              fontSize: 13,
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              borderRadius: 12,
                              cursor: 'pointer',
                              background: showCreate ? 'rgba(255,255,255,0.06)' : 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
                              border: `1px solid ${showCreate ? 'var(--color-sand)' : 'rgba(255,255,255,0.25)'}`,
                              color: '#ffffff',
                              fontFamily: 'var(--font-body)',
                              boxShadow: '0 6px 18px rgba(62, 88, 104, 0.35)',
                              transition: 'all 0.2s',
                            }}
                          >
                            {showCreate ? '✕ Cancel' : '+ Create Team'}
                          </button>
                        )
                      )
                    )}
                  </div>
                </div>

                {/* Team Formation Closed Banner */}
                {!selectedEvent.teamFormationLive && !isAdmin && (
                  <div
                    style={{
                      marginBottom: 20,
                      padding: '18px 22px',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.04) 100%)',
                      border: '1.5px solid rgba(239,68,68,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'rgba(239,68,68,0.18)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        color: '#f87171',
                        flexShrink: 0,
                      }}
                    >
                      🔒
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text-primary)', margin: '0 0 3px' }}>
                        Team Formations Are Closed
                      </h4>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45, margin: 0 }}>
                        Team formation for <strong>"{selectedEvent.title}"</strong> is currently closed by the organizers. Creating new teams and sending join requests is disabled.
                      </p>
                    </div>
                  </div>
                )}

                {/* Pending Requests for Captain */}
                {pendingRequests.length > 0 && (
                      <RequestsPanel requests={pendingRequests} onAccept={handleAcceptRequest} onReject={handleRejectRequest} loading={reqActionLoading} />
                    )}

                    {/* Create Team Form */}
                    {showCreate && !myTeam && (
                      <form onSubmit={handleCreate} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} style={{ marginBottom: 24, padding: '20px 24px', borderRadius: 14, background: 'rgba(34,211,238,0.03)', border: '1px solid rgba(34,211,238,0.3)', animation: 'cardIn 0.25s ease' }}>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.16em', color: '#22d3ee', fontWeight: 700, marginBottom: 14 }}>
                          CREATE NEW TEAM — {selectedEvent.title.toUpperCase()}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
                              TEAM NAME *
                            </label>
                            <input
                              type="text"
                              value={newTeamName}
                              onChange={(e) => setNewTeamName(e.target.value)}
                              placeholder="e.g. Apex Predators"
                              maxLength={40}
                              autoFocus
                              style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-cream)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div className="teams-form-grid">
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
                                CAPTAIN / TEAM SKILLS (OPTIONAL)
                              </label>
                              <input
                                type="text"
                                value={newTeamSkills}
                                onChange={(e) => setNewTeamSkills(e.target.value)}
                                placeholder="e.g. React, Python, Figma..."
                                style={{ width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-sand)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
                                ACHIEVEMENTS (OPTIONAL)
                              </label>
                              <input
                                type="text"
                                value={newTeamAchievements}
                                onChange={(e) => setNewTeamAchievements(e.target.value)}
                                placeholder="e.g. 1st Place Hackathon 2025..."
                                style={{ width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-sand)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
                              OPEN ROLES IN TEAM (OPTIONAL, COMMA-SEPARATED)
                            </label>
                            <input
                              type="text"
                              value={newTeamOpenRoles}
                              onChange={(e) => setNewTeamOpenRoles(e.target.value)}
                              placeholder="e.g. Frontend Developer, UI Designer, Backend Dev"
                              style={{ width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8, backgroundColor: 'var(--color-white)', border: '1px solid var(--color-sand)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
                            />
                          </div>

                          {createError && <p style={{ fontSize: 11, color: '#f87171', margin: 0, fontFamily: 'var(--font-body)' }}>{createError}</p>}

                          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', fontSize: 12, borderRadius: 8, backgroundColor: 'transparent', border: '1px solid var(--color-sand)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={creating}
                              style={{
                                padding: '9px 24px',
                                fontSize: 12,
                                fontWeight: 700,
                                borderRadius: 8,
                                background: 'rgba(34,211,238,0.2)',
                                border: '1px solid #22d3ee',
                                color: '#22d3ee',
                                cursor: 'pointer',
                              }}
                            >
                              {creating ? 'Creating…' : 'Create Team'}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Search & Filter Toolbar */}
                    <div className="teams-search-bar" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                      <div className="teams-search-input-wrap" style={{ position: 'relative', width: '100%' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search teams, members, skills, or roles…"
                          style={{
                            width: '100%',
                            minHeight: 46,
                            paddingLeft: 40,
                            paddingRight: 14,
                            paddingTop: 10,
                            paddingBottom: 10,
                            fontSize: 13,
                            borderRadius: 12,
                            background: 'var(--color-white)',
                            border: '1px solid var(--color-sand)',
                            color: 'var(--color-text-primary)',
                            fontFamily: 'var(--font-body)',
                            boxSizing: 'border-box',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div className="teams-filter-group" style={{ display: 'inline-flex', padding: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 12, border: '1px solid var(--color-cream)', gap: 6 }}>
                          {[
                            { key: 'all', label: `All ${teams.length}` },
                            { key: 'recruiting', label: `Open ${openCount}` },
                            ...(myTeam ? [{ key: 'myteam', label: 'My Team' }] : []),
                          ].map((f) => (
                            <button
                              key={f.key}
                              onClick={() => setFilterMode(f.key as any)}
                              style={{
                                padding: '6px 16px',
                                fontSize: 12,
                                fontWeight: filterMode === f.key ? 800 : 600,
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: filterMode === f.key ? '#3E5868' : 'transparent',
                                border: 'none',
                                color: filterMode === f.key ? '#ffffff' : 'var(--color-text-secondary)',
                                fontFamily: 'var(--font-body)',
                                transition: 'all 0.2s',
                              }}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                          Showing {filtered.length} of {teams.length} teams
                        </span>
                      </div>
                    </div>

                    {error && (
                      <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 12, fontFamily: 'var(--font-body)' }}>
                        ⚠ {error}
                      </div>
                    )}

                    {/* Teams List */}
                    {teamsLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 240 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #22d3ee', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>Loading teams…</span>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, border: '1px dashed var(--color-sand)', padding: 40 }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-slate-blue)" strokeWidth="1.5">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text-muted)', margin: 0 }}>No teams found</p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                          {searchQuery ? `No results for "${searchQuery}"` : 'No teams created yet. Be the first to create one!'}
                        </p>
                      </div>
                    ) : (
                      <div className="teams-cards-grid">
                        {filtered.map((team, i) => (
                          <TeamCard
                            key={team.id}
                            team={team}
                            members={teamMembers[team.id] || []}
                            isMyTeam={!!(myTeam && myTeam.id === team.id && team.createdBy !== user.id)}
                            isCaptain={team.createdBy === user.id}
                            isAdmin={user?.role === 'admin'}
                            maxSize={selectedEvent.maxTeamSize ?? 4}
                            requestStatus={requestStatuses[team.id] || 'none'}
                            myRequestId={requestIds[team.id]}
                            isEnrolled={isEnrolled(selectedEvent.id)}
                            eventId={selectedEvent.id}
                            userAlreadyHasTeam={!!myTeam && myTeam.id !== team.id}
                            teamFormationLive={selectedEvent.teamFormationLive}
                            onRequestJoin={handleOpenJoinModal}
                            onCancelRequest={handleCancelRequest}
                            onLeave={handleLeave}
                            onKillTeam={handleKillTeam}
                            onTransferCaptaincy={setTransferModalTeam}
                            onOpenChat={(t, m) => setActiveChatTeam({ team: t, members: m })}
                            onInvite={team.createdBy === user.id ? () => setInviteModalTeam(team) : undefined}
                            onShareLink={team.createdBy === user.id ? () => handleShareLink(team) : undefined}
                            onEditDetails={(user?.role === 'admin' || team.createdBy === user.id) ? () => setEditModalTeam(team) : undefined}
                            onKickMember={(user?.role === 'admin' || team.createdBy === user.id) ? (tId, mId, mName) => setKickConfirmData({ teamId: tId, teamName: team.name, memberUserId: mId, memberName: mName || 'Teammate' }) : undefined}
                            onViewProfile={(member: TeamMember, isCap: boolean, tName: string) => setViewingProfile({ member, isCaptain: isCap, teamName: tName })}
                            actionLoading={actionLoading === team.id}
                            index={i}
                          />
                        ))}
                      </div>
                    )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Team Modal (Captain only) */}
      {editModalTeam && user && (
        <EditTeamModal
          team={editModalTeam}
          onClose={() => setEditModalTeam(null)}
          onSave={handleSaveTeamDetails}
          saving={savingTeamDetails}
        />
      )}

      {/* Kick Teammate Confirmation Modal (Captain only) */}
      {kickConfirmData && user && (
        <KickConfirmModal
          teamName={kickConfirmData.teamName}
          memberName={kickConfirmData.memberName}
          onClose={() => setKickConfirmData(null)}
          onConfirm={handleConfirmKickMember}
          loading={kickingLoading}
        />
      )}

      {/* Member Profile Modal — visible to all teammates */}
      {viewingProfile && (
        <MemberProfileModal
          member={viewingProfile.member}
          teamName={viewingProfile.teamName}
          isCaptain={viewingProfile.isCaptain}
          onClose={() => setViewingProfile(null)}
        />
      )}

      {/* Join Request Modal */}
      {joinModalTeam && (
        <JoinRequestModal
          team={joinModalTeam.team}
          selectedRole={joinModalTeam.role}
          onClose={() => setJoinModalTeam(null)}
          onSubmit={handleSendJoinRequestWithSkills}
          submitting={submittingJoin}
        />
      )}

      {/* Transfer Captaincy Modal */}
      {transferModalTeam && user && (
        <TransferCaptainModal
          team={transferModalTeam}
          members={teamMembers[transferModalTeam.id] || []}
          currentUserId={user.id}
          onClose={() => setTransferModalTeam(null)}
          onTransfer={handleTransferCaptaincy}
        />
      )}

      {/* Universal Exit Team Modal */}
      {exitModalTeam && user && (
        <ExitTeamModal
          team={exitModalTeam.team}
          members={exitModalTeam.members}
          currentUserId={user.id}
          onClose={() => setExitModalTeam(null)}
          onConfirmExit={handleConfirmExit}
          loading={exitingLoading}
        />
      )}

      {/* Invite Members Modal (Captain only) */}
      {inviteModalTeam && user && (
        <InviteModal
          teamId={inviteModalTeam.id}
          captainId={user.id}
          teamName={inviteModalTeam.name}
          existingMemberIds={(teamMembers[inviteModalTeam.id] || []).map((m) => m.userId)}
          onClose={() => setInviteModalTeam(null)}
        />
      )}

      {/* Team Chat Modal */}
      {activeChatTeam && user && (
        <TeamChatModal
          team={activeChatTeam.team}
          members={activeChatTeam.members}
          currentUserId={user.id}
          currentUserName={user.name}
          onClose={() => setActiveChatTeam(null)}
        />
      )}

      {/* Link Copied Notification */}
      {linkCopied && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
            padding: '12px 20px',
            borderRadius: 10,
            background: 'rgba(34,211,238,0.95)',
            color: '#000',
            fontWeight: 800,
            fontSize: 12,
            fontFamily: 'var(--font-body)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            animation: 'cardIn 0.2s ease',
          }}
        >
          ✓ Team invite link copied to clipboard!
        </div>
      )}

      {/* Complete Profile Prompt Modal */}
      <CompleteProfilePromptModal
        isOpen={showProfilePromptModal}
        onClose={() => setShowProfilePromptModal(false)}
        missingFields={missingProfileFields}
        actionName={profilePromptAction}
      />
    </div>
  )
}
