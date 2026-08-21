import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { AppNotification } from '../../mocks/types';
import { notificationService } from '../../services/notificationService';

interface Props {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onNotificationsChanged?: () => void;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export default function NotificationsDropdown({
  userId,
  isOpen,
  onClose,
  onNotificationsChanged,
}: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(userId);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadNotifications();
    }
  }, [isOpen, userId]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      // If the dropdown is hidden by CSS (e.g. mobile vs desktop), ignore outside clicks
      if (dropdownRef.current.offsetWidth === 0) return;
      
      if (!dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (notifId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notifId ? { ...n, read: true } : n))
    );
    await notificationService.markAsRead(notifId, userId);
    if (onNotificationsChanged) onNotificationsChanged();
    window.dispatchEvent(new CustomEvent('app_notifications_updated', { detail: { userId } }));
  };

  const handleMarkAllAsRead = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await notificationService.markAllAsRead(userId);
    if (onNotificationsChanged) onNotificationsChanged();
    window.dispatchEvent(new CustomEvent('app_notifications_updated', { detail: { userId } }));
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    await notificationService.deleteNotification(notifId, userId);
    if (onNotificationsChanged) onNotificationsChanged();
    window.dispatchEvent(new CustomEvent('app_notifications_updated', { detail: { userId } }));
  };

  const handleItemClick = (notif: AppNotification) => {
    if (!notif.read) {
      handleMarkAsRead(notif.id);
    }
    if (notif.type === 'profile_alert' || notif.type === 'warning' || notif.title?.toLowerCase().includes('profile')) {
      onClose();
      window.dispatchEvent(new CustomEvent('open_profile_edit_mode'));
      navigate('/profile?edit=true', { state: { autoEdit: true, from: location.pathname + location.search } });
      return;
    }
    if (notif.teamId || notif.eventId) {
      onClose();
      navigate('/teams');
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'profile_alert':
      case 'warning':
        return { icon: '⚠️', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' };
      case 'member_exit':
        return { icon: '🚪', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' };
      case 'captain_promoted':
        return { icon: '👑', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' };
      case 'member_kicked':
        return { icon: '🚫', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)' };
      case 'team_invite':
        return { icon: '✉️', color: '#a5b4fc', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' };
      case 'join_request':
        return { icon: '🙋', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.3)' };
      default:
        return { icon: '🔔', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)' };
    }
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 12px)',
        right: 0,
        pointerEvents: 'auto',
        width: 'clamp(320px, 90vw, 420px)',
        maxHeight: '80vh',
        background: 'rgba(15, 15, 25, 0.96)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(34, 211, 238, 0.08)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'notifDropdownIn 0.2s ease-out',
      }}
    >
      <style>{`
        @keyframes notifDropdownIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔔</span>
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#ffffff',
              textTransform: 'uppercase',
            }}
          >
            Notifications
          </span>
          {unreadCount > 0 && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#f87171',
                fontSize: 10,
                fontWeight: 800,
                fontFamily: 'var(--font-ui)',
              }}
            >
              {unreadCount} NEW
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#22d3ee',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: 420,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: 12 }}>
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              ✨
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)' }}>
              All caught up!
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255, 255, 255, 0.35)' }}>
              No notifications at the moment. Team exit alerts and captain updates will appear here.
            </p>
          </div>
        ) : (
          notifications.map(notif => {
            const badge = getTypeIcon(notif.type);
            return (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: notif.read
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'linear-gradient(135deg, rgba(34, 211, 238, 0.06), rgba(99, 102, 241, 0.06))',
                  border: notif.read
                    ? '1px solid rgba(255, 255, 255, 0.05)'
                    : '1px solid rgba(34, 211, 238, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = notif.read
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(34, 211, 238, 0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = notif.read
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'linear-gradient(135deg, rgba(34, 211, 238, 0.06), rgba(99, 102, 241, 0.06))';
                }}
              >
                {/* Icon badge */}
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {badge.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: notif.read ? 'rgba(255, 255, 255, 0.85)' : '#ffffff',
                          fontFamily: 'var(--font-ui)',
                        }}
                      >
                        {notif.title}
                      </span>
                      {!notif.read && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#22d3ee',
                            boxShadow: '0 0 6px #22d3ee',
                            display: 'inline-block',
                          }}
                        />
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgba(255, 255, 255, 0.35)',
                        fontFamily: 'var(--font-ui)',
                        flexShrink: 0,
                      }}
                    >
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 11.5,
                      color: notif.read ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.85)',
                      fontFamily: 'var(--font-ui)',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {notif.message}
                  </p>

                  {notif.teamName && (
                    <div style={{ marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: '#a5b4fc',
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(129, 140, 248, 0.1)',
                          border: '1px solid rgba(129, 140, 248, 0.25)',
                          display: 'inline-block',
                        }}
                      >
                        Team: {notif.teamName}
                      </span>
                    </div>
                  )}

                  {/* Direct Edit Profile Action Button */}
                  {(notif.type === 'profile_alert' || notif.type === 'warning' || notif.title.toLowerCase().includes('profile')) && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleMarkAsRead(notif.id);
                          onClose();
                          window.dispatchEvent(new CustomEvent('open_profile_edit_mode'));
                          navigate('/profile?edit=true', { state: { autoEdit: true, from: location.pathname + location.search } });
                        }}
                        style={{
                          padding: '6px 14px',
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          border: '1px solid rgba(245, 158, 11, 0.6)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'var(--font-ui)',
                          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.9';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <span>✏️</span>
                        <span>Edit Profile Now →</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, notif.id)}
                  title="Delete notification"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: 12,
                    cursor: 'pointer',
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                    position: 'relative',
                    zIndex: 20,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#f87171';
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(0, 0, 0, 0.25)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={() => {
            onClose();
            navigate('/teams');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#22d3ee')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
        >
          <span>Go to Teams Workspace</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
