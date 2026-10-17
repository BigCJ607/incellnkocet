import React, { useState, useEffect } from 'react';
import type { EventData, Team, TeamMember, EventWinner, Submission } from '../../mocks/types';
import { teamService } from '../../services/teamService';
import { adminService } from '../../services/adminService';
import { eventService } from '../../services/eventService';
import { submissionService } from '../../services/submissionService';
import { exportTeamsToCSV } from '../../utils/csvExporter';
import TeamDetailsModal from './TeamDetailsModal';
import MemberProfileModal from './MemberProfileModal';

interface AdminEventTeamsModalProps {
  event: EventData;
  onClose: () => void;
  onWinnerUpdated: () => void;
}

export default function AdminEventTeamsModal({
  event,
  onClose,
  onWinnerUpdated,
}: AdminEventTeamsModalProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, TeamMember[]>>({});
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(true);
  const [savingWinner, setSavingWinner] = useState<string | null>(null);
  const [declaredWinners, setDeclaredWinners] = useState<EventWinner[]>(event.winners || []);
  const [selectedTeamForModal, setSelectedTeamForModal] = useState<Team | null>(null);
  const [selectedMemberForModal, setSelectedMemberForModal] = useState<{ member: TeamMember; teamName?: string; isCaptain?: boolean } | null>(null);
  const [teamFormationLive, setTeamFormationLive] = useState<boolean>(!!event.teamFormationLive);
  const [togglingFormation, setTogglingFormation] = useState(false);

  const handleToggleFormation = async () => {
    const newStatus = !teamFormationLive;
    setTogglingFormation(true);
    try {
      await eventService.toggleTeamFormation(event.id, newStatus);
      setTeamFormationLive(newStatus);
      event.teamFormationLive = newStatus;
      onWinnerUpdated();
    } catch (err: any) {
      alert(`Failed to update team formation status: ${err.message}`);
    } finally {
      setTogglingFormation(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const [eventTeams, submissions] = await Promise.all([
          teamService.getTeamsForEvent(event.id),
          submissionService.getSubmissions(event.id),
        ]);

        const membersMap: Record<string, TeamMember[]> = {};
        await Promise.all(
          eventTeams.map(async (t) => {
            membersMap[t.id] = await teamService.getTeamMembers(t.id);
          })
        );

        const resolvedSubMap: Record<string, Submission> = {};
        eventTeams.forEach((t) => {
          const members = membersMap[t.id] || [];
          const possibleKeys = [
            t.id,
            t.name,
            t.createdBy,
            ...members.map((m) => m.userId),
            ...members.map((m) => m.userName),
          ]
            .filter(Boolean)
            .map((k) => (k || '').toLowerCase().trim());

          for (const sub of submissions) {
            const subKey = (sub.teamId || '').toLowerCase().trim();
            if (
              possibleKeys.includes(subKey) ||
              possibleKeys.some(
                (pk) =>
                  pk &&
                  subKey &&
                  (pk.includes(subKey) || subKey.includes(pk))
              )
            ) {
              resolvedSubMap[t.id] = sub;
              break;
            }
          }
        });

        if (isMounted) {
          setTeams(eventTeams);
          setTeamMembersMap(membersMap);
          setSubmissionsMap(resolvedSubMap);
        }
      } catch (err) {
        console.error('Failed to fetch event teams for admin:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTeams();
    return () => {
      isMounted = false;
    };
  }, [event.id]);

  const handleDeclareWinner = async (team: Team, position: '1st' | '2nd' | '3rd' | 'Winner') => {
    setSavingWinner(team.id);
    try {
      const members = teamMembersMap[team.id] || [];
      const memberNames = members.map(m => m.userName).filter((name): name is string => Boolean(name));
      
      const winnerObj: EventWinner = {
        teamId: team.id,
        teamName: team.name,
        position,
        members: memberNames.length > 0 ? memberNames : ['Team Members'],
        declaredAt: new Date().toISOString(),
      };

      await eventService.declareEventWinner(event.id, winnerObj);
      
      // Update local modal state
      setDeclaredWinners(prev => {
        const filtered = prev.filter(w => w.teamId !== team.id && w.position !== position);
        return [...filtered, winnerObj];
      });

      onWinnerUpdated();
    } catch (err) {
      console.error('Failed to declare winner:', err);
    } finally {
      setSavingWinner(null);
    }
  };

  const handleRemoveWinner = async (teamId: string) => {
    try {
      await eventService.removeEventWinner(event.id, teamId);
      setDeclaredWinners(prev => prev.filter(w => w.teamId !== teamId));
      onWinnerUpdated();
    } catch (err) {
      console.error('Failed to remove winner:', err);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"? All team members will be unassigned and all data will be completely deleted from the database. Cannot be undone.`)) {
      return;
    }
    try {
      await adminService.deleteTeam(teamId);
      setTeams(prev => prev.filter(t => t.id !== teamId));
      onWinnerUpdated();
    } catch (err: any) {
      alert(`Failed to delete team: ${err.message}`);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(5, 5, 15, 0.9)',
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
          maxWidth: 780,
          maxHeight: '88vh',
          borderRadius: 24,
          overflow: 'hidden',
          background: '#0d0d18',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.9), 0 0 60px rgba(99,102,241,0.2)',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
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
                  color: '#818cf8',
                }}
              >
                ADMIN TEAMS ROSTER & WINNERS
              </span>
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {event.title}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleToggleFormation}
              disabled={togglingFormation}
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                background: teamFormationLive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: teamFormationLive ? '1px solid #22c55e' : '1px solid #ef4444',
                color: teamFormationLive ? '#4ade80' : '#f87171',
                fontFamily: 'var(--font-ui)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
              }}
              title="Click to toggle team formation open/closed for students"
            >
              {togglingFormation ? 'UPDATING...' : teamFormationLive ? '🟢 FORMATION: LIVE' : '🔒 FORMATION: CLOSED'}
            </button>

            <button
              onClick={() => exportTeamsToCSV(event.title, teams, teamMembersMap, {}, declaredWinners)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                padding: '6px 14px',
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#6ee7b7',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📥 EXPORT TEAMS CSV
            </button>

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
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Declared Winners Banner if any */}
          {declaredWinners.length > 0 && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(245, 158, 11, 0.06) 100%)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                boxShadow: '0 0 25px rgba(234, 179, 8, 0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>🏆</span>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    color: '#fef08a',
                    margin: 0,
                  }}
                >
                  Official Event Winners
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {declaredWinners.map((w) => (
                  <div
                    key={w.teamId + w.position}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(234,179,8,0.25)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: w.position === '1st' || w.position === 'Winner' ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.1)',
                            color: w.position === '1st' || w.position === 'Winner' ? '#fde047' : '#e2e8f0',
                            fontFamily: 'var(--font-ui)',
                          }}
                        >
                          {w.position === '1st' ? '🥇 1st Place Champion' : w.position === '2nd' ? '🥈 2nd Place Runner Up' : w.position === '3rd' ? '🥉 3rd Place' : '🏆 Winner'}
                        </span>
                        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#ffffff' }}>
                          {w.teamName}
                        </strong>
                      </div>
                      {w.members && w.members.length > 0 && (
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>
                          Members: {w.members.join(', ')}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveWinner(w.teamId)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11,
                        borderRadius: 6,
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      Remove Winner
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teams List Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#ffffff', margin: 0 }}>
              Registered Teams ({teams.length})
            </h3>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              Click 'Declare Winner' to crown a team
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-ui)' }}>
              Loading registered teams...
            </div>
          ) : teams.length === 0 ? (
            <div
              style={{
                padding: '40px',
                borderRadius: 16,
                border: '1px dashed rgba(255,255,255,0.1)',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              No teams registered for this event yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(() => {
                const takenPositions = new Set(declaredWinners.map(w => w.position));
                return teams.map((t) => {
                  const members = teamMembersMap[t.id] || [];
                  const isWinner = declaredWinners.some(w => w.teamId === t.id);
                  const currentWinner = declaredWinners.find(w => w.teamId === t.id);

                return (
                  <div
                    key={t.id}
                    style={{
                      padding: '18px 20px',
                      borderRadius: 16,
                      background: isWinner ? 'rgba(234, 179, 8, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: isWinner ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <h4
                            onClick={() => setSelectedTeamForModal(t)}
                            style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#ffffff', margin: 0, cursor: 'pointer' }}
                            title="Click to view full team & member details"
                          >
                            {t.name}
                          </h4>
                          <button
                            onClick={() => setSelectedTeamForModal(t)}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(34,211,238,0.12)',
                              border: '1px solid rgba(34,211,238,0.3)',
                              color: '#22d3ee',
                              fontFamily: 'var(--font-ui)',
                              cursor: 'pointer',
                            }}
                          >
                            🔍 VIEW DETAILS ↗
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(t.id, t.name)}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(239,68,68,0.15)',
                              border: '1px solid rgba(239,68,68,0.35)',
                              color: '#f87171',
                              fontFamily: 'var(--font-ui)',
                              cursor: 'pointer',
                            }}
                            title={`Permanently delete team ${t.name} from database`}
                          >
                            🗑 DELETE TEAM
                          </button>
                          {isWinner && (
                            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.4)', color: '#fde047', fontFamily: 'var(--font-ui)' }}>
                              🏆 {currentWinner?.position || 'Winner'}
                            </span>
                          )}
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#818cf8', fontWeight: 600 }}>
                            👥 {members.length} Members
                          </span>
                        </div>

                        {t.skills && (
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#22d3ee', margin: '4px 0 0' }}>
                            Skills: {t.skills}
                          </p>
                        )}
                      </div>

                      {/* Declare Winner Action Controls (Disappearing positions logic) */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {isWinner ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fde047', fontFamily: 'var(--font-ui)' }}>
                              Awarded: {currentWinner?.position} Place
                            </span>
                            <button
                              onClick={() => handleRemoveWinner(t.id)}
                              style={{
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: 'rgba(239,68,68,0.12)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#f87171',
                                fontFamily: 'var(--font-ui)',
                              }}
                            >
                              Remove Winner
                            </button>
                          </div>
                        ) : (
                          <>
                            {!takenPositions.has('1st') && (
                              <button
                                disabled={savingWinner === t.id}
                                onClick={() => handleDeclareWinner(t, '1st')}
                                style={{
                                  padding: '7px 12px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  background: 'rgba(234, 179, 8, 0.15)',
                                  border: '1px solid rgba(234, 179, 8, 0.4)',
                                  color: '#fde047',
                                  fontFamily: 'var(--font-ui)',
                                }}
                              >
                                🥇 1st Place (Winner)
                              </button>
                            )}

                            {!takenPositions.has('2nd') && (
                              <button
                                disabled={savingWinner === t.id}
                                onClick={() => handleDeclareWinner(t, '2nd')}
                                style={{
                                  padding: '7px 12px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  background: 'rgba(148, 163, 184, 0.15)',
                                  border: '1px solid rgba(148, 163, 184, 0.4)',
                                  color: '#cbd5e1',
                                  fontFamily: 'var(--font-ui)',
                                }}
                              >
                                🥈 2nd Place
                              </button>
                            )}

                            {!takenPositions.has('3rd') && (
                              <button
                                disabled={savingWinner === t.id}
                                onClick={() => handleDeclareWinner(t, '3rd')}
                                style={{
                                  padding: '7px 12px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  background: 'rgba(217, 119, 6, 0.15)',
                                  border: '1px solid rgba(217, 119, 6, 0.4)',
                                  color: '#f97316',
                                  fontFamily: 'var(--font-ui)',
                                }}
                              >
                                🥉 3rd Place
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Members List Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {members.map((m) => {
                        const isCap = m.userId === t.createdBy;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMemberForModal({ member: m, teamName: t.name, isCaptain: isCap })}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              cursor: 'pointer',
                            }}
                            title="Click to view full student profile details"
                          >
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: isCap ? '#059669' : '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#fff',
                              }}
                            >
                              {(m.userName?.charAt(0) || 'U').toUpperCase()}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.userName} {isCap && '👑'}
                              </p>
                              {m.userBranch && (
                                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                                  {m.userBranch}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Deliverable Quick Preview */}
                    {submissionsMap[t.id] && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 8, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: 16 }}>{submissionsMap[t.id].fileName ? '📦' : '🔗'}</span>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: '#22d3ee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {submissionsMap[t.id].fileName || submissionsMap[t.id].repoUrl}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedTeamForModal(t)}
                          style={{
                            padding: '4px 10px',
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            background: 'rgba(34,211,238,0.15)',
                            border: '1px solid rgba(34,211,238,0.4)',
                            color: '#22d3ee',
                            fontFamily: 'var(--font-ui)',
                            cursor: 'pointer',
                          }}
                        >
                          Inspect Deliverables ↗
                        </button>
                      </div>
                    )}
                  </div>
                );
              })})()}
            </div>
          )}
        </div>
      </div>

      {selectedTeamForModal && (
        <TeamDetailsModal
          team={selectedTeamForModal}
          members={teamMembersMap[selectedTeamForModal.id] || []}
          submission={submissionsMap[selectedTeamForModal.id]}
          winner={declaredWinners.find(w => w.teamId === selectedTeamForModal.id)}
          event={event}
          onClose={() => setSelectedTeamForModal(null)}
          onDeleteSubmission={async (submissionId, teamName) => {
            if (!window.confirm(`Delete deliverable submission for team "${teamName}"?`)) return;
            await submissionService.deleteSubmission(submissionId, event.id);
            setSubmissionsMap(prev => {
              const updated = { ...prev };
              delete updated[selectedTeamForModal.id];
              return updated;
            });
          }}
        />
      )}
      {selectedMemberForModal && (
        <MemberProfileModal
          member={selectedMemberForModal.member}
          teamName={selectedMemberForModal.teamName}
          isCaptain={selectedMemberForModal.isCaptain}
          onClose={() => setSelectedMemberForModal(null)}
        />
      )}
    </div>
  );
}
