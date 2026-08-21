import * as XLSX from 'xlsx';
import type { Team, TeamMember, Submission, EventWinner, EventEnrollmentView } from '../mocks/types';
import { teamService } from '../services/teamService';
import { submissionService } from '../services/submissionService';

/** Helper to compute column widths dynamically based on max content length */
const getAutofitCols = (dataRows: Record<string, any>[]) => {
  if (!dataRows.length) return [];
  const keys = Object.keys(dataRows[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    dataRows.forEach((row) => {
      const val = row[key];
      const str = val !== null && val !== undefined ? String(val) : '';
      if (str.length > maxLen) {
        maxLen = str.length;
      }
    });
    // Add extra padding, max width 60 to keep readable
    return { wch: Math.min(Math.max(maxLen + 4, 12), 65) };
  });
};

/** Export Event Teams & Members to a formatted .xlsx Excel file with dynamic column width auto-fit */
export const exportTeamsToCSV = (
  eventTitle: string,
  teams: Team[],
  teamMembersMap: Record<string, TeamMember[]>,
  submissionsMap: Record<string, Submission>,
  declaredWinners: EventWinner[] = []
) => {
  if (teams.length === 0) {
    alert('No teams registered for this event to export.');
    return;
  }

  const winnersMap = new Map<string, string>();
  declaredWinners.forEach((w) => winnersMap.set(w.teamId, w.position));

  // Sort teams by formation date/time (oldest first)
  const sortedTeams = [...teams].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

  const excelRows: Record<string, any>[] = [];

  sortedTeams.forEach((team, teamIndex) => {
    const members = teamMembersMap[team.id] || [];
    const submission = submissionsMap[team.id];
    const winnerStatus = winnersMap.get(team.id) || 'None';

    const teamFormedAt = team.createdAt
      ? new Date(team.createdAt).toLocaleString()
      : 'N/A';
    const subStatus = submission ? 'Submitted' : 'Pending';
    const repoUrl = submission?.fileUrl || (submission?.repoUrl?.startsWith('http') ? submission.repoUrl : 'N/A');
    const fileName = submission?.fileName || 'N/A';
    const description = submission?.description || 'N/A';
    const submittedAt = submission?.timestamp
      ? new Date(submission.timestamp).toLocaleString()
      : 'N/A';

    // Sort members: captain first, then by join time
    const sortedMembers = [...members].sort((a, b) => {
      const aCaptain = a.userId === team.createdBy ? -1 : 0;
      const bCaptain = b.userId === team.createdBy ? -1 : 0;
      if (aCaptain !== bCaptain) return aCaptain - bCaptain;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });

    if (sortedMembers.length === 0) {
      excelRows.push({
        'Sr. No.': teamIndex + 1,
        'Team Name': team.name,
        'Team Formed On': teamFormedAt,
        'Member Role': 'No Members',
        'Student Name': 'N/A',
        'PRN / Student ID': 'N/A',
        'Phone Number': 'N/A',
        'Email': 'N/A',
        'Branch / Department': 'N/A',
        'Class Year': 'N/A',
        'Division': 'N/A',
        'Member Joined At': 'N/A',
        'Submission Status': subStatus,
        'Repo / File Link': repoUrl,
        'File Name': fileName,
        'Project Description': description,
        'Submitted At': submittedAt,
        'Winner / Award': winnerStatus,
        'Event Title': eventTitle,
      });
    } else {
      sortedMembers.forEach((m) => {
        const isCaptain = m.userId === team.createdBy;
        excelRows.push({
          'Sr. No.': teamIndex + 1,
          'Team Name': team.name,
          'Team Formed On': teamFormedAt,
          'Member Role': isCaptain ? 'Team Captain 👑' : 'Team Member',
          'Student Name': m.userName || 'N/A',
          'PRN / Student ID': m.userPnr || 'N/A',
          'Phone Number': m.userPhoneNumber || 'N/A',
          'Email': m.userEmail || 'N/A',
          'Branch / Department': m.userBranch || 'N/A',
          'Class Year': m.userYear || 'N/A',
          'Division': m.userDivision || 'N/A',
          'Member Joined At': m.joinedAt ? new Date(m.joinedAt).toLocaleString() : 'N/A',
          'Submission Status': subStatus,
          'Repo / File Link': repoUrl,
          'File Name': fileName,
          'Project Description': description,
          'Submitted At': submittedAt,
          'Winner / Award': winnerStatus,
          'Event Title': eventTitle,
        });
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  worksheet['!cols'] = getAutofitCols(excelRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Teams');

  const safeFileName = eventTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  XLSX.writeFile(workbook, `${safeFileName}_teams_${Date.now()}.xlsx`);
};

export const fetchAndExportEventTeamsCSV = async (eventId: string, eventTitle: string, winners: EventWinner[] = []) => {
  try {
    const [eventTeams, submissions] = await Promise.all([
      teamService.getTeamsForEvent(eventId),
      submissionService.getSubmissions(eventId),
    ]);

    const membersMap: Record<string, TeamMember[]> = {};
    await Promise.all(
      eventTeams.map(async (t) => {
        membersMap[t.id] = await teamService.getTeamMembers(t.id);
      })
    );

    const subMap: Record<string, Submission> = {};
    submissions.forEach((s) => {
      if (s.teamId) subMap[s.teamId.toLowerCase()] = s;
    });

    const resolvedSubMap: Record<string, Submission> = {};
    eventTeams.forEach((t) => {
      const keys = [t.id, t.name, t.createdBy].map((k) => (k || '').toLowerCase());
      for (const key of keys) {
        if (subMap[key]) {
          resolvedSubMap[t.id] = subMap[key];
          break;
        }
      }
    });

    exportTeamsToCSV(eventTitle, eventTeams, membersMap, resolvedSubMap, winners);
  } catch (err: any) {
    alert(`Failed to export teams data: ${err?.message || 'Unknown error'}`);
  }
};

function sanitizeSheetName(name: string, usedNames: Set<string>): string {
  let clean = name.replace(/[\\/?*:[\]]/g, '_').trim();
  if (!clean) clean = 'Sheet';
  if (clean.length > 28) clean = clean.substring(0, 28);

  let finalName = clean;
  let counter = 1;
  while (usedNames.has(finalName.toLowerCase())) {
    finalName = `${clean.substring(0, 24)} (${counter})`;
    counter++;
  }
  usedNames.add(finalName.toLowerCase());
  return finalName;
}

function isNoTeam(team?: string): boolean {
  if (!team) return true;
  const t = team.trim().toLowerCase();
  return (
    t === '' ||
    t === 'no team' ||
    t === 'n/a' ||
    t === 'none' ||
    t === 'unassigned' ||
    t === 'individual' ||
    t === 'individual participant' ||
    t === '-'
  );
}

/** Export Enrollments List to dynamic auto-expanding Excel (.xlsx) partitioned by teams */
export const exportEnrollmentsToExcel = (enrollments: EventEnrollmentView[]) => {
  if (!enrollments || enrollments.length === 0) {
    alert('No enrollment records to export.');
    return;
  }

  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  // 1. Partition by Team vs Individual (No Team)
  const teamMap = new Map<string, EventEnrollmentView[]>();
  const noTeamEntries: EventEnrollmentView[] = [];

  enrollments.forEach((e) => {
    if (isNoTeam(e.teamName)) {
      noTeamEntries.push(e);
    } else {
      const teamName = e.teamName!.trim();
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, []);
      }
      teamMap.get(teamName)!.push(e);
    }
  });

  const sortedTeamNames = Array.from(teamMap.keys()).sort((a, b) => a.localeCompare(b));

  // 2. MASTER SHEET: All Enrollments grouped by Team
  const allRows: any[] = [];
  sortedTeamNames.forEach((teamName) => {
    const members = teamMap.get(teamName)!;
    members.sort((a, b) => a.studentName.localeCompare(b.studentName));
    members.forEach((e) => {
      allRows.push({
        'Sr. No.': allRows.length + 1,
        'Team Name': teamName,
        'Student Name': e.studentName,
        'PRN / Student ID': e.pnr || 'N/A',
        'Phone Number': e.phoneNumber || 'N/A',
        'Email Address': e.studentEmail,
        'Branch': e.branch || 'N/A',
        'Class Year': e.classYear || 'N/A',
        'Division': e.division || 'N/A',
        'Ticket Status': e.status,
        'Event Title': e.eventTitle,
        'Enrolled At': new Date(e.enrolledAt).toLocaleString(),
        'Pass ID': e.id,
      });
    });
  });

  noTeamEntries.sort((a, b) => a.studentName.localeCompare(b.studentName));
  noTeamEntries.forEach((e) => {
    allRows.push({
      'Sr. No.': allRows.length + 1,
      'Team Name': 'Individual (No Team)',
      'Student Name': e.studentName,
      'PRN / Student ID': e.pnr || 'N/A',
      'Phone Number': e.phoneNumber || 'N/A',
      'Email Address': e.studentEmail,
      'Branch': e.branch || 'N/A',
      'Class Year': e.classYear || 'N/A',
      'Division': e.division || 'N/A',
      'Ticket Status': e.status,
      'Event Title': e.eventTitle,
      'Enrolled At': new Date(e.enrolledAt).toLocaleString(),
      'Pass ID': e.id,
    });
  });

  const masterSheet = XLSX.utils.json_to_sheet(allRows);
  masterSheet['!cols'] = getAutofitCols(allRows);
  const masterName = sanitizeSheetName('All Enrollments (Master)', usedSheetNames);
  XLSX.utils.book_append_sheet(workbook, masterSheet, masterName);

  // 3. SUMMARY SHEET: Teams Headcount
  const summaryRows = [
    ...sortedTeamNames.map((teamName, idx) => {
      const members = teamMap.get(teamName)!;
      return {
        '#': idx + 1,
        'Team Name': teamName,
        'Category': 'Team',
        'Members Count': members.length,
        'Member Names': members.map((m) => m.studentName).join(', '),
      };
    }),
    ...(noTeamEntries.length > 0
      ? [{
          '#': sortedTeamNames.length + 1,
          'Team Name': 'Individual (No Team)',
          'Category': 'Solo / No Team',
          'Members Count': noTeamEntries.length,
          'Member Names': noTeamEntries.map((m) => m.studentName).join(', '),
        }]
      : []),
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = getAutofitCols(summaryRows);
  const summaryName = sanitizeSheetName('Teams Summary', usedSheetNames);
  XLSX.utils.book_append_sheet(workbook, summarySheet, summaryName);

  // 4. INDIVIDUAL TEAM SHEETS
  sortedTeamNames.forEach((teamName) => {
    const members = teamMap.get(teamName)!;
    const teamRows = members.map((e, i) => ({
      'Sr. No.': i + 1,
      'Student Name': e.studentName,
      'PRN / Student ID': e.pnr || 'N/A',
      'Phone Number': e.phoneNumber || 'N/A',
      'Email Address': e.studentEmail,
      'Branch': e.branch || 'N/A',
      'Class Year': e.classYear || 'N/A',
      'Division': e.division || 'N/A',
      'Status': e.status,
      'Enrolled At': new Date(e.enrolledAt).toLocaleString(),
      'Pass ID': e.id,
    }));

    const teamSheet = XLSX.utils.json_to_sheet(teamRows);
    teamSheet['!cols'] = getAutofitCols(teamRows);
    const sheetTitle = sanitizeSheetName(`Team - ${teamName}`, usedSheetNames);
    XLSX.utils.book_append_sheet(workbook, teamSheet, sheetTitle);
  });

  // 5. NO TEAM SHEET
  if (noTeamEntries.length > 0) {
    const noTeamRows = noTeamEntries.map((e, i) => ({
      'Sr. No.': i + 1,
      'Student Name': e.studentName,
      'PRN / Student ID': e.pnr || 'N/A',
      'Phone Number': e.phoneNumber || 'N/A',
      'Email Address': e.studentEmail,
      'Branch': e.branch || 'N/A',
      'Class Year': e.classYear || 'N/A',
      'Division': e.division || 'N/A',
      'Status': e.status,
      'Enrolled At': new Date(e.enrolledAt).toLocaleString(),
      'Pass ID': e.id,
    }));

    const noTeamSheet = XLSX.utils.json_to_sheet(noTeamRows);
    noTeamSheet['!cols'] = getAutofitCols(noTeamRows);
    const noTeamName = sanitizeSheetName('Individual (No Team)', usedSheetNames);
    XLSX.utils.book_append_sheet(workbook, noTeamSheet, noTeamName);
  }

  XLSX.writeFile(workbook, `enrollments_by_teams_${Date.now()}.xlsx`);
};

