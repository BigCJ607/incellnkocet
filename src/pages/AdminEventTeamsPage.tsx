import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { eventService } from '../services/eventService';
import { teamService } from '../services/teamService';
import { submissionService } from '../services/submissionService';
import { isOriginalAdminEmail } from '../services/authService';
import { exportTeamsToCSV } from '../utils/csvExporter';
import TeamDetailsModal from '../components/admin/TeamDetailsModal';
import MemberProfileModal from '../components/admin/MemberProfileModal';
import type { EventData, Team, TeamMember, EventWinner, Submission } from '../mocks/types';

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getDeliverableMeta(submission: Submission) {
  const fileName = submission.fileName || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const url = submission.fileUrl || submission.fileData || (submission.repoUrl?.startsWith('http') || submission.repoUrl?.startsWith('data:') ? submission.repoUrl : '');

  let icon = '📄';
  let badgeBg = 'rgba(148, 163, 184, 0.15)';
  let badgeBorder = 'rgba(148, 163, 184, 0.3)';
  let textColor = '#cbd5e1';
  let label = 'Document';

  if (ext === 'pdf') {
    icon = '📕';
    badgeBg = 'rgba(239, 68, 68, 0.15)';
    badgeBorder = 'rgba(239, 68, 68, 0.35)';
    textColor = '#f87171';
    label = 'PDF Document';
  } else if (['ppt', 'pptx', 'pot', 'potx', 'odp', 'key'].includes(ext)) {
    icon = '📊';
    badgeBg = 'rgba(249, 115, 22, 0.15)';
    badgeBorder = 'rgba(249, 115, 22, 0.35)';
    textColor = '#fb923c';
    label = 'PowerPoint Presentation';
  } else if (['doc', 'docx', 'rtf', 'odt', 'txt', 'pages'].includes(ext)) {
    icon = '📝';
    badgeBg = 'rgba(59, 130, 246, 0.15)';
    badgeBorder = 'rgba(59, 130, 246, 0.35)';
    textColor = '#60a5fa';
    label = 'Word Document';
  } else if (['xls', 'xlsx', 'csv', 'ods', 'tsv', 'numbers'].includes(ext)) {
    icon = '📈';
    badgeBg = 'rgba(16, 185, 129, 0.15)';
    badgeBorder = 'rgba(16, 185, 129, 0.35)';
    textColor = '#34d399';
    label = 'Excel Spreadsheet';
  } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz'].includes(ext)) {
    icon = '📦';
    badgeBg = 'rgba(168, 85, 247, 0.15)';
    badgeBorder = 'rgba(168, 85, 247, 0.35)';
    textColor = '#c084fc';
    label = 'ZIP / Archive';
  } else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico'].includes(ext)) {
    icon = '🖼️';
    badgeBg = 'rgba(34, 211, 238, 0.15)';
    badgeBorder = 'rgba(34, 211, 238, 0.35)';
    textColor = '#22d3ee';
    label = 'Image / Graphic';
  } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    icon = '🎥';
    badgeBg = 'rgba(244, 63, 94, 0.15)';
    badgeBorder = 'rgba(244, 63, 94, 0.35)';
    textColor = '#fb7185';
    label = 'Video Demo';
  } else if (['fig', 'sketch', 'xd', 'psd', 'ai'].includes(ext)) {
    icon = '🎨';
    badgeBg = 'rgba(236, 72, 153, 0.15)';
    badgeBorder = 'rgba(236, 72, 153, 0.35)';
    textColor = '#f472b6';
    label = 'Design File';
  }

  const isDownloadable = Boolean(url);

  return { fileName, ext, url, icon, badgeBg, badgeBorder, textColor, label, isDownloadable };
}

function handleOpenDeliverable(url?: string, fileName: string = 'deliverable') {
  if (!url) {
    alert(`File deliverable recorded (${fileName}), but no direct download URL is available.`);
    return;
  }
  
  if (url.startsWith('data:')) {
    try {
      const arr = url.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'deliverable';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    } catch (e) {
      console.warn('Blob download error:', e);
    }
  }

  const a = document.createElement('a');
  a.href = url.startsWith('http') ? url : `https://${url}`;
  a.target = '_blank';
  a.rel = 'noreferrer noopener';
  if (fileName) {
    a.download = fileName;
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function AdminEventTeamsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useApp();

  const [event, setEvent] = useState<EventData | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, TeamMember[]>>({});
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, Submission>>({});
  const [unmatchedSubmissions, setUnmatchedSubmissions] = useState<Submission[]>([]);
  const [declaredWinners, setDeclaredWinners] = useState<EventWinner[]>([]);
  const [selectedTeamForModal, setSelectedTeamForModal] = useState<Team | null>(null);
  const [selectedMemberForModal, setSelectedMemberForModal] = useState<{ member: TeamMember; teamName?: string; isCaptain?: boolean } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [savingWinner, setSavingWinner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'submitted' | 'winners'>('all');

  const isAdmin = user?.role === 'admin' || isOriginalAdminEmail(user?.email);

  const loadPageData = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [allEvents, eventTeams, submissions] = await Promise.all([
        eventService.getAllEvents(),
        teamService.getTeamsForEvent(eventId),
        submissionService.getSubmissions(eventId),
      ]);

      const foundEvent = allEvents.find((e) => e.id === eventId);
      setEvent(foundEvent || null);
      setDeclaredWinners(foundEvent?.winners || []);
      setTeams(eventTeams);

      // Fetch team members for each team
      const membersMap: Record<string, TeamMember[]> = {};
      await Promise.all(
        eventTeams.map(async (t) => {
          membersMap[t.id] = await teamService.getTeamMembers(t.id);
        })
      );
      setTeamMembersMap(membersMap);

      // Robust multi-key matcher for submissions
      const resolvedSubMap: Record<string, Submission> = {};
      const matchedSubIds = new Set<string>();

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
            matchedSubIds.add(sub.id);
            break;
          }
        }
      });
      setSubmissionsMap(resolvedSubMap);

      // Collect any standalone submissions not directly attached to a team
      const unmatched = submissions.filter((s) => !matchedSubIds.has(s.id));
      setUnmatchedSubmissions(unmatched);
    } catch (err) {
      console.error('Failed to load admin event teams data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, [eventId]);

  const handleDeclareWinner = async (team: Team, position: '1st' | '2nd' | '3rd' | 'Winner') => {
    if (!event) return;
    setSavingWinner(team.id);
    try {
      const members = teamMembersMap[team.id] || [];
      const memberNames = members
        .map((m) => m.userName)
        .filter((name): name is string => Boolean(name));

      const winnerObj: EventWinner = {
        teamId: team.id,
        teamName: team.name,
        position,
        members: memberNames.length > 0 ? memberNames : ['Team Members'],
        declaredAt: new Date().toISOString(),
      };

      await eventService.declareEventWinner(event.id, winnerObj);

      // Update state
      setDeclaredWinners((prev) => {
        const filtered = prev.filter((w) => w.teamId !== team.id && w.position !== position);
        return [...filtered, winnerObj];
      });
    } catch (err) {
      console.error('Failed to declare winner:', err);
    } finally {
      setSavingWinner(null);
    }
  };

  const handleRemoveWinner = async (teamId: string) => {
    try {
      await eventService.removeEventWinner(event!.id, teamId);
      setDeclaredWinners((prev) => prev.filter((w) => w.teamId !== teamId));
      loadPageData();
    } catch (err) {
      console.error('Failed to remove winner:', err);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"? All members will be unassigned. This cannot be undone.`)) {
      return;
    }
    try {
      await teamService.deleteTeam(teamId, user!.id);
      loadPageData();
    } catch (err: any) {
      alert(`Failed to delete team: ${err.message}`);
    }
  };

  const handleDeleteSubmission = async (submissionId: string, teamName: string) => {
    if (!eventId) return;
    if (!window.confirm(`Are you sure you want to delete the submission for "${teamName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await submissionService.deleteSubmission(submissionId, eventId);
      await loadPageData();
    } catch (err: any) {
      alert(`Failed to delete submission: ${err?.message || 'Unknown error'}`);
    }
  };

  const [togglingFormation, setTogglingFormation] = useState(false);
  const handleToggleFormation = async () => {
    if (!event) return;
    setTogglingFormation(true);
    try {
      const newStatus = !event.teamFormationLive;
      await eventService.toggleTeamFormation(event.id, newStatus);
      setEvent({ ...event, teamFormationLive: newStatus });
    } catch (err) {
      console.error('Failed to toggle team formation:', err);
    } finally {
      setTogglingFormation(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 24, paddingTop: 'calc(var(--nav-h) + 2rem)' }}>
        <div style={{ padding: 40, borderRadius: 20, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center', maxWidth: 480 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#dc2626', margin: '0 0 12px' }}>403 · RESTRICTED ACCESS</h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#64748b', marginBottom: 24 }}>Only platform administrators (nikhildeosani@gmail.com) can access team submissions and winner declaration console.</p>
          <Link to="/admin" style={{ textDecoration: 'none', padding: '10px 24px', borderRadius: 8, background: '#4f46e5', color: '#fff', fontWeight: 700, fontFamily: 'var(--font-ui)', fontSize: 12 }}>Return to Admin Console</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #4f46e5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', gap: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--color-text-primary)' }}>EVENT NOT FOUND</h1>
        <Link to="/admin" style={{ textDecoration: 'none', padding: '10px 24px', borderRadius: 8, background: '#4f46e5', color: '#fff', fontWeight: 700, fontFamily: 'var(--font-ui)' }}>Back to Admin</Link>
      </div>
    );
  }

  // Set of positions already awarded to other teams
  const takenPositions = new Set(declaredWinners.map((w) => w.position));

  // Filter teams list
  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (teamMembersMap[t.id] || []).some((m) => (m.userName || '').toLowerCase().includes(searchQuery.toLowerCase()));

    const isWinner = declaredWinners.some((w) => w.teamId === t.id);
    const hasSubmission = Boolean(submissionsMap[t.id]);

    if (filterMode === 'submitted' && !hasSubmission) return false;
    if (filterMode === 'winners' && !isWinner) return false;

    return matchesSearch;
  });

  const totalSubmittedCount = Object.keys(submissionsMap).length + unmatchedSubmissions.length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingTop: 'var(--nav-h)' }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .win-btn:disabled { opacity: 0.35; cursor: not-allowed!important; }
        .win-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
      `}</style>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px 80px', animation: 'fadeIn 0.3s ease' }}>
        {/* Top Breadcrumb & Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <Link
            to="/admin"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: '#4f46e5',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← BACK TO ADMIN CONSOLE
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleToggleFormation}
              disabled={togglingFormation}
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.12em',
                padding: '7px 14px',
                borderRadius: 8,
                background: event.teamFormationLive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: event.teamFormationLive ? '1px solid #16a34a' : '1px solid #dc2626',
                color: event.teamFormationLive ? '#15803d' : '#b91c1c',
                cursor: togglingFormation ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-ui)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                opacity: togglingFormation ? 0.6 : 1,
              }}
            >
              {togglingFormation ? 'UPDATING...' : event.teamFormationLive ? '🟢 FORMATION: LIVE' : '🔴 FORMATION: PAUSED'}
            </button>

            <button
              onClick={() => exportTeamsToCSV(event.title, teams, teamMembersMap, submissionsMap, declaredWinners)}
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.12em',
                padding: '7px 14px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid #059669',
                color: '#047857',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📥 EXPORT TEAMS CSV ({teams.length})
            </button>

            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.12em',
                padding: '7px 12px',
                borderRadius: 8,
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                color: '#0891b2',
                fontFamily: 'var(--font-ui)',
              }}
            >
              ADMIN TEAMS &amp; SUBMISSIONS MANAGEMENT
            </span>
          </div>
        </div>

        {/* Header Title Section */}
        <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--color-cream, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', padding: '4px 10px', borderRadius: 6, background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', border: '1px solid rgba(79, 70, 229, 0.2)', fontFamily: 'var(--font-ui)' }}>
              {event.category.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--color-text-secondary, #64748b)', fontWeight: 600 }}>
              📅 {event.date}
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', color: 'var(--color-text-primary, #0f172a)', margin: 0, lineHeight: 1.1, fontWeight: 800 }}>
            {event.title}
          </h1>

          {/* KPI Pills */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--color-white, #ffffff)', border: '1px solid var(--color-cream, #e2e8f0)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--color-text-secondary, #64748b)', fontWeight: 800, display: 'block', marginBottom: 2 }}>TEAMS REGISTERED</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-text-primary, #0f172a)', fontWeight: 800 }}>{teams.length}</span>
            </div>

            <div style={{ padding: '10px 18px', borderRadius: 12, background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.3)', boxShadow: '0 2px 8px rgba(6, 182, 212, 0.05)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.14em', color: '#0891b2', fontWeight: 800, display: 'block', marginBottom: 2 }}>PROJECT SUBMISSIONS</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#0891b2', fontWeight: 800 }}>{totalSubmittedCount}</span>
            </div>

            <div style={{ padding: '10px 18px', borderRadius: 12, background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)', boxShadow: '0 2px 8px rgba(234, 179, 8, 0.05)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.14em', color: '#b45309', fontWeight: 800, display: 'block', marginBottom: 2 }}>WINNERS DECLARED</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#b45309', fontWeight: 800 }}>{declaredWinners.length}</span>
            </div>
          </div>
        </div>

        {/* 🏆 DECLARED WINNERS CARD */}
        {declaredWinners.length > 0 && (
          <div
            style={{
              marginBottom: 32,
              padding: '24px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.7) 0%, rgba(253, 230, 138, 0.5) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>🏆</span>
              <div>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: '#b45309' }}>
                  OFFICIAL EVENT CHAMPIONS
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#78350f', margin: 0, fontWeight: 800 }}>
                  Declared Winners Roster
                </h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {declaredWinners.map((w) => (
                <div
                  key={w.teamId + w.position}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 14,
                    background: '#ffffff',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: w.position === '1st' || w.position === 'Winner' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(100, 116, 139, 0.1)',
                          color: w.position === '1st' || w.position === 'Winner' ? '#b45309' : '#334155',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          fontFamily: 'var(--font-ui)',
                        }}
                      >
                        {w.position === '1st' ? '🥇 1st Place Champion' : w.position === '2nd' ? '🥈 2nd Place Runner Up' : w.position === '3rd' ? '🥉 3rd Place' : '🏆 Winner'}
                      </span>
                      <button
                        onClick={() => handleRemoveWinner(w.teamId)}
                        style={{
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 5,
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-ui)',
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#0f172a', margin: '4px 0 2px', fontWeight: 800 }}>
                      {w.teamName}
                    </h3>
                    {w.members && w.members.length > 0 && (
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                        Teammates: <strong style={{ color: '#0f172a' }}>{w.members.join(', ')}</strong>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search teams or member names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              borderRadius: 10,
              background: 'var(--color-white, #ffffff)',
              border: '1px solid var(--color-cream, #cbd5e1)',
              color: 'var(--color-text-primary, #0f172a)',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
              minWidth: 260,
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            }}
          />

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all', label: `All Teams (${teams.length})` },
              { key: 'submitted', label: `Submitted Only (${totalSubmittedCount})` },
              { key: 'winners', label: `Winners (${declaredWinners.length})` },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterMode(f.key as any)}
                style={{
                  padding: '7px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  background: filterMode === f.key ? 'rgba(79, 70, 229, 0.12)' : 'var(--color-white, #ffffff)',
                  border: filterMode === f.key ? '1px solid #6366f1' : '1px solid var(--color-cream, #e2e8f0)',
                  color: filterMode === f.key ? '#4338ca' : 'var(--color-text-secondary, #64748b)',
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* TEAMS & SUBMISSIONS CARDS LIST */}
        {filteredTeams.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', borderRadius: 16, border: '1px dashed var(--color-cream, #cbd5e1)', color: 'var(--color-text-secondary, #64748b)', fontFamily: 'var(--font-ui)', background: 'var(--color-white, #ffffff)' }}>
            No teams found matching your filter criteria.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {filteredTeams.map((t) => {
              const members = teamMembersMap[t.id] || [];
              const submission = submissionsMap[t.id];
              const isWinner = declaredWinners.some((w) => w.teamId === t.id);
              const currentWinner = declaredWinners.find((w) => w.teamId === t.id);

              return (
                <div
                  key={t.id}
                  style={{
                    borderRadius: 18,
                    overflow: 'hidden',
                    background: 'var(--color-white, #ffffff)',
                    border: isWinner ? '1.5px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--color-cream, #e2e8f0)',
                    boxShadow: isWinner ? '0 8px 30px rgba(245, 158, 11, 0.1)' : '0 4px 16px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Top accent bar */}
                  <div style={{ height: 3, background: isWinner ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #4f46e5, #0891b2)' }} />

                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Header: Team Name & Winner Action Controls */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                          <h2
                            onClick={() => setSelectedTeamForModal(t)}
                            className="hover:text-cyan-600 transition-colors cursor-pointer"
                            style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--color-text-primary, #0f172a)', margin: 0, fontWeight: 700 }}
                            title="Click to view full team & member details"
                          >
                            {t.name}
                          </h2>
                          <button
                            onClick={() => setSelectedTeamForModal(t)}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '3px 9px',
                              borderRadius: 6,
                              background: 'rgba(6, 182, 212, 0.1)',
                              border: '1px solid rgba(6, 182, 212, 0.3)',
                              color: '#0891b2',
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
                              padding: '3px 9px',
                              borderRadius: 6,
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#dc2626',
                              fontFamily: 'var(--font-ui)',
                              cursor: 'pointer',
                            }}
                            title={`Delete team ${t.name}`}
                          >
                            🗑 DELETE TEAM
                          </button>
                          {isWinner && (
                            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#b45309', fontFamily: 'var(--font-ui)' }}>
                              🏆 {currentWinner?.position === '1st' ? '1st Place Champion' : currentWinner?.position === '2nd' ? '2nd Place Runner Up' : currentWinner?.position === '3rd' ? '3rd Place' : 'Winner'}
                            </span>
                          )}
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>
                            👥 {members.length} Members
                          </span>
                        </div>

                        {t.skills && (
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#0891b2', margin: '2px 0 0', fontWeight: 600 }}>
                            Skills: {t.skills}
                          </p>
                        )}
                      </div>

                      {/* 🏆 WINNER DECLARATION BUTTONS */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {isWinner ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309', fontFamily: 'var(--font-ui)' }}>
                              Awarded: {currentWinner?.position} Place
                            </span>
                            <button
                              onClick={() => handleRemoveWinner(t.id)}
                              style={{
                                padding: '6px 14px',
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                color: '#dc2626',
                                fontFamily: 'var(--font-ui)',
                              }}
                            >
                              Remove Winner Status
                            </button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-text-secondary, #64748b)', fontWeight: 800, marginRight: 4 }}>
                              DECLARE:
                            </span>

                            {!takenPositions.has('1st') && (
                              <button
                                className="win-btn"
                                disabled={savingWinner === t.id}
                                onClick={() => handleDeclareWinner(t, '1st')}
                                style={{
                                  padding: '7px 14px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  background: 'rgba(245, 158, 11, 0.12)',
                                  border: '1px solid rgba(245, 158, 11, 0.45)',
                                  color: '#b45309',
                                  fontFamily: 'var(--font-ui)',
                                  transition: 'all 0.15s',
                                }}
                              >
                                🥇 1st Place (Winner)
                              </button>
                            )}

                            {!takenPositions.has('2nd') && (
                              <button
                                className="win-btn"
                                disabled={savingWinner === t.id}
                                onClick={() => handleDeclareWinner(t, '2nd')}
                                style={{
                                  padding: '7px 14px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  background: 'rgba(100, 116, 139, 0.12)',
                                  border: '1px solid rgba(100, 116, 139, 0.35)',
                                  color: '#334155',
                                  fontFamily: 'var(--font-ui)',
                                  transition: 'all 0.15s',
                                }}
                              >
                                🥈 2nd Place
                              </button>
                            )}

                            {!takenPositions.has('3rd') && (
                              <button
                                className="win-btn"
                                disabled={savingWinner === t.id}
                                onClick={() => handleDeclareWinner(t, '3rd')}
                                style={{
                                  padding: '7px 14px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  background: 'rgba(234, 88, 12, 0.12)',
                                  border: '1px solid rgba(234, 88, 12, 0.4)',
                                  color: '#c2410c',
                                  fontFamily: 'var(--font-ui)',
                                  transition: 'all 0.15s',
                                }}
                              >
                                🥉 3rd Place
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Members List */}
                    <div>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-text-secondary, #64748b)', fontWeight: 800, margin: '0 0 8px' }}>
                        TEAM MEMBERS (click to view profile)
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                        {members.map((m) => {
                          const isCap = m.userId === t.createdBy;
                          return (
                            <div
                              key={m.id}
                              onClick={() => setSelectedMemberForModal({ member: m, teamName: t.name, isCaptain: isCap })}
                              className="hover:border-cyan-500 hover:bg-cyan-50/50 transition-all cursor-pointer"
                              style={{
                                padding: '9px 12px',
                                borderRadius: 10,
                                background: 'var(--color-bg, #f8fafc)',
                                border: '1px solid var(--color-cream, #e2e8f0)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                              }}
                              title="Click to view full student profile details"
                            >
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: isCap ? '#059669' : '#4f46e5',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: '#fff',
                                }}
                              >
                                {(m.userName?.charAt(0) || 'U').toUpperCase()}
                              </div>
                              <div style={{ overflow: 'hidden' }}>
                                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {m.userName} {isCap && '👑'}
                                </p>
                                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--color-text-secondary, #64748b)', margin: 0 }}>
                                  {m.userBranch || 'Student'}{m.userDivision ? ` · Div ${m.userDivision}` : ''}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* PROJECT SUBMISSION DETAILS */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: 12,
                        background: submission ? 'rgba(6, 182, 212, 0.04)' : 'var(--color-bg, #f8fafc)',
                        border: submission ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid var(--color-cream, #e2e8f0)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.14em', color: submission ? '#0891b2' : 'var(--color-text-secondary, #64748b)', fontWeight: 800 }}>
                          {submission ? '📦 PROJECT SUBMISSION DELIVERABLE' : '⏳ SUBMISSION STATUS'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {submission?.timestamp && (
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--color-text-secondary, #64748b)', fontWeight: 600 }}>
                              Submitted {new Date(submission.timestamp).toLocaleDateString()}
                            </span>
                          )}
                          {submission && isAdmin && (
                            <button
                              onClick={() => handleDeleteSubmission(submission.id, t.name)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                color: '#dc2626',
                                fontFamily: 'var(--font-ui)',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                              title="Delete project submission"
                            >
                              🗑 DELETE SUBMISSION
                            </button>
                          )}
                        </div>
                      </div>

                      {submission ? (
                        (() => {
                          const meta = getDeliverableMeta(submission);
                          const hasUrl = submission.repoUrl && (submission.repoUrl.startsWith('http') || submission.repoUrl.includes('.'));
                          const isFileUrlSameAsRepo = meta.url === submission.repoUrl;

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {/* If uploaded file is present (PDF, PPT, DOCX, ZIP...) */}
                              {submission.fileName ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    background: 'var(--color-white, #ffffff)',
                                    border: '1px solid var(--color-cream, #cbd5e1)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.icon}</span>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--color-text-primary, #0f172a)', fontWeight: 700, wordBreak: 'break-all' }}>
                                          {submission.fileName}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 10,
                                            fontWeight: 800,
                                            padding: '2px 7px',
                                            borderRadius: 4,
                                            background: meta.badgeBg,
                                            border: `1px solid ${meta.badgeBorder}`,
                                            color: meta.textColor,
                                            fontFamily: 'var(--font-ui)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                          }}
                                        >
                                          {meta.label}
                                        </span>
                                      </div>
                                      {submission.fileSize ? (
                                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--color-text-secondary, #64748b)', margin: '2px 0 0' }}>
                                          {formatBytes(submission.fileSize)}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>

                                  {meta.url ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDeliverable(meta.url, submission.fileName)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '7px 16px',
                                        fontSize: 11,
                                        fontWeight: 800,
                                        borderRadius: 8,
                                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(14, 165, 233, 0.25))',
                                        border: '1px solid #0891b2',
                                        color: '#0891b2',
                                        fontFamily: 'var(--font-ui)',
                                        letterSpacing: '0.05em',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <span>📥</span>
                                      <span>VIEW / DOWNLOAD {meta.ext.toUpperCase()}</span>
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #64748b)', fontFamily: 'var(--font-ui)' }}>
                                      File recorded ({submission.fileName})
                                    </span>
                                  )}
                                </div>
                              ) : null}

                              {/* External Link / Repository URL */}
                              {hasUrl && !isFileUrlSameAsRepo && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    background: 'var(--color-white, #ffffff)',
                                    border: '1px solid var(--color-cream, #cbd5e1)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: 20 }}>🔗</span>
                                    <div style={{ minWidth: 0 }}>
                                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-text-secondary, #64748b)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>
                                        Project URL / Repository / Live Demo
                                      </span>
                                      <a
                                        href={submission.repoUrl.startsWith('http') ? submission.repoUrl : `https://${submission.repoUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          color: '#4f46e5',
                                          fontSize: 13,
                                          fontFamily: 'monospace',
                                          fontWeight: 600,
                                          textDecoration: 'underline',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: 420,
                                          display: 'inline-block',
                                        }}
                                      >
                                        {submission.repoUrl}
                                      </a>
                                    </div>
                                  </div>
                                  <a
                                    href={submission.repoUrl.startsWith('http') ? submission.repoUrl : `https://${submission.repoUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '7px 16px',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      borderRadius: 8,
                                      background: 'rgba(99, 102, 241, 0.12)',
                                      border: '1px solid rgba(99, 102, 241, 0.35)',
                                      color: '#4f46e5',
                                      fontFamily: 'var(--font-ui)',
                                      textDecoration: 'none',
                                      letterSpacing: '0.05em',
                                      whiteSpace: 'nowrap',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span>↗</span>
                                    <span>OPEN LINK</span>
                                  </a>
                                </div>
                              )}

                              {submission.description && (
                                <div style={{ background: 'var(--color-white, #ffffff)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-cream, #e2e8f0)' }}>
                                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--color-text-primary, #1e293b)', margin: 0, lineHeight: 1.5 }}>
                                    <strong>Description / Pitch:</strong> "{submission.description}"
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--color-text-secondary, #64748b)', margin: 0, fontStyle: 'italic' }}>
                          No deliverables or project links submitted by this team yet.
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 📦 UNASSIGNED / DIRECT SUBMISSIONS (If any submission was submitted without an explicit registered team entity) */}
        {unmatchedSubmissions.length > 0 && (
          <div style={{ marginTop: 40, padding: 24, borderRadius: 18, background: 'var(--color-white, #ffffff)', border: '1px solid var(--color-cream, #e2e8f0)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>📁</span>
              <div>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: '#0891b2' }}>
                  DIRECT PROJECT DELIVERABLES
                </span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text-primary, #0f172a)', margin: 0, fontWeight: 700 }}>
                  Additional Submissions ({unmatchedSubmissions.length})
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {unmatchedSubmissions.map((sub) => {
                const meta = getDeliverableMeta(sub);
                const hasUrl = sub.repoUrl && (sub.repoUrl.startsWith('http') || sub.repoUrl.includes('.'));
                const isFileUrlSameAsRepo = meta.url === sub.repoUrl;

                return (
                  <div
                    key={sub.id}
                    style={{
                      padding: '16px 20px',
                      borderRadius: 14,
                      background: 'var(--color-bg, #f8fafc)',
                      border: '1px solid var(--color-cream, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 14,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 20 }}>{meta.icon}</span>
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', wordBreak: 'break-all' }}>
                          {sub.fileName || sub.repoUrl || 'Project Deliverable'}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: meta.badgeBg, border: `1px solid ${meta.badgeBorder}`, color: meta.textColor, fontFamily: 'var(--font-ui)' }}>
                          {meta.label}
                        </span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--color-text-secondary, #64748b)', margin: 0 }}>
                        Team Identifier: <strong style={{ color: '#0f172a' }}>{sub.teamId}</strong> {sub.timestamp ? `· Submitted ${new Date(sub.timestamp).toLocaleDateString()}` : ''}
                      </p>
                      {hasUrl && !isFileUrlSameAsRepo && (
                        <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#4f46e5', margin: '4px 0 0' }}>
                          🔗 {sub.repoUrl}
                        </p>
                      )}
                      {sub.description && (
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--color-text-primary, #1e293b)', margin: '4px 0 0' }}>
                          "{sub.description}"
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {meta.url && (
                        <button
                          type="button"
                          onClick={() => handleOpenDeliverable(meta.url, sub.fileName)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 16px',
                            fontSize: 11,
                            fontWeight: 800,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(14, 165, 233, 0.25))',
                            border: '1px solid #0891b2',
                            color: '#0891b2',
                            fontFamily: 'var(--font-ui)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span>📥</span>
                          <span>DOWNLOAD {meta.ext.toUpperCase()}</span>
                        </button>
                      )}
                      {hasUrl && !isFileUrlSameAsRepo && (
                        <a
                          href={sub.repoUrl.startsWith('http') ? sub.repoUrl : `https://${sub.repoUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '7px 14px',
                            fontSize: 11,
                            fontWeight: 800,
                            borderRadius: 8,
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            color: '#4f46e5',
                            fontFamily: 'var(--font-ui)',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span>↗</span>
                          <span>OPEN URL</span>
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteSubmission(sub.id, sub.teamId)}
                        style={{
                          padding: '7px 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 8,
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#dc2626',
                          fontFamily: 'var(--font-ui)',
                          cursor: 'pointer',
                        }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Team Details Inspect Modal */}
      {selectedTeamForModal && (
        <TeamDetailsModal
          team={selectedTeamForModal}
          members={teamMembersMap[selectedTeamForModal.id] || []}
          submission={submissionsMap[selectedTeamForModal.id]}
          winner={declaredWinners.find(w => w.teamId === selectedTeamForModal.id)}
          event={event}
          onClose={() => setSelectedTeamForModal(null)}
        />
      )}

      {/* Member Profile Modal */}
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
