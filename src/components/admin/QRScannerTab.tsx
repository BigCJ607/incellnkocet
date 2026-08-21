import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import { qrScanService } from '../../services/qrScanService'
import type { ScannedTicket } from '../../services/qrScanService'
import { isSupabaseConfigured } from '../../lib/supabase'
import { eventService } from '../../services/eventService'
import type { EventData } from '../../mocks/types'
import { useApp } from '../../context/AppContext'

// ── Excel Export (Team-Partitioned Workbook) ──────────────────────────────────

function getAutofitCols(rows: any[]) {
  if (!rows || rows.length === 0) return []
  const keys = Object.keys(rows[0])
  return keys.map((key) => {
    let maxLen = key.length
    rows.forEach((row) => {
      const val = row[key]
      const str = val !== null && val !== undefined ? String(val) : ''
      if (str.length > maxLen) maxLen = str.length
    })
    return { wch: Math.min(Math.max(maxLen + 3, 12), 60) }
  })
}

function sanitizeSheetName(name: string, usedNames: Set<string>): string {
  let clean = name.replace(/[\\/?*:[\]]/g, '_').trim()
  if (!clean) clean = 'Sheet'
  if (clean.length > 28) clean = clean.substring(0, 28)

  let finalName = clean
  let counter = 1
  while (usedNames.has(finalName.toLowerCase())) {
    finalName = `${clean.substring(0, 24)} (${counter})`
    counter++
  }
  usedNames.add(finalName.toLowerCase())
  return finalName
}

function isNoTeam(team?: string): boolean {
  if (!team) return true
  const t = team.trim().toLowerCase()
  return (
    t === '' ||
    t === 'no team' ||
    t === 'n/a' ||
    t === 'none' ||
    t === 'unassigned' ||
    t === 'individual' ||
    t === 'individual participant' ||
    t === '-'
  )
}

function exportScannedToExcel(entries: ScannedTicket[], eventTitle: string) {
  if (entries.length === 0) {
    alert('No scanned entries to export.')
    return
  }

  const workbook = XLSX.utils.book_new()
  const usedSheetNames = new Set<string>()

  // 1. Partition attendees by Team vs Individual (No Team)
  const teamMap = new Map<string, ScannedTicket[]>()
  const noTeamEntries: ScannedTicket[] = []

  entries.forEach((entry) => {
    if (isNoTeam(entry.team)) {
      noTeamEntries.push(entry)
    } else {
      const teamName = entry.team.trim()
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, [])
      }
      teamMap.get(teamName)!.push(entry)
    }
  })

  // Sorted team names alphabetically
  const sortedTeamNames = Array.from(teamMap.keys()).sort((a, b) => a.localeCompare(b))

  // 2. MASTER SHEET: All Scanned Attendees sorted by Team then Student Name
  const allRows: any[] = []
  
  sortedTeamNames.forEach((teamName) => {
    const members = teamMap.get(teamName)!
    members.sort((a, b) => a.name.localeCompare(b.name))
    members.forEach((m) => {
      allRows.push({
        'Sr. No.': allRows.length + 1,
        'Team Name': teamName,
        'Student Name': m.name,
        'PRN / Student ID': m.pnr || 'N/A',
        'Email Address': m.email || 'N/A',
        'Branch': m.branch || 'N/A',
        'Class Year': m.classYear || 'N/A',
        'Division': m.division || 'N/A',
        'Ticket Status': m.status || 'Confirmed',
        'Event Title': m.event,
        'Event Date': m.date,
        'Scanned At': new Date(m.scannedAt).toLocaleString('en-IN'),
        'Pass ID': m.passId,
      })
    })
  })

  noTeamEntries.sort((a, b) => a.name.localeCompare(b.name))
  noTeamEntries.forEach((m) => {
    allRows.push({
      'Sr. No.': allRows.length + 1,
      'Team Name': 'Individual (No Team)',
      'Student Name': m.name,
      'PRN / Student ID': m.pnr || 'N/A',
      'Email Address': m.email || 'N/A',
      'Branch': m.branch || 'N/A',
      'Class Year': m.classYear || 'N/A',
      'Division': m.division || 'N/A',
      'Ticket Status': m.status || 'Confirmed',
      'Event Title': m.event,
      'Event Date': m.date,
      'Scanned At': new Date(m.scannedAt).toLocaleString('en-IN'),
      'Pass ID': m.passId,
    })
  })

  const masterSheet = XLSX.utils.json_to_sheet(allRows)
  masterSheet['!cols'] = getAutofitCols(allRows)
  const masterName = sanitizeSheetName('All Attendees (Master)', usedSheetNames)
  XLSX.utils.book_append_sheet(workbook, masterSheet, masterName)

  // 3. SUMMARY SHEET: Teams Overview
  const summaryRows = [
    ...sortedTeamNames.map((teamName, idx) => {
      const members = teamMap.get(teamName)!
      return {
        '#': idx + 1,
        'Team Name': teamName,
        'Type': 'Team',
        'Members Scanned': members.length,
        'Member Names': members.map((m) => m.name).join(', '),
      }
    }),
    ...(noTeamEntries.length > 0
      ? [{
          '#': sortedTeamNames.length + 1,
          'Team Name': 'Individual (No Team)',
          'Type': 'Solo / No Team',
          'Members Scanned': noTeamEntries.length,
          'Member Names': noTeamEntries.map((m) => m.name).join(', '),
        }]
      : []),
  ]

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows)
  summarySheet['!cols'] = getAutofitCols(summaryRows)
  const summaryName = sanitizeSheetName('Teams Summary', usedSheetNames)
  XLSX.utils.book_append_sheet(workbook, summarySheet, summaryName)

  // 4. INDIVIDUAL TEAM SHEETS: One dedicated sheet per team
  sortedTeamNames.forEach((teamName) => {
    const members = teamMap.get(teamName)!
    const teamRows = members.map((m, i) => ({
      'Sr. No.': i + 1,
      'Student Name': m.name,
      'PRN / Student ID': m.pnr || 'N/A',
      'Email Address': m.email || 'N/A',
      'Branch': m.branch || 'N/A',
      'Class Year': m.classYear || 'N/A',
      'Division': m.division || 'N/A',
      'Ticket Status': m.status || 'Confirmed',
      'Scanned At': new Date(m.scannedAt).toLocaleString('en-IN'),
      'Pass ID': m.passId,
    }))

    const teamSheet = XLSX.utils.json_to_sheet(teamRows)
    teamSheet['!cols'] = getAutofitCols(teamRows)
    const sheetTitle = sanitizeSheetName(`Team - ${teamName}`, usedSheetNames)
    XLSX.utils.book_append_sheet(workbook, teamSheet, sheetTitle)
  })

  // 5. NO TEAM / INDIVIDUAL PARTICIPANTS SHEET
  if (noTeamEntries.length > 0) {
    const noTeamRows = noTeamEntries.map((m, i) => ({
      'Sr. No.': i + 1,
      'Student Name': m.name,
      'PRN / Student ID': m.pnr || 'N/A',
      'Email Address': m.email || 'N/A',
      'Branch': m.branch || 'N/A',
      'Class Year': m.classYear || 'N/A',
      'Division': m.division || 'N/A',
      'Ticket Status': m.status || 'Confirmed',
      'Scanned At': new Date(m.scannedAt).toLocaleString('en-IN'),
      'Pass ID': m.passId,
    }))

    const noTeamSheet = XLSX.utils.json_to_sheet(noTeamRows)
    noTeamSheet['!cols'] = getAutofitCols(noTeamRows)
    const noTeamName = sanitizeSheetName('Individual (No Team)', usedSheetNames)
    XLSX.utils.book_append_sheet(workbook, noTeamSheet, noTeamName)
  }

  const safe = eventTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${safe}_attendance_by_teams_${timestamp}.xlsx`)
}

// ── Duplicate Alert Toast (fixed red popup) ─────────────────────────────────

function DuplicateAlertToast({
  name,
  passId,
  event,
  onClose,
}: {
  name: string
  passId: string
  event: string
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--nav-h, 64px) + 20px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        minWidth: 340,
        maxWidth: 520,
        padding: '18px 24px',
        borderRadius: 14,
        background: 'rgba(10,0,0,0.97)',
        border: '1.5px solid #ef4444',
        boxShadow: '0 0 0 4px rgba(239,68,68,0.18), 0 20px 60px rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        animation: 'dupeSlideIn 0.35s cubic-bezier(0.22,1,0.36,1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Pulsing red icon */}
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(239,68,68,0.15)',
        border: '1.5px solid rgba(239,68,68,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.2em', fontWeight: 700, color: '#ef4444', margin: '0 0 4px' }}>
          DUPLICATE ENTRY DETECTED
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 2px' }}>
          {event}
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(239,68,68,0.6)', margin: 0, letterSpacing: '0.05em' }}>
          Pass ID {passId.slice(0, 12)}... has already been scanned.
        </p>
        {/* Auto-dismiss progress bar */}
        <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'rgba(239,68,68,0.15)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: '#ef4444', borderRadius: 2,
            animation: 'dupeShrink 5s linear forwards',
          }} />
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>
    </div>
  )
}

// ── Scan Result Card ──────────────────────────────────────────────────────────

function ScanResultCard({
  ticket,
  onDismiss,
}: {
  ticket: ScannedTicket
  onDismiss: () => void
}) {
  const fields: { label: string; value: string; color?: string }[] = [
    { label: 'EVENT', value: ticket.event, color: '#22d3ee' },
    { label: 'DATE', value: ticket.date },
    { label: 'LOCATION', value: ticket.location },
    { label: 'STATUS', value: ticket.status, color: ticket.status === 'Confirmed' ? '#4ade80' : '#fbbf24' },
    { label: 'NAME', value: ticket.name },
    { label: 'EMAIL', value: ticket.email },
    { label: 'PRN', value: ticket.pnr },
    { label: 'BRANCH', value: ticket.branch },
    { label: 'CLASS YEAR', value: ticket.classYear },
    { label: 'DIVISION', value: ticket.division },
    { label: 'TEAM', value: ticket.team },
  ]

  return (
    <div style={{
      background: 'rgba(34,211,238,0.06)',
      border: '1px solid rgba(34,211,238,0.45)',
      borderRadius: 16,
      padding: '24px 28px',
      animation: 'fadeInUp 0.35s cubic-bezier(0.22,1,0.36,1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(34,211,238,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            ✅
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.2em', fontWeight: 700, margin: 0, color: '#22d3ee' }}>
              SCAN VERIFIED &amp; RECORDED
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              Pass ID: {ticket.passId.slice(0, 8)}...
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px 24px' }}>
        {fields.map(({ label, value, color }) => (
          <div key={label}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', fontWeight: 700, margin: '0 0 2px' }}>
              {label}
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: color || 'rgba(255,255,255,0.88)', fontWeight: 600, margin: 0, wordBreak: 'break-word' }}>
              {value || '-'}
            </p>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '14px 0 0', letterSpacing: '0.1em' }}>
        SCANNED AT {new Date(ticket.scannedAt).toLocaleString('en-IN')}
      </p>
    </div>
  )
}

// ── Scan Log Table ────────────────────────────────────────────────────────────

function ScanLogTable({
  entries,
  eventTitle,
  onExport,
  onClear,
  onDeleteSingle,
  isShared,
}: {
  entries: ScannedTicket[]
  eventTitle: string
  onExport: () => void
  onClear: () => void
  onDeleteSingle: (entry: ScannedTicket) => void
  isShared: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')

  if (entries.length === 0) return null

  const filteredEntries = entries.filter((e) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      e.name.toLowerCase().includes(q) ||
      (e.pnr && e.pnr.toLowerCase().includes(q)) ||
      (e.email && e.email.toLowerCase().includes(q)) ||
      (e.team && e.team.toLowerCase().includes(q)) ||
      (e.passId && e.passId.toLowerCase().includes(q)) ||
      (e.branch && e.branch.toLowerCase().includes(q))
    )
  })

  return (
    <div style={{ marginTop: 32 }}>
      {/* Table Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.2em', color: '#818cf8', fontWeight: 700, margin: 0 }}>
              SESSION SCAN LOG
            </p>
            {isShared && (
              <span style={{
                padding: '2px 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                fontFamily: 'var(--font-ui)', borderRadius: 5,
                background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399',
              }}>
                🔴 LIVE — SHARED ACROSS DEVICES
              </span>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
            {entries.length} {entries.length === 1 ? 'ticket' : 'tickets'} scanned
            {eventTitle ? ` · ${eventTitle}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onExport}
            style={{
              padding: '9px 18px', fontFamily: 'var(--font-ui)', fontWeight: 700,
              fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
              color: '#34d399', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            EXPORT EXCEL
          </button>
          <button
            onClick={onClear}
            style={{
              padding: '9px 18px', fontFamily: 'var(--font-ui)', fontWeight: 700,
              fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
              color: '#f87171', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            CLEAR ALL SCANS
          </button>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
          <svg
            style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: searchQuery ? '#818cf8' : 'rgba(255,255,255,0.35)', pointerEvents: 'none',
              transition: 'color 0.2s',
            }}
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search scanned attendees by name, PRN, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 38,
              paddingRight: searchQuery ? 38 : 14,
              paddingTop: 10,
              paddingBottom: 10,
              background: 'rgba(0,0,0,0.45)',
              border: searchQuery ? '1px solid rgba(129,140,248,0.6)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#ffffff',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              outline: 'none',
              boxShadow: searchQuery ? '0 0 0 3px rgba(129,140,248,0.15)' : 'none',
              transition: 'all 0.2s',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                width: 20, height: 20, cursor: 'pointer', color: '#9ca3af', fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {searchQuery && (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '6px 0 0 2px' }}>
            Showing <strong style={{ color: '#818cf8' }}>{filteredEntries.length}</strong> of {entries.length} scanned attendees
          </p>
        )}
      </div>

      {/* Table / Empty Results */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
        {filteredEntries.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>No scanned records found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: 12, textDecoration: 'underline', padding: 0,
              }}
            >
              Clear search filter
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['#', 'NAME', 'PRN', 'EVENT', 'DATE', 'TEAM', 'STATUS', 'SCANNED AT', 'ACTION'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'ACTION' ? 'right' : 'left', fontWeight: 700, letterSpacing: '0.12em', fontSize: 9, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e, i) => (
                <tr
                  key={(e.id ?? e.passId) + e.scannedAt}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{e.name}</td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{e.pnr}</td>
                  <td style={{ padding: '10px 14px', color: '#22d3ee', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.event}</td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{e.date}</td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.5)' }}>{e.team}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                      background: e.status === 'Confirmed' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                      color: e.status === 'Confirmed' ? '#4ade80' : '#fbbf24',
                      border: `1px solid ${e.status === 'Confirmed' ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
                    }}>
                      {e.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', fontSize: 11 }}>
                    {new Date(e.scannedAt).toLocaleTimeString('en-IN')}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => onDeleteSingle(e)}
                      title={`Delete scan record for ${e.name}`}
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: 6,
                        padding: '4px 9px',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: 11,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: 'var(--font-ui)',
                        fontWeight: 600,
                        transition: 'all 0.15s',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Event Selector ────────────────────────────────────────────────────────────

function EventSelector({
  events,
  selectedEventId,
  onChange,
}: {
  events: EventData[]
  selectedEventId: string
  onChange: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', fontWeight: 700, margin: '0 0 8px' }}>
        SELECT EVENT TO SCAN FOR
      </p>
      <select
        value={selectedEventId}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', maxWidth: 480,
          padding: '11px 16px',
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: 10, color: selectedEventId ? '#fff' : 'rgba(255,255,255,0.4)',
          outline: 'none', cursor: 'pointer',
          appearance: 'auto',
        }}
      >
        <option value="">— Choose an event —</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.title} {ev.isPast ? '(Past)' : ''}
          </option>
        ))}
      </select>
      {!selectedEventId && (
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '8px 0 0' }}>
          You must select an event before scanning tickets.
        </p>
      )}
    </div>
  )
}

// ── Main QR Scanner Tab ───────────────────────────────────────────────────────

export default function QRScannerTab() {
  const { user } = useApp()
  const scannerDivId = 'qr-camera-feed-region'
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const [scanMode, setScanMode] = useState<'camera' | 'image'>('camera')
  const [events, setEvents] = useState<EventData[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEventTitle, setSelectedEventTitle] = useState('')

  const [scanLog, setScanLog] = useState<ScannedTicket[]>([])
  const [lastResult, setLastResult] = useState<ScannedTicket | null>(null)
  const [duplicateToast, setDuplicateToast] = useState<{ name: string; passId: string; event: string } | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [parseError, setParseError] = useState<string | null>(null)
  const [loadingScans, setLoadingScans] = useState(false)
  const [saving, setSaving] = useState(false)

  const isShared = isSupabaseConfigured()

  // Load events on mount
  useEffect(() => {
    eventService.getAllEvents().then((evts) => {
      setEvents(evts)
    }).catch(() => {})
  }, [])

  // When event changes: load existing scans + subscribe to realtime
  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    setScanLog([])
    setLastResult(null)
    setParseError(null)

    if (!selectedEventId) return

    const ev = events.find((e) => e.id === selectedEventId)
    setSelectedEventTitle(ev?.title ?? selectedEventId)

    setLoadingScans(true)
    qrScanService.getScansForEvent(selectedEventId)
      .then((entries) => setScanLog(entries))
      .catch(() => {})
      .finally(() => setLoadingScans(false))

    // Subscribe to real-time inserts & deletes from other devices
    unsubscribeRef.current = qrScanService.subscribeToEvent(
      selectedEventId,
      (newScan) => {
        setScanLog((prev) => {
          if (prev.some((e) => e.id && e.id === newScan.id)) return prev
          return [newScan, ...prev]
        })
      },
      (deletedId) => {
        setScanLog((prev) => prev.filter((e) => e.id !== deletedId))
      }
    )

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [selectedEventId, events])

  // Core scan handler
  const handleScanSuccess = useCallback(async (decodedText: string) => {
    setParseError(null)
    if (!selectedEventId) {
      setParseError('Please select an event before scanning.')
      return
    }

    let parsed: Partial<ScannedTicket>
    try {
      parsed = JSON.parse(decodedText)
    } catch {
      setParseError('Invalid QR code format — could not decode ticket data.')
      return
    }

    if (!parsed.passId && !parsed.event) {
      setParseError('This QR code is not an official event ticket.')
      return
    }

    const passId = parsed.passId ?? 'UNKNOWN'

    // Check for duplicate (server-aware when Supabase is configured)
    let isDuplicate = false
    try {
      isDuplicate = await qrScanService.isDuplicate(passId, selectedEventId)
    } catch {
      isDuplicate = scanLog.some((e) => e.passId === passId)
    }

    if (isDuplicate) {
      setDuplicateToast({
        name: parsed.name ?? 'Unknown Student',
        passId,
        event: parsed.event ?? 'Unknown Event',
      })
      return
    }

    // Save scan
    const newScan: Omit<ScannedTicket, 'id'> = {
      passId,
      eventId: selectedEventId,
      event: parsed.event ?? 'Unknown Event',
      date: parsed.date ?? 'N/A',
      location: parsed.location ?? 'N/A',
      status: parsed.status ?? 'Confirmed',
      name: parsed.name ?? 'Unknown Student',
      email: parsed.email ?? 'N/A',
      pnr: parsed.pnr ?? 'N/A',
      branch: parsed.branch ?? 'N/A',
      classYear: parsed.classYear ?? 'N/A',
      division: parsed.division ?? 'N/A',
      team: parsed.team ?? 'No Team',
      scannedAt: new Date().toISOString(),
      scannedBy: user?.id,
    }

    setSaving(true)
    try {
      const saved = await qrScanService.saveScan(newScan)
      if (!isShared) {
        setScanLog((prev) => [saved, ...prev])
      }
      setLastResult(saved)
    } catch (err: any) {
      setParseError(`Failed to record scan: ${err?.message ?? 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }, [selectedEventId, scanLog, user, isShared])

  // Stop camera helper
  const stopCameraFeed = useCallback(async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop()
      } catch (e) {
        console.warn('Error stopping camera:', e)
      }
    }
    setCameraActive(false)
  }, [])

  // Start camera helper
  const startCameraFeed = useCallback(async () => {
    if (!selectedEventId) return
    setCameraError(null)
    setParseError(null)

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerDivId)
      }
      const qr = html5QrCodeRef.current
      if (qr.isScanning) return

      await qr.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScanSuccess(decodedText)
        },
        () => {
          // ongoing frame scan failure, normal
        }
      )
      setCameraActive(true)
    } catch (err: any) {
      console.warn('Camera start error:', err)
      setCameraError(err?.message || 'Unable to access camera feed. Please check permissions or switch to Image mode.')
      setCameraActive(false)
    }
  }, [selectedEventId, handleScanSuccess])

  // Manage camera based on mode and event selection
  useEffect(() => {
    if (scanMode === 'camera' && selectedEventId) {
      const timer = setTimeout(() => {
        startCameraFeed()
      }, 150)
      return () => {
        clearTimeout(timer)
        stopCameraFeed()
      }
    } else {
      stopCameraFeed()
    }
  }, [scanMode, selectedEventId, startCameraFeed, stopCameraFeed])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraFeed()
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.clear()
        } catch {}
        html5QrCodeRef.current = null
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [stopCameraFeed])

  // Process uploaded image file
  const processImageFile = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setParseError('Please upload an image file (PNG, JPG, JPEG, WEBP).')
      return
    }
    if (!selectedEventId) {
      setParseError('Please select an event before scanning.')
      return
    }

    setParseError(null)
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)
    setIsProcessingImage(true)

    try {
      const sandboxId = 'qr-file-sandbox'
      let sandboxQr: Html5Qrcode
      try {
        sandboxQr = new Html5Qrcode(sandboxId)
      } catch {
        sandboxQr = new Html5Qrcode(sandboxId)
      }

      const decodedText = await sandboxQr.scanFile(file, false)
      try {
        sandboxQr.clear()
      } catch {}

      await handleScanSuccess(decodedText)
    } catch (err: any) {
      console.warn('QR file decode failed:', err)
      setParseError('No readable QR code found in this image. Please ensure the QR code is centered, well-lit, and uncropped.')
    } finally {
      setIsProcessingImage(false)
    }
  }

  const handleDeleteSingleScan = async (entry: ScannedTicket) => {
    const identifier = entry.pnr ? `(PRN: ${entry.pnr})` : `(Pass: ${entry.passId.slice(0, 8)}...)`
    if (!window.confirm(`Delete scan entry for ${entry.name} ${identifier}?\n\nThis will remove the record from the database and allow this ticket to be scanned again if needed.`)) {
      return
    }

    try {
      await qrScanService.deleteScan(entry)
      setScanLog((prev) => prev.filter((e) => (entry.id ? e.id !== entry.id : e.passId !== entry.passId)))
      if (lastResult?.passId === entry.passId) {
        setLastResult(null)
      }
    } catch (err: any) {
      alert(`Failed to delete scan record: ${err?.message || 'Unknown error'}`)
    }
  }

  const handleClearAllScans = async () => {
    if (!selectedEventId) return
    const count = scanLog.length
    if (count === 0) {
      alert('No scanned records to delete.')
      return
    }

    const modeText = isShared ? 'the shared database' : 'local storage'
    if (!window.confirm(`⚠️ DANGER: Delete ALL ${count} scanned records for "${selectedEventTitle}"?\n\nThis will permanently erase all scanned attendance data from ${modeText}. This action CANNOT be undone.`)) {
      return
    }

    try {
      await qrScanService.clearAllScansForEvent(selectedEventId)
      setScanLog([])
      setLastResult(null)
    } catch (err: any) {
      alert(`Failed to clear scan records: ${err?.message || 'Unknown error'}`)
    }
  }

  const handleEventChange = (id: string) => {
    stopCameraFeed()
    setSelectedEventId(id)
    setImagePreview(null)
    setParseError(null)
  }

  return (
    <div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dupeSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-16px) scale(0.96); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1); }
        }
        @keyframes dupeShrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
        #qr-camera-feed-region video {
          border-radius: 14px !important;
          object-fit: cover !important;
          width: 100% !important;
        }
      `}</style>

      {/* Hidden container for file decoding sandbox */}
      <div id="qr-file-sandbox" style={{ display: 'none' }} />

      {/* Hidden file input with automatic reset on click to guarantee file chooser ALWAYS re-opens */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            processImageFile(file)
          }
        }}
        onClick={(e) => {
          // Crucial fix: Reset value on click so clicking again ALWAYS fires onChange even for same file or after cancel
          e.currentTarget.value = ''
        }}
      />

      {/* Section Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.2em', color: '#38bdf8', fontWeight: 700, margin: 0 }}>
            TICKET VERIFICATION SYSTEM
          </p>
          {isShared ? (
            <span style={{
              padding: '3px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              fontFamily: 'var(--font-ui)', borderRadius: 6,
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399',
            }}>
              ☁️ SHARED DATABASE — MULTI-DEVICE
            </span>
          ) : (
            <span style={{
              padding: '3px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              fontFamily: 'var(--font-ui)', borderRadius: 6,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24',
            }}>
              ⚠️ LOCAL MODE — NOT SHARED
            </span>
          )}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: '#fff', margin: 0, lineHeight: 1.1 }}>
          QR SCANNER
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '8px 0 0' }}>
          {isShared
            ? 'Scans are saved to the shared database in real-time. All admins and authorized operators scanning the same event will see the same attendance sheet.'
            : 'Supabase is not configured — scans are stored locally on this device only. Configure Supabase to enable cross-device sharing.'}
        </p>
      </div>

      {/* Event Selector */}
      <EventSelector
        events={events}
        selectedEventId={selectedEventId}
        onChange={handleEventChange}
      />

      {/* Loading existing scans */}
      {loadingScans && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ width: 16, height: 16, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading existing scans from database...
        </div>
      )}

      {/* Main scanner + result layout (only shown when event is selected) */}
      {selectedEventId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) 1fr', gap: 28, alignItems: 'start' }}>

          {/* Left: Scanner Card */}
          <div>
            <div style={{
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 18, overflow: 'hidden', padding: 20,
            }}>
              {/* Header & Mode Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: '0.15em', color: '#22d3ee', fontWeight: 700, margin: 0 }}>
                    SCAN TICKETS
                  </p>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                    {selectedEventTitle}
                  </p>
                </div>
                {saving && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)', fontSize: 10, color: '#34d399' }}>
                    <div style={{ width: 12, height: 12, border: '2px solid #34d399', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    SAVING...
                  </div>
                )}
              </div>

              {/* Mode Toggle Buttons */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                background: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 10,
                marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <button
                  onClick={() => setScanMode('camera')}
                  style={{
                    padding: '8px 12px', borderRadius: 8, fontFamily: 'var(--font-ui)',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: scanMode === 'camera' ? 'rgba(34,211,238,0.15)' : 'transparent',
                    border: scanMode === 'camera' ? '1px solid rgba(34,211,238,0.4)' : 'none',
                    color: scanMode === 'camera' ? '#22d3ee' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  CAMERA
                </button>
                <button
                  onClick={() => setScanMode('image')}
                  style={{
                    padding: '8px 12px', borderRadius: 8, fontFamily: 'var(--font-ui)',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: scanMode === 'image' ? 'rgba(129,140,248,0.15)' : 'transparent',
                    border: scanMode === 'image' ? '1px solid rgba(129,140,248,0.4)' : 'none',
                    color: scanMode === 'image' ? '#818cf8' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  UPLOAD IMAGE
                </button>
              </div>

              {/* Camera View Mode */}
              {scanMode === 'camera' && (
                <div>
                  <div
                    id={scannerDivId}
                    style={{
                      minHeight: 260,
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: 'rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  />

                  {cameraError && (
                    <div style={{
                      marginTop: 12, padding: '12px 14px', borderRadius: 10,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171', fontFamily: 'var(--font-ui)', fontSize: 11,
                    }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 700 }}>⚠️ CAMERA ACCESS ISSUE</p>
                      <p style={{ margin: 0 }}>{cameraError}</p>
                      <button
                        onClick={() => setScanMode('image')}
                        style={{
                          marginTop: 8, padding: '6px 12px', borderRadius: 6,
                          background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                          color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                        }}
                      >
                        Switch to Image Upload Mode →
                      </button>
                    </div>
                  )}

                  {!cameraActive && !cameraError && (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-ui)', fontSize: 12, letterSpacing: '0.1em' }}>
                      <div style={{ width: 28, height: 28, border: '3px solid #22d3ee', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                      INITIALISING CAMERA...
                    </div>
                  )}
                </div>
              )}

              {/* Image Upload Mode */}
              {scanMode === 'image' && (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDragging(false)
                      const file = e.dataTransfer.files?.[0]
                      if (file) processImageFile(file)
                    }}
                    style={{
                      border: `2px dashed ${isDragging ? '#818cf8' : 'rgba(129,140,248,0.35)'}`,
                      background: isDragging ? 'rgba(129,140,248,0.1)' : 'rgba(0,0,0,0.4)',
                      borderRadius: 14,
                      padding: '32px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isProcessingImage ? (
                      <div style={{ padding: '20px 0' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid #818cf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#818cf8', fontWeight: 700, margin: 0 }}>
                          DECODING TICKET QR CODE...
                        </p>
                      </div>
                    ) : imagePreview ? (
                      <div>
                        <img
                          src={imagePreview}
                          alt="Uploaded ticket"
                          style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 10, margin: '0 auto 12px', display: 'block', objectFit: 'contain' }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            fileInputRef.current?.click()
                          }}
                          style={{
                            padding: '8px 16px', borderRadius: 8,
                            background: 'rgba(129,140,248,0.2)', border: '1px solid rgba(129,140,248,0.5)',
                            color: '#a5b4fc', fontFamily: 'var(--font-ui)', fontSize: 11,
                            fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em',
                          }}
                        >
                          CHOOSE ANOTHER IMAGE
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{
                          width: 48, height: 48, borderRadius: 12,
                          background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 14px', color: '#818cf8',
                        }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                        </div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
                          CLICK TO BROWSE OR DRAG &amp; DROP
                        </p>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 12px' }}>
                          Supports ticket screenshots (PNG, JPG, WEBP)
                        </p>
                        <span style={{
                          display: 'inline-block', padding: '6px 14px', borderRadius: 6,
                          background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.4)',
                          color: '#818cf8', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
                        }}>
                          SELECT IMAGE FILE
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', fontWeight: 700, margin: '0 0 4px' }}>TOTAL SCANNED</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#22d3ee', margin: 0 }}>{scanLog.length}</p>
              </div>
              <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', fontWeight: 700, margin: '0 0 4px' }}>LAST SCAN</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#818cf8', margin: 0, wordBreak: 'break-all' }}>
                  {scanLog[0]?.name || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Result + instructions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {parseError && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 12, padding: '16px 20px',
                fontFamily: 'var(--font-ui)', fontSize: 12, color: '#f87171',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{parseError}</span>
              </div>
            )}

            {lastResult ? (
              <ScanResultCard
                ticket={lastResult}
                onDismiss={() => setLastResult(null)}
              />
            ) : (
              <div style={{
                background: 'rgba(15,23,42,0.5)', border: '1px dashed rgba(255,255,255,0.1)',
                borderRadius: 16, padding: '40px 28px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>📷</div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)', fontWeight: 700, margin: '0 0 6px' }}>
                  AWAITING SCAN
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                  Scan a student's event ticket QR code to verify entry.
                </p>
              </div>
            )}

            <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '16px 20px' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.2em', color: '#818cf8', fontWeight: 700, margin: '0 0 10px' }}>
                HOW TO USE
              </p>
              <ol style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, paddingLeft: 18, lineHeight: 2 }}>
                <li>Select the event from the dropdown above.</li>
                <li><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Camera Mode:</strong> Point your camera directly at the student's ticket QR code.</li>
                <li><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Image Mode:</strong> Click the dropzone or drag &amp; drop a ticket screenshot.</li>
                <li>Duplicate tickets show a red popup warning and are never logged twice.</li>
                <li>All admins &amp; operators share one live attendance sheet. Click <strong style={{ color: 'rgba(255,255,255,0.7)' }}>EXPORT EXCEL</strong> to download.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Scan Log */}
      {selectedEventId && (
        <ScanLogTable
          entries={scanLog}
          eventTitle={selectedEventTitle}
          onExport={() => exportScannedToExcel(scanLog, selectedEventTitle)}
          onClear={handleClearAllScans}
          onDeleteSingle={handleDeleteSingleScan}
          isShared={isShared}
        />
      )}

      {/* Duplicate Entry Toast */}
      {duplicateToast && (
        <DuplicateAlertToast
          name={duplicateToast.name}
          passId={duplicateToast.passId}
          event={duplicateToast.event}
          onClose={() => setDuplicateToast(null)}
        />
      )}
    </div>
  )
}
