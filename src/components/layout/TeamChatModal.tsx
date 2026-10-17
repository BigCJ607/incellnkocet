import React, { useState, useEffect, useRef } from 'react';
import type { Team, TeamMember } from '../../mocks/types';
import { teamChatService, type TeamMessage } from '../../services/teamChatService';

interface TeamChatModalProps {
  team: Team;
  members: TeamMember[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  onClose: () => void;
  readOnly?: boolean;
  adminView?: boolean;
}

export default function TeamChatModal({
  team,
  members,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onClose,
  readOnly = false,
  adminView = false,
}: TeamChatModalProps) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [confirmUnsendId, setConfirmUnsendId] = useState<string | null>(null);
  const [unsendingId, setUnsendingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch initial messages & subscribe to real-time updates
  useEffect(() => {
    let unsubscribe = () => {};
    let isMounted = true;

    teamChatService.getMessages(team.id).then(msgs => {
      if (isMounted) {
        setMessages(msgs);
        setLoading(false);
        teamChatService.markAsRead(team.id, currentUserId);
        setTimeout(scrollToBottom, 100);
      }
    });

    // Realtime subscription — listens for both new messages AND deletes
    unsubscribe = teamChatService.subscribeToMessages(
      team.id,
      (newMsg) => {
        if (isMounted) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          teamChatService.markAsRead(team.id, currentUserId);
          setTimeout(scrollToBottom, 100);
        }
      },
      (deletedId) => {
        if (isMounted) {
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      }
    );

    // Polling fallback (every 3.5s) to guarantee messages sync even without WebSocket
    const intervalId = setInterval(() => {
      if (isMounted) {
        teamChatService.getMessages(team.id).then(latestMsgs => {
          if (isMounted) {
            setMessages(latestMsgs);
          }
        });
      }
    }, 3500);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [team.id]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    setSending(true);

    try {
      const newMsg = await teamChatService.sendMessage(
        team.id,
        currentUserId,
        currentUserName,
        text,
        currentUserAvatar
      );
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Failed to send team message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUnsend = async (msgId: string) => {
    setUnsendingId(msgId);
    setConfirmUnsendId(null);
    // Optimistic removal
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await teamChatService.deleteMessage(msgId, team.id);
    setUnsendingId(null);
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md sm:flex sm:items-center sm:justify-center sm:p-4 cursor-pointer"
      style={{ animation: 'fadeIn 0.2s ease' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full h-full sm:h-[85vh] sm:max-h-[650px] sm:max-w-xl sm:rounded-3xl bg-gradient-to-b from-[#0e0e1a] to-[#121224] border-0 sm:border sm:border-cyan-500/35 shadow-2xl flex flex-col relative overflow-hidden cursor-default"
      >
        {/* Top Header */}
        <div
          className="flex-shrink-0"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: adminView ? '#f59e0b' : '#34d399',
                  boxShadow: adminView ? '0 0 8px #f59e0b' : '0 0 8px #34d399',
                }}
              />
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: adminView ? '#f59e0b' : '#22d3ee',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {adminView ? '👁 ADMIN VIEW — READ ONLY' : 'TEAM CHAT & WORKSPACE'}
              </p>
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                color: '#ffffff',
                margin: '2px 0 0',
                lineHeight: 1.1,
              }}
            >
              {team.name}
            </h2>
          </div>

          {/* Members Avatars & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginRight: 4 }}>
              {members.slice(0, 4).map((m, idx) => {
                const isCap = m.userId === team.createdBy;
                const initial = (m.userName?.charAt(0) || 'U').toUpperCase();
                return (
                  <div
                    key={m.id}
                    title={`${m.userName}${isCap ? ' (Captain)' : ''}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: isCap ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #6366f1, #06b6d4)',
                      border: '2px solid #0e0e1a',
                      marginLeft: idx > 0 ? -8 : 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#ffffff',
                      fontFamily: 'var(--font-display)',
                      position: 'relative',
                    }}
                  >
                    {initial}
                    {isCap && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#34d399',
                          border: '1.5px solid #0e0e1a',
                          boxShadow: '0 0 6px #34d399',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#ffffff',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: '2px solid #22d3ee',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'rgba(34,211,238,0.08)',
                  border: '1px solid rgba(34,211,238,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#22d3ee',
                }}
              >
                💬
              </div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, margin: 0 }}>
                No messages yet. Send a message to start chatting with your team!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSystem = msg.userId === 'system' || msg.userName === 'System';

              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: 'center',
                      margin: '8px 0',
                      padding: '6px 14px',
                      borderRadius: 20,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: 'rgba(255, 255, 255, 0.85)',
                      fontSize: 11,
                      fontFamily: 'var(--font-ui)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      maxWidth: '90%',
                      textAlign: 'center',
                    }}
                  >
                    <span>{msg.content}</span>
                    <span style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.35)', marginLeft: 4 }}>
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                );
              }

              const isMe = msg.userId === currentUserId;
              const isCaptain = members.some(m => m.userId === msg.userId && m.userId === team.createdBy);
              const isHovered = hoveredMsgId === msg.id;
              const isConfirming = confirmUnsendId === msg.id;
              const isUnsending = unsendingId === msg.id;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    opacity: isUnsending ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={() => !readOnly && isMe && setHoveredMsgId(msg.id)}
                  onMouseLeave={() => { setHoveredMsgId(null); if (!isConfirming) setConfirmUnsendId(null); }}
                >
                  {/* Sender Label */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                      fontSize: 11,
                      fontFamily: 'var(--font-ui)',
                      color: isMe ? '#818cf8' : '#22d3ee',
                      fontWeight: 600,
                    }}
                  >
                    {!isMe && (
                      <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {msg.userName}
                      </span>
                    )}
                    {isCaptain && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: 'rgba(52,211,153,0.15)',
                          border: '1px solid rgba(52,211,153,0.3)',
                          color: '#34d399',
                        }}
                      >
                        CAPTAIN
                      </span>
                    )}
                    {isMe && <span>You</span>}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>

                  {/* Message Bubble + Unsend Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div
                      style={{
                        padding: '11px 16px',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMe
                          ? 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(79,70,229,0.35) 100%)'
                          : 'linear-gradient(135deg, rgba(20,20,38,0.9) 0%, rgba(15,25,40,0.95) 100%)',
                        border: isMe
                          ? '1px solid rgba(99,102,241,0.45)'
                          : '1px solid rgba(34,211,238,0.25)',
                        boxShadow: isMe
                          ? '0 4px 20px rgba(99,102,241,0.2)'
                          : '0 4px 20px rgba(0,0,0,0.4)',
                        color: '#ffffff',
                        fontSize: 13,
                        fontFamily: 'var(--font-ui)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Trash / Unsend button — only on own messages, non-admin view, on hover */}
                    {isMe && !readOnly && (isHovered || isConfirming) && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {!isConfirming ? (
                          <button
                            onClick={() => setConfirmUnsendId(msg.id)}
                            title="Unsend message"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              border: '1px solid rgba(239,68,68,0.35)',
                              background: 'rgba(239,68,68,0.1)',
                              color: '#f87171',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 13,
                              transition: 'all 0.15s',
                              flexShrink: 0,
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.25)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; }}
                          >
                            🗑
                          </button>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 4,
                              padding: '6px 8px',
                              borderRadius: 10,
                              background: 'rgba(239,68,68,0.12)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              minWidth: 80,
                            }}
                          >
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700, color: '#f87171', letterSpacing: '0.08em' }}>
                              UNSEND?
                            </span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => handleUnsend(msg.id)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 5,
                                  border: '1px solid rgba(239,68,68,0.5)',
                                  background: 'rgba(239,68,68,0.2)',
                                  color: '#fca5a5',
                                  fontFamily: 'var(--font-ui)',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                YES
                              </button>
                              <button
                                onClick={() => setConfirmUnsendId(null)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 5,
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  background: 'rgba(255,255,255,0.06)',
                                  color: '#9ca3af',
                                  fontFamily: 'var(--font-ui)',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                NO
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar — hidden in read-only / admin view mode */}
        {!readOnly && (
          <form
            onSubmit={handleSend}
            className="flex-shrink-0"
            style={{
              padding: '14px 18px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${team.name} teammates...`}
              style={{
                flex: 1,
                padding: '11px 16px',
                fontSize: 13,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#ffffff',
                fontFamily: 'var(--font-ui)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              style={{
                padding: '11px 20px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 12,
                cursor: inputText.trim() && !sending ? 'pointer' : 'not-allowed',
                background: inputText.trim() && !sending ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${inputText.trim() && !sending ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: inputText.trim() && !sending ? '#22d3ee' : 'rgba(255,255,255,0.3)',
                fontFamily: 'var(--font-ui)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        )}

        {/* Read-only footer for admin view */}
        {readOnly && (
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid rgba(245,158,11,0.2)',
              background: 'rgba(245,158,11,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: '#f59e0b' }}>👁</span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: '#f59e0b',
                opacity: 0.75,
              }}
            >
              ADMIN SURVEILLANCE MODE — MESSAGES ARE READ ONLY
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
