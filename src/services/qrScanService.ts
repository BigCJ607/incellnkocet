import { supabase, isSupabaseConfigured } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScannedTicket {
  id?: string          // UUID from Supabase (undefined when using localStorage)
  passId: string
  eventId: string      // to scope per-event queries
  event: string
  date: string
  location: string
  status: string
  name: string
  email: string
  pnr: string
  branch: string
  classYear: string
  division: string
  team: string
  scannedAt: string    // ISO timestamp
  scannedBy?: string   // admin user id
}

// ── localStorage fallback keys ────────────────────────────────────────────────

const localKey = (eventId: string) => `qr_scans_${eventId}`

function getLocal(eventId: string): ScannedTicket[] {
  try {
    const raw = localStorage.getItem(localKey(eventId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocal(eventId: string, entries: ScannedTicket[]): void {
  try {
    localStorage.setItem(localKey(eventId), JSON.stringify(entries))
  } catch {}
}

// ── Service ───────────────────────────────────────────────────────────────────

export const qrScanService = {
  /**
   * Save a new scan entry.
   * – When Supabase is configured: inserts into `qr_scan_logs` table.
   * – Fallback: persists to localStorage keyed by eventId.
   */
  async saveScan(scan: Omit<ScannedTicket, 'id'>): Promise<ScannedTicket> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('qr_scan_logs')
        .insert({
          pass_id: scan.passId,
          event_id: scan.eventId,
          event: scan.event,
          date: scan.date,
          location: scan.location,
          status: scan.status,
          name: scan.name,
          email: scan.email,
          pnr: scan.pnr,
          branch: scan.branch,
          class_year: scan.classYear,
          division: scan.division,
          team: scan.team,
          scanned_at: scan.scannedAt,
          scanned_by: scan.scannedBy ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return mapRow(data)
    }

    // localStorage fallback
    const existing = getLocal(scan.eventId)
    const entry: ScannedTicket = { ...scan, id: crypto.randomUUID() }
    saveLocal(scan.eventId, [entry, ...existing])
    return entry
  },

  /**
   * Fetch all scans for a given event (most-recent first).
   */
  async getScansForEvent(eventId: string): Promise<ScannedTicket[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('qr_scan_logs')
        .select('*')
        .eq('event_id', eventId)
        .order('scanned_at', { ascending: false })

      if (error) throw error
      return (data ?? []).map(mapRow)
    }

    return getLocal(eventId)
  },

  /**
   * Check whether a passId has already been scanned for this event.
   */
  async isDuplicate(passId: string, eventId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const { count, error } = await supabase
        .from('qr_scan_logs')
        .select('id', { count: 'exact', head: true })
        .eq('pass_id', passId)
        .eq('event_id', eventId)

      if (error) throw error
      return (count ?? 0) > 0
    }

    return getLocal(eventId).some((e) => e.passId === passId)
  },

  /**
   * Delete a specific scan by its ID or passId + eventId.
   */
  async deleteScan(scan: ScannedTicket): Promise<boolean> {
    if (isSupabaseConfigured()) {
      if (scan.id) {
        const { error } = await supabase
          .from('qr_scan_logs')
          .delete()
          .eq('id', scan.id)

        if (error) throw error
      } else if (scan.passId && scan.eventId) {
        const { error } = await supabase
          .from('qr_scan_logs')
          .delete()
          .eq('pass_id', scan.passId)
          .eq('event_id', scan.eventId)

        if (error) throw error
      }
    }

    // Always clean up localStorage copy
    const existing = getLocal(scan.eventId)
    const filtered = existing.filter((e) => (scan.id ? e.id !== scan.id : e.passId !== scan.passId))
    saveLocal(scan.eventId, filtered)
    return true
  },

  /**
   * Clear all scan records for an entire event.
   */
  async clearAllScansForEvent(eventId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('qr_scan_logs')
        .delete()
        .eq('event_id', eventId)

      if (error) throw error
    }

    localStorage.removeItem(localKey(eventId))
    return true
  },

  /**
   * Subscribe to real-time inserts and deletes for a specific event.
   * Returns an unsubscribe function.
   */
  subscribeToEvent(
    eventId: string,
    onInsert: (scan: ScannedTicket) => void,
    onDelete?: (deletedId: string) => void
  ): () => void {
    if (!isSupabaseConfigured()) return () => {}

    const channel = supabase
      .channel(`qr_scans:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_scan_logs',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          onInsert(mapRow(payload.new))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'qr_scan_logs',
        },
        (payload) => {
          if (onDelete && payload.old?.id) {
            onDelete(payload.old.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: any): ScannedTicket {
  return {
    id: row.id,
    passId: row.pass_id,
    eventId: row.event_id,
    event: row.event,
    date: row.date,
    location: row.location,
    status: row.status,
    name: row.name,
    email: row.email,
    pnr: row.pnr,
    branch: row.branch,
    classYear: row.class_year,
    division: row.division,
    team: row.team,
    scannedAt: row.scanned_at,
    scannedBy: row.scanned_by,
  }
}
