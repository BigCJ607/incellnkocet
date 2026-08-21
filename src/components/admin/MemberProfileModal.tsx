import React from 'react';
import type { TeamMember } from '../../mocks/types';

interface MemberProfileModalProps {
  member: TeamMember;
  teamName?: string;
  isCaptain?: boolean;
  onClose: () => void;
}

export default function MemberProfileModal({
  member,
  teamName,
  isCaptain,
  onClose,
}: MemberProfileModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'rgba(5, 5, 15, 0.85)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.2s ease',
        cursor: 'pointer',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          borderRadius: 24,
          overflow: 'hidden',
          background: '#0d0d1a',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.9), 0 0 50px rgba(99,102,241,0.2)',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: isCaptain ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 700,
                color: '#ffffff',
                border: '2px solid rgba(255,255,255,0.2)',
              }}
            >
              {(member.userName?.charAt(0) || 'S').toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#ffffff', margin: 0 }}>
                  {member.userName || 'Student Participant'}
                </h3>
                {isCaptain && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(5, 150, 105, 0.25)', border: '1px solid rgba(5,150,105,0.4)', color: '#6ee7b7', fontFamily: 'var(--font-ui)' }}>
                    👑 CAPTAIN
                  </span>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                STUDENT PARTICIPANT PROFILE
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#ffffff',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Content Grid */}
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {teamName && (
            <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: '#818cf8', fontWeight: 700, display: 'block', marginBottom: 2 }}>
                ENROLLED TEAM
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#ffffff' }}>
                {teamName} {isCaptain ? '(Team Leader / Captain)' : '(Team Member)'}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>
                STUDENT PRN
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#22d3ee', fontWeight: 700 }}>
                {member.userPnr || 'Not Provided'}
              </span>
            </div>

            <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>
                CONTACT EMAIL
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#ffffff', fontWeight: 600, wordBreak: 'break-all' }}>
                {member.userEmail || 'No email on record'}
              </span>
            </div>

            <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>
                BRANCH / DEPARTMENT
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#ffffff', fontWeight: 600 }}>
                {member.userBranch || 'Branch Unassigned'}
              </span>
            </div>

            <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>
                CLASS YEAR & DIVISION
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#ffffff', fontWeight: 600 }}>
                {member.userYear || 'First Year'} {member.userDivision ? `· Div ${member.userDivision}` : ''}
              </span>
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontFamily: 'var(--font-ui)', color: 'rgba(255,255,255,0.4)' }}>
            <span>USER ID: <code style={{ color: '#818cf8' }}>{member.userId}</code></span>
            <span>JOINED TEAM: {new Date(member.joinedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
