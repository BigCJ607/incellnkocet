import React, { useState } from 'react';
import type { AdminUserView } from '../../mocks/types';
import { notificationService } from '../../services/notificationService';

export interface IncompleteUserDetail {
  user: AdminUserView;
  missingFields: string[];
}

export function getMissingProfileFields(u: AdminUserView): string[] {
  const missing: string[] = [];
  const cleanPnr = (u.pnr || '').trim();
  if (!cleanPnr || cleanPnr.toUpperCase() === 'NOT SET' || cleanPnr.toUpperCase() === 'NOT PROVIDED') {
    missing.push('PRN Number');
  }
  const cleanPhone = (u.phoneNumber || '').trim();
  if (!cleanPhone || cleanPhone.toUpperCase() === 'N/A' || cleanPhone.length < 8) {
    missing.push('Phone Number');
  }
  const cleanBranch = (u.branch || '').trim();
  if (!cleanBranch || cleanBranch.toLowerCase().includes('unassigned')) {
    missing.push('Branch');
  }
  const cleanYear = (u.classYear || '').trim();
  if (!cleanYear) {
    missing.push('Year of Study');
  }
  const cleanDiv = (u.division || '').trim();
  if (!cleanDiv) {
    missing.push('Division');
  }
  return missing;
}

interface Props {
  users: AdminUserView[];
  onClose: () => void;
  onAlertSent?: (count: number) => void;
}

export default function IncompleteProfilesAlertModal({
  users,
  onClose,
  onAlertSent,
}: Props) {
  // Calculate users with incomplete profiles
  const incompleteUsers: IncompleteUserDetail[] = React.useMemo(() => {
    return users
      .map((u) => ({
        user: u,
        missingFields: getMissingProfileFields(u),
      }))
      .filter((item) => item.missingFields.length > 0);
  }, [users]);

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() =>
    incompleteUsers.map((item) => item.user.id)
  );

  const [alertTitle, setAlertTitle] = useState(
    '⚠️ Action Required: Complete Your Student Profile'
  );
  const [alertMessage, setAlertMessage] = useState(
    'Your student profile is currently incomplete. Please update your PRN, Branch, Year, Division, and Phone Number in your Profile Settings so your event registrations and team memberships can be verified.'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [sentSuccess, setSentSuccess] = useState(false);

  const filteredIncomplete = incompleteUsers.filter(
    (item) =>
      item.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.user.pnr && item.user.pnr.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const allFilteredSelected =
    filteredIncomplete.length > 0 &&
    filteredIncomplete.every((item) => selectedUserIds.includes(item.user.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredIncomplete.map((item) => item.user.id));
      setSelectedUserIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const newSelected = new Set(selectedUserIds);
      filteredIncomplete.forEach((item) => newSelected.add(item.user.id));
      setSelectedUserIds(Array.from(newSelected));
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSendBroadcast = async () => {
    if (selectedUserIds.length === 0) {
      alert('Please select at least one student to send the alert to.');
      return;
    }
    if (!alertTitle.trim() || !alertMessage.trim()) {
      alert('Please enter a notification title and message.');
      return;
    }

    setSending(true);
    setProgress({ current: 0, total: selectedUserIds.length });

    let sentCount = 0;
    for (let i = 0; i < selectedUserIds.length; i++) {
      const targetUserId = selectedUserIds[i];
      try {
        await notificationService.createNotification({
          userId: targetUserId,
          type: 'profile_alert',
          title: alertTitle.trim(),
          message: alertMessage.trim(),
        });
        sentCount++;
      } catch (err) {
        console.warn(`Failed to send alert to user ${targetUserId}:`, err);
      }
      setProgress({ current: i + 1, total: selectedUserIds.length });
    }

    setSending(false);
    setSentSuccess(true);
    if (onAlertSent) {
      onAlertSent(sentCount);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(5, 5, 15, 0.92)',
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
          maxWidth: 760,
          maxHeight: '90vh',
          borderRadius: 24,
          overflow: 'hidden',
          background: '#0d0d18',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.9), 0 0 60px rgba(245, 158, 11, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(0,0,0,0) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  color: '#fbbf24',
                }}
              >
                ADMIN NOTIFICATION BROADCAST
              </span>
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                color: '#ffffff',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span>📢 Alert Incomplete Profiles</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: 'rgba(245,158,11,0.2)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  color: '#fbbf24',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {incompleteUsers.length} Incomplete
              </span>
            </h2>
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

        {/* Modal Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sentSuccess ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid #22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  color: '#4ade80',
                }}
              >
                ✓
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: '#ffffff', margin: 0 }}>
                Alerts Dispatched Successfully!
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#94a3b8', maxWidth: 460, margin: 0 }}>
                Sent profile completion alerts to <strong>{selectedUserIds.length}</strong> participants. They will receive the in-app notification bell alert and direct link to complete their profile.
              </p>
              <button
                onClick={onClose}
                style={{
                  marginTop: 10,
                  padding: '10px 28px',
                  borderRadius: 10,
                  background: '#22c55e',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Close Window
              </button>
            </div>
          ) : (
            <>
              {/* Notification Details Form */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fbbf24',
                      letterSpacing: '0.08em',
                      marginBottom: 6,
                    }}
                  >
                    ALERT TITLE
                  </label>
                  <input
                    type="text"
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#ffffff',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fbbf24',
                      letterSpacing: '0.08em',
                      marginBottom: 6,
                    }}
                  >
                    ALERT MESSAGE
                  </label>
                  <textarea
                    rows={3}
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#ffffff',
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              {/* Recipients Selection */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, color: '#ffffff', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#f59e0b' }}
                      />
                      <span>Select All ({filteredIncomplete.length})</span>
                    </label>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-ui)' }}>
                      • <strong>{selectedUserIds.length}</strong> recipients selected
                    </span>
                  </div>

                  <input
                    type="text"
                    placeholder="Filter by student name, email, PRN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      fontSize: 12,
                      fontFamily: 'var(--font-ui)',
                      minWidth: 220,
                    }}
                  />
                </div>

                {/* Incomplete Users List */}
                {incompleteUsers.length === 0 ? (
                  <div
                    style={{
                      padding: '30px 20px',
                      textAlign: 'center',
                      background: 'rgba(34,197,94,0.06)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 12,
                      color: '#4ade80',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 13,
                    }}
                  >
                    🎉 All registered students have complete profiles! No missing details found.
                  </div>
                ) : filteredIncomplete.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontFamily: 'var(--font-ui)' }}>
                    No incomplete profiles match your search filter.
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: 280,
                      overflowY: 'auto',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(0,0,0,0.25)',
                    }}
                  >
                    {filteredIncomplete.map((item) => {
                      const isChecked = selectedUserIds.includes(item.user.id);
                      return (
                        <div
                          key={item.user.id}
                          onClick={() => toggleUser(item.user.id)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            cursor: 'pointer',
                            background: isChecked ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#f59e0b', flexShrink: 0 }}
                            />
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: '#1e1b4b',
                                border: '1px solid rgba(99,102,241,0.4)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {(item.user.name?.charAt(0) || '?').toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-ui)' }} className="truncate">
                                {item.user.name}
                              </p>
                              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-ui)' }} className="truncate">
                                {item.user.email}
                              </p>
                            </div>
                          </div>

                          {/* Missing Fields Badges */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {item.missingFields.map((field) => (
                              <span
                                key={field}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  color: '#f87171',
                                  fontFamily: 'var(--font-ui)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Missing {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!sentSuccess && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-ui)' }}>
              {sending ? (
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                  Sending alerts... ({progress.current} of {progress.total})
                </span>
              ) : (
                <span>Ready to alert <strong>{selectedUserIds.length}</strong> student{selectedUserIds.length === 1 ? '' : 's'}</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={onClose}
                disabled={sending}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#cbd5e1',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleSendBroadcast}
                disabled={sending || selectedUserIds.length === 0}
                style={{
                  padding: '9px 22px',
                  borderRadius: 8,
                  background: sending || selectedUserIds.length === 0 ? 'rgba(245,158,11,0.2)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: '1px solid rgba(245,158,11,0.5)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  cursor: sending || selectedUserIds.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-ui)',
                  boxShadow: sending || selectedUserIds.length === 0 ? 'none' : '0 4px 15px rgba(245,158,11,0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {sending ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    <span>SENDING ALERTS...</span>
                  </>
                ) : (
                  <>
                    <span>📢 SEND ALERTS ({selectedUserIds.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
