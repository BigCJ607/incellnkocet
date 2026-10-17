import type { EventData, UserTicket, EventWinner } from '../mocks/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const MONTHS_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

/**
 * Dynamically checks if an event is in the past based on the exact date and time
 * when the user visits the page.
 */
export function isEventInPast(event: { date?: string; isPast?: boolean }): boolean {
  if (event.isPast) return true;
  if (!event.date) return false;

  // Real-time runtime timestamp when user accesses the page
  const now = new Date();
  const currentMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const cleanDateStr = event.date.trim();

  // Extract 4-digit year (e.g. 2024, 2025, 2026)
  const yearMatch = cleanDateStr.match(/\b(20\d{2})\b/);
  if (!yearMatch) {
    const parsed = new Date(cleanDateStr);
    return !isNaN(parsed.getTime()) ? parsed < currentMidnight : false;
  }

  const year = parseInt(yearMatch[1], 10);

  // Match month name or ISO format
  const monthMatch = cleanDateStr.toUpperCase().match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/);
  let month = 0;
  if (monthMatch) {
    month = MONTHS_MAP[monthMatch[1]];
  } else {
    const isoMatch = cleanDateStr.match(/20\d{2}[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      month = parseInt(isoMatch[1], 10) - 1;
      const day = parseInt(isoMatch[2], 10);
      const eventEnd = new Date(year, month, day, 23, 59, 59);
      return eventEnd < currentMidnight;
    }
  }

  // Extract day(s) e.g. "14–16", "24–26", "12-14", "05"
  const dayMatches = [...cleanDateStr.matchAll(/\b(\d{1,2})\b/g)]
    .map(m => parseInt(m[1], 10))
    .filter(d => d >= 1 && d <= 31);
  const day = dayMatches.length > 0 ? Math.max(...dayMatches) : 28;

  // The event is considered active until the end of its final scheduled day
  const eventEndTime = new Date(year, month, day, 23, 59, 59);
  return eventEndTime < currentMidnight;
}

/**
 * Calculates event duration in days from its date string or schedule.
 */
export function calculateEventDays(dateStr?: string, scheduleLength?: number): number {
  if (scheduleLength && scheduleLength > 0) return scheduleLength;
  if (!dateStr) return 1;

  // Match day range like "AUG 22–24", "14-16", "14–16", "24 – 26"
  const rangeMatch = dateStr.match(/\b(\d{1,2})\s*[-–—]\s*(\d{1,2})\b/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (end >= start) {
      return (end - start) + 1;
    }
  }

  return 1;
}

const mapDbEvent = (row: any): EventData => {
  const isPast = isEventInPast({ date: row.date, isPast: !!row.is_past });
  let winners: EventWinner[] = Array.isArray(row.winners) ? row.winners : [];
  try {
    const local = localStorage.getItem(`tiredboss_event_winners_${row.id}`);
    if (local) winners = JSON.parse(local);
  } catch (e) { }

  return {
    id: row.id,
    title: row.title,
    date: row.date,
    category: row.category,
    shortDescription: row.short_description || row.shortDescription || '',
    fullDescription: row.full_description || row.fullDescription || '',
    location: row.location,
    address: row.address,
    attendees: row.attendees || '0',
    speakers: Array.isArray(row.speakers) ? row.speakers : [],
    schedule: Array.isArray(row.schedule) ? row.schedule : [],
    isPast,
    maxTeamSize: row.max_team_size ?? 4,
    time: row.time || '',
    submissionsEnabled: !!row.submissions_enabled,
    teamFormationLive: !!row.team_formation_live,
    winners,
    posterUrl: row.poster_url || '',
  };
};


const mapDbTicket = (row: any): UserTicket => ({
  id: row.id,
  eventId: row.event_id || row.eventId,
  eventTitle: row.event_title || row.eventTitle,
  date: row.date,
  location: row.location,
  teamName: row.team_name || row.teamName,
  status: row.status as 'Confirmed' | 'Waitlisted',
  userId: row.user_id || row.userId,
});

export const eventService = {
  async getAllEvents(): Promise<EventData[]> {
    if (!isSupabaseConfigured()) {
      await delay(100);
      return [];
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Supabase getAllEvents error:', error);
      return [];
    }

    return data.map(mapDbEvent);
  },

  /**
   * Fetches only active & upcoming events (events happening today or in the future).
   */
  async getEvents(): Promise<EventData[]> {
    if (!isSupabaseConfigured()) {
      await delay(100);
      return [];
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn('Supabase getEvents error:', error);
      return [];
    }

    const allMapped = data.map(mapDbEvent);
    return allMapped.filter(e => !e.isPast);
  },

  /**
   * Fetches past events (events that occurred before today's date).
   */
  async getPastEvents(): Promise<EventData[]> {
    if (!isSupabaseConfigured()) {
      await delay(100);
      return [];
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Supabase getPastEvents error:', error);
      return [];
    }

    const allMapped = data.map(mapDbEvent);
    return allMapped.filter(e => e.isPast);
  },

  async getEventById(id: string): Promise<EventData | undefined> {
    if (!isSupabaseConfigured()) {
      await delay(100);
      return undefined;
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return undefined;
    }

    return mapDbEvent(data);
  },

  async getEventStats(eventId: string): Promise<{ enrollmentCount: number; teamCount: number }> {
    if (!isSupabaseConfigured()) {
      return { enrollmentCount: 0, teamCount: 0 };
    }

    try {
      const [ticketsRes, teamsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId),
        supabase
          .from('teams')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId),
      ]);

      return {
        enrollmentCount: ticketsRes.count || 0,
        teamCount: teamsRes.count || 0,
      };
    } catch {
      return { enrollmentCount: 0, teamCount: 0 };
    }
  },

  async createEvent(event: EventData): Promise<EventData> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please add your credentials in .env to create events.');
    }

    const computedIsPast = isEventInPast({ date: event.date, isPast: !!event.isPast });

    const dbPayload = {
      id: event.id || `evt-${Date.now()}`,
      title: event.title,
      date: event.date,
      category: event.category,
      short_description: event.shortDescription,
      full_description: event.fullDescription,
      location: event.location,
      address: event.address,
      attendees: event.attendees || '0',
      speakers: event.speakers || [],
      schedule: event.schedule || [],
      is_past: computedIsPast,
      max_team_size: event.maxTeamSize ?? 4,
      time: event.time || '',
      submissions_enabled: !!event.submissionsEnabled,
      team_formation_live: !!event.teamFormationLive,
      poster_url: event.posterUrl || '',
    };

    const { data, error } = await supabase
      .from('events')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbEvent(data);
  },

  async updateEvent(id: string, updates: Partial<EventData>): Promise<EventData> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please add your credentials in .env to update events.');
    }

    const dbPayload: Record<string, any> = {};
    if (updates.title !== undefined) dbPayload.title = updates.title;
    if (updates.date !== undefined) {
      dbPayload.date = updates.date;
      dbPayload.is_past = isEventInPast({ date: updates.date, isPast: updates.isPast });
    }
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.shortDescription !== undefined) dbPayload.short_description = updates.shortDescription;
    if (updates.fullDescription !== undefined) dbPayload.full_description = updates.fullDescription;
    if (updates.location !== undefined) dbPayload.location = updates.location;
    if (updates.address !== undefined) dbPayload.address = updates.address;
    if (updates.attendees !== undefined) dbPayload.attendees = updates.attendees;
    if (updates.speakers !== undefined) dbPayload.speakers = updates.speakers;
    if (updates.schedule !== undefined) dbPayload.schedule = updates.schedule;
    if (updates.isPast !== undefined) dbPayload.is_past = updates.isPast;
    if (updates.maxTeamSize !== undefined) dbPayload.max_team_size = updates.maxTeamSize;
    if (updates.time !== undefined) dbPayload.time = updates.time;
    if (updates.submissionsEnabled !== undefined) dbPayload.submissions_enabled = !!updates.submissionsEnabled;
    if (updates.teamFormationLive !== undefined) dbPayload.team_formation_live = !!updates.teamFormationLive;
    if (updates.posterUrl !== undefined) dbPayload.poster_url = updates.posterUrl;

    const { data, error } = await supabase
      .from('events')
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbEvent(data);
  },

  async deleteEvent(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return false;
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  },

  async getMyTickets(userId: string): Promise<UserTicket[]> {
    if (!isSupabaseConfigured() || !userId) {
      return [];
    }

    const { data: ticketRows, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !ticketRows) {
      console.warn('Supabase getMyTickets error:', error);
      return [];
    }

    // Fetch team memberships for this user to resolve team names
    const { data: memberRows } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name, event_id)')
      .eq('user_id', userId);

    const eventTeamMap: Record<string, string> = {};
    if (memberRows) {
      memberRows.forEach((m: any) => {
        const teamObj = Array.isArray(m.teams) ? m.teams[0] : m.teams;
        if (teamObj && teamObj.event_id && teamObj.name) {
          eventTeamMap[teamObj.event_id] = teamObj.name;
        }
      });
    }

    // Fetch events to resolve submissions_enabled status
    const eventIds = ticketRows.map((t: any) => t.event_id).filter(Boolean);
    const eventSubmissionsMap: Record<string, boolean> = {};
    if (eventIds.length > 0) {
      const { data: eventRows } = await supabase
        .from('events')
        .select('id, submissions_enabled')
        .in('id', eventIds);

      if (eventRows) {
        eventRows.forEach((e: any) => {
          eventSubmissionsMap[e.id] = !!e.submissions_enabled;
        });
      }
    }

    return ticketRows.map((row: any) => {
      const ticket = mapDbTicket(row);
      const dynamicTeam = eventTeamMap[ticket.eventId];
      if (dynamicTeam) {
        ticket.teamName = dynamicTeam;
      }
      ticket.submissionsEnabled = eventSubmissionsMap[ticket.eventId] ?? false;
      return ticket;
    });
  },

  async registerTicket(eventId: string, teamName?: string): Promise<UserTicket> {
    if (!isSupabaseConfigured()) {
      throw new Error('Please configure Supabase credentials in .env to register passes.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error('You must be signed in to claim an event pass.');
    }

    const event = await this.getEventById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const newTicket = {
      id: `tkt-${Date.now()}`,
      event_id: eventId,
      user_id: userId,
      event_title: event.title,
      date: event.date,
      location: event.location,
      team_name: teamName || null,
      status: 'Confirmed',
    };

    const { data, error } = await supabase
      .from('tickets')
      .insert(newTicket)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbTicket(data);
  },

  async getUserTickets(userId: string): Promise<UserTicket[]> {
    return this.getMyTickets(userId);
  },

  async registerForEvent(eventId: string, userIdOrTeamName?: any, form?: any): Promise<UserTicket> {
    const teamName = typeof userIdOrTeamName === 'string' && !userIdOrTeamName.startsWith('guest') && userIdOrTeamName.length < 30
      ? userIdOrTeamName
      : form?.teamName;
    return this.registerTicket(eventId, teamName);
  },

  /**
   * Unenrolls / cancels a user's registration pass for an event.
   */
  async cancelTicket(ticketId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return true;
    }

    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticketId);

    if (error) {
      throw new Error(error.message);
    }
    return true;
  },

  async unenrollFromEvent(eventId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return true;
    }

    const { error } = await supabase
      .from('tickets')
      .delete()
      .match({ event_id: eventId, user_id: userId });

    if (error) {
      throw new Error(error.message);
    }
    return true;
  },

  /** Declare a winner team for an event */
  async declareEventWinner(eventId: string, winner: EventWinner): Promise<void> {
    const key = `tiredboss_event_winners_${eventId}`;
    try {
      const existingRaw = localStorage.getItem(key);
      let list: EventWinner[] = existingRaw ? JSON.parse(existingRaw) : [];
      list = list.filter(w => w.teamId !== winner.teamId && w.position !== winner.position);
      list.push(winner);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.warn('LocalStorage save winner error:', e);
    }

    if (isSupabaseConfigured()) {
      try {
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        await supabase
          .from('events')
          .update({ winners: list })
          .eq('id', eventId);
      } catch (err) {
        console.warn('Supabase update event winners error:', err);
      }
    }
  },

  /** Remove a winner team from an event */
  async removeEventWinner(eventId: string, teamId: string): Promise<void> {
    const key = `tiredboss_event_winners_${eventId}`;
    try {
      const existingRaw = localStorage.getItem(key);
      let list: EventWinner[] = existingRaw ? JSON.parse(existingRaw) : [];
      list = list.filter(w => w.teamId !== teamId);
      localStorage.setItem(key, JSON.stringify(list));

      if (isSupabaseConfigured()) {
        await supabase
          .from('events')
          .update({ winners: list })
          .eq('id', eventId);
      }
    } catch (e) {
      console.warn('Remove winner error:', e);
    }
  },

  /** Toggle Team Formation status for an event */
  async toggleTeamFormation(eventId: string, live: boolean): Promise<void> {
    try {
      // Find event and update mock data in localStorage
      const eventsStr = localStorage.getItem('tiredboss_events_list');
      if (eventsStr) {
        let eventsList: EventData[] = JSON.parse(eventsStr);
        eventsList = eventsList.map(e => e.id === eventId ? { ...e, teamFormationLive: live } : e);
        localStorage.setItem('tiredboss_events_list', JSON.stringify(eventsList));
      }

      if (isSupabaseConfigured()) {
        await supabase
          .from('events')
          .update({ team_formation_live: live })
          .eq('id', eventId);
      }
    } catch (e) {
      console.error('Error toggling team formation:', e);
      throw e;
    }
  }
};

