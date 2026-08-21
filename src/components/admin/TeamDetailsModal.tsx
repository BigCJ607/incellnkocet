import React, { useState } from 'react';
import type { Team, TeamMember, Submission, EventWinner, EventData } from '../../mocks/types';
import MemberProfileModal from './MemberProfileModal';

interface TeamDetailsModalProps {
  team: Team;
  members: TeamMember[];
  submission?: Submission;
  winner?: EventWinner;
  event?: EventData | null;
  onClose: () => void;
  onDeleteSubmission?: (submissionId: string, teamName: string) => void;
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
  } else if (ext === 'ppt' || ext === 'pptx') {
    icon = '📊';
    badgeBg = 'rgba(249, 115, 22, 0.15)';
    badgeBorder = 'rgba(249, 115, 22, 0.35)';
    textColor = '#fb923c';
    label = 'PowerPoint Presentation';
  } else if (ext === 'doc' || ext === 'docx') {
    icon = '📝';
    badgeBg = 'rgba(59, 130, 246, 0.15)';
    badgeBorder = 'rgba(59, 130, 246, 0.35)';
    textColor = '#60a5fa';
    label = 'Word Document';
  } else if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar' || ext === 'gz') {
    icon = '📦';
    badgeBg = 'rgba(168, 85, 247, 0.15)';
    badgeBorder = 'rgba(168, 85, 247, 0.35)';
    textColor = '#c084fc';
    label = 'ZIP / Archive';
  } else if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
    icon = '🖼️';
    badgeBg = 'rgba(34, 211, 238, 0.15)';
    badgeBorder = 'rgba(34, 211, 238, 0.35)';
    textColor = '#22d3ee';
    label = 'Image';
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

export default function TeamDetailsModal({
  team,
  members,
  submission,
  winner,
  event,
  onClose,
  onDeleteSubmission,
}: TeamDetailsModalProps) {
  const [selectedMemberForModal, setSelectedMemberForModal] = useState<{ member: TeamMember; isCaptain?: boolean } | null>(null);
  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleExportTeamCSV = () => {
    const headers = [
      'Event Title',
      'Team Name',
      'Team ID',
      'Member Role',
      'Student Name',
      'Student Email',
      'PRN / Student ID',
      'Branch / Department',
      'Class Year',
      'Division',
      'Deliverable Status',
      'Repo URL / Link',
      'File Deliverable Name',
      'Project Pitch / Description',
      'Submitted Date',
      'Winner / Award',
    ];

    const escapeCSV = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows: string[][] = [];
    const eventTitle = event?.title || 'Event Roster';
    const winnerStatus = winner?.position || 'None';
    const subStatus = submission ? 'Submitted' : 'Pending';
    const repoUrl = submission?.repoUrl || 'N/A';
    const fileName = submission?.fileName || 'N/A';
    const description = submission?.description || 'N/A';
    const submittedAt = submission?.timestamp ? new Date(submission.timestamp).toLocaleString() : 'N/A';

    if (members.length === 0) {
      rows.push([
        escapeCSV(eventTitle),
        escapeCSV(team.name),
        escapeCSV(team.id),
        escapeCSV('Unassigned'),
        escapeCSV('No Members'),
        escapeCSV('N/A'),
        escapeCSV('N/A'),
        escapeCSV('N/A'),
        escapeCSV('N/A'),
        escapeCSV('N/A'),
        escapeCSV(subStatus),
        escapeCSV(repoUrl),
        escapeCSV(fileName),
        escapeCSV(description),
        escapeCSV(submittedAt),
        escapeCSV(winnerStatus),
      ]);
    } else {
      members.forEach((m) => {
        const isCap = m.userId === team.createdBy;
        rows.push([
          escapeCSV(eventTitle),
          escapeCSV(team.name),
          escapeCSV(team.id),
          escapeCSV(isCap ? 'Team Captain 👑' : 'Team Member'),
          escapeCSV(m.userName || 'Student'),
          escapeCSV(m.userEmail || 'N/A'),
          escapeCSV(m.userPnr || 'N/A'),
          escapeCSV(m.userBranch || 'N/A'),
          escapeCSV(m.userYear || 'N/A'),
          escapeCSV(m.userDivision || 'N/A'),
          escapeCSV(subStatus),
          escapeCSV(repoUrl),
          escapeCSV(fileName),
          escapeCSV(description),
          escapeCSV(submittedAt),
          escapeCSV(winnerStatus),
        ]);
      });
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.map(escapeCSV).join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${team.name.replace(/[^a-zA-Z0-9]/g, '_')}_details_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
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
          maxWidth: 820,
          maxHeight: '90vh',
          borderRadius: 24,
          overflow: 'hidden',
          background: '#0c0c18',
          border: '1px solid rgba(34, 211, 238, 0.4)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.9), 0 0 60px rgba(34, 211, 238, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  color: '#22d3ee',
                }}
              >
                TEAM DETAILS ROSTER
              </span>
              {event && (
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  · {event.title}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 30,
                  color: '#ffffff',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {team.name}
              </h2>

              {winner && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 6,
                    background: 'rgba(234,179,8,0.2)',
                    border: '1px solid rgba(234,179,8,0.4)',
                    color: '#fde047',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  🏆 {winner.position} Place
                </span>
              )}

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: submission ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.05)',
                  border: submission ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  color: submission ? '#22d3ee' : '#9ca3af',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {submission ? '📦 Submitted' : '⏳ Pending Submission'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleExportTeamCSV}
              style={{
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 8,
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
              📥 Export Team CSV
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
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* Team Metadata Section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                TEAM ID
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#818cf8', fontWeight: 600 }}>
                {team.id}
              </span>
            </div>

            <div
              style={{
                padding: '14px 18px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                ROSTER SIZE
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: '#ffffff', fontWeight: 700 }}>
                👥 {members.length} Registered Members
              </span>
            </div>

            {team.skills && (
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 12,
                  background: 'rgba(34,211,238,0.03)',
                  border: '1px solid rgba(34,211,238,0.2)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: '#22d3ee', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  TECH STACK & SKILLS
                </span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#ffffff', fontWeight: 600 }}>
                  {team.skills}
                </span>
              </div>
            )}
          </div>

          {/* Members Roster Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#ffffff', margin: 0 }}>
                Team Members Roster ({members.length})
              </h3>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                👑 Indicates Team Captain
              </span>
            </div>

            {members.length === 0 ? (
              <div style={{ padding: '24px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
                No members found for this team.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                {members.map((m) => {
                  const isCap = m.userId === team.createdBy;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMemberForModal({ member: m, isCaptain: isCap })}
                      style={{
                        padding: '16px 18px',
                        borderRadius: 14,
                        background: isCap ? 'rgba(5, 150, 105, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                        border: isCap ? '1px solid rgba(5, 150, 105, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        gap: 14,
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                      }}
                      title="Click to view full student profile details"
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: isCap ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        {(m.userName?.charAt(0) || 'U').toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <h4 style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.userName || 'Student Participant'}
                          </h4>
                          {isCap && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(5, 150, 105, 0.25)', color: '#6ee7b7', fontFamily: 'var(--font-ui)' }}>
                              👑 CAPTAIN
                            </span>
                          )}
                        </div>

                        {m.userEmail && (
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 6px', wordBreak: 'break-all' }}>
                            {m.userEmail}
                          </p>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {m.userPnr && (
                            <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)' }}>
                              PRN: {m.userPnr}
                            </span>
                          )}
                          {m.userBranch && (
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#d1d5db' }}>
                              {m.userBranch}
                            </span>
                          )}
                          {m.userYear && (
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
                              {m.userYear} {m.userDivision ? `· Div ${m.userDivision}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Project Deliverable / Submission Details */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: 16,
              background: submission ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.015)',
              border: submission ? '1px solid rgba(34,211,238,0.25)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: '0.14em', color: submission ? '#22d3ee' : 'rgba(255,255,255,0.3)', fontWeight: 800 }}>
                {submission ? '📦 PROJECT SUBMISSION DELIVERABLE' : '⏳ SUBMISSION STATUS'}
              </span>

              {submission && onDeleteSubmission && (
                <button
                  onClick={() => onDeleteSubmission(submission.id, team.name)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  🗑 DELETE SUBMISSION
                </button>
              )}
            </div>

            {submission ? (
              (() => {
                const getDeliverableMeta = (sub: any) => {
                  const fileName = sub.fileName || '';
                  const ext = fileName.split('.').pop()?.toLowerCase() || '';
                  const url = sub.fileUrl || sub.fileData || (sub.repoUrl?.startsWith('http') || sub.repoUrl?.startsWith('data:') ? sub.repoUrl : '');

                  let icon = '📄';
                  let badgeBg = 'rgba(148, 163, 184, 0.15)';
                  let badgeBorder = 'rgba(148, 163, 184, 0.3)';
                  let textColor = '#cbd5e1';
                  let label = 'Document';

                  if (ext === 'pdf') { icon = '📕'; badgeBg = 'rgba(239, 68, 68, 0.15)'; badgeBorder = 'rgba(239, 68, 68, 0.35)'; textColor = '#f87171'; label = 'PDF Document'; }
                  else if (['ppt', 'pptx', 'pot', 'potx', 'odp', 'key'].includes(ext)) { icon = '📊'; badgeBg = 'rgba(249, 115, 22, 0.15)'; badgeBorder = 'rgba(249, 115, 22, 0.35)'; textColor = '#fb923c'; label = 'Presentation'; }
                  else if (['doc', 'docx', 'rtf', 'odt', 'txt', 'pages'].includes(ext)) { icon = '📝'; badgeBg = 'rgba(59, 130, 246, 0.15)'; badgeBorder = 'rgba(59, 130, 246, 0.35)'; textColor = '#60a5fa'; label = 'Word Document'; }
                  else if (['xls', 'xlsx', 'csv', 'ods', 'tsv', 'numbers'].includes(ext)) { icon = '📈'; badgeBg = 'rgba(16, 185, 129, 0.15)'; badgeBorder = 'rgba(16, 185, 129, 0.35)'; textColor = '#34d399'; label = 'Spreadsheet'; }
                  else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz'].includes(ext)) { icon = '📦'; badgeBg = 'rgba(168, 85, 247, 0.15)'; badgeBorder = 'rgba(168, 85, 247, 0.35)'; textColor = '#c084fc'; label = 'Archive'; }
                  else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico'].includes(ext)) { icon = '🖼️'; badgeBg = 'rgba(34, 211, 238, 0.15)'; badgeBorder = 'rgba(34, 211, 238, 0.35)'; textColor = '#22d3ee'; label = 'Image'; }
                  else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) { icon = '🎥'; badgeBg = 'rgba(244, 63, 94, 0.15)'; badgeBorder = 'rgba(244, 63, 94, 0.35)'; textColor = '#fb7185'; label = 'Video'; }
                  else if (['fig', 'sketch', 'xd', 'psd', 'ai'].includes(ext)) { icon = '🎨'; badgeBg = 'rgba(236, 72, 153, 0.15)'; badgeBorder = 'rgba(236, 72, 153, 0.35)'; textColor = '#f472b6'; label = 'Design'; }

                  return { fileName, ext, url, icon, badgeBg, badgeBorder, textColor, label };
                };

                const meta = getDeliverableMeta(submission);
                const hasUrl = submission.repoUrl && (submission.repoUrl.startsWith('http') || submission.repoUrl.includes('.'));
                const isFileUrlSameAsRepo = meta.url === submission.repoUrl;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {submission.fileName && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: 24 }}>{meta.icon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: '#ffffff', fontWeight: 700 }}>{submission.fileName}</span>
                              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: meta.badgeBg, border: `1px solid ${meta.badgeBorder}`, color: meta.textColor }}>{meta.label}</span>
                            </div>
                            {submission.fileSize && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>{formatBytes(submission.fileSize)}</p>}
                          </div>
                        </div>
                        {meta.url && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeliverable(meta.url, submission.fileName)}
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '8px 18px',
                              borderRadius: 8,
                              background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(6,182,212,0.3))',
                              color: '#22d3ee',
                              border: '1px solid rgba(34,211,238,0.4)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            📥 DOWNLOAD
                          </button>
                        )}
                      </div>
                    )}
                    {hasUrl && !isFileUrlSameAsRepo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        <span style={{ fontSize: 20 }}>🔗</span>
                        <a href={submission.repoUrl.startsWith('http') ? submission.repoUrl : `https://${submission.repoUrl}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all' }}>
                          {submission.repoUrl}
                        </a>
                      </div>
                    )}
                    {submission.description && (
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>{submission.description}</p>
                    )}
                  </div>
                );
              })()
            ) : (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>No deliverables submitted yet.</p>
            )}
          </div>
        </div>
      </div>

      {selectedMemberForModal && (
        <MemberProfileModal
          member={selectedMemberForModal.member}
          teamName={team.name}
          isCaptain={selectedMemberForModal.isCaptain}
          onClose={() => setSelectedMemberForModal(null)}
        />
      )}
    </div>
  );
}
