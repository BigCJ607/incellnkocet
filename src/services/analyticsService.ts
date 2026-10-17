import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface UserSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  pagesVisited: string[];
  userAgent: string;
}

export interface DailyUsage {
  date: string;       // e.g. "2026-08-13"
  label: string;      // e.g. "Aug 13"
  totalSeconds: number;
  sessionCount: number;
}

export interface PlatformDailyUsage {
  date: string;
  label: string;
  totalSeconds: number;
  activeUsersCount: number;
  sessionCount: number;
}

export interface UserAnalyticsSummary {
  userId: string;
  userName: string;
  email: string;
  avatarUrl?: string;
  firstSeen: string;
  lastSeen: string;
  totalSessions: number;
  totalTimeSeconds: number;
  todaySeconds: number;
  avgSessionSeconds: number;
  avgDailySeconds: number;
  activeDaysCount: number;
  pagesVisited: string[];
  topPage: string;
  ticketsCount: number;
  messagesSent: number;
  dailyBreakdown: DailyUsage[];
  sessions: UserSession[];
}

const SESSION_KEY = 'tiredboss_session_id';
const SESSION_START_KEY = 'tiredboss_session_start';
const SESSION_ACTIVE_KEY = 'tiredboss_session_active_sec';
const SESSION_PAGES_KEY = 'tiredboss_session_pages';

export const analyticsService = {
  /** Start a NEW session for a logged-in user — always fresh on each page load */
  async startSession(userId: string): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;
    // Always clear any stale session first
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_START_KEY);
    localStorage.removeItem(SESSION_ACTIVE_KEY);
    localStorage.removeItem(SESSION_PAGES_KEY);

    const userAgent = navigator.userAgent.slice(0, 250);
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          user_agent: userAgent,
          pages_visited: [],
          duration_seconds: 0,
        })
        .select('id')
        .single();

      if (error || !data) {
        console.warn('startSession error:', error);
        return null;
      }

      const sessionId = data.id;
      localStorage.setItem(SESSION_KEY, sessionId);
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
      localStorage.setItem(SESSION_ACTIVE_KEY, '0');
      localStorage.setItem(SESSION_PAGES_KEY, JSON.stringify([]));
      return sessionId;
    } catch (err) {
      console.warn('startSession exception:', err);
      return null;
    }
  },

  /** Record a page navigation within the current session */
  recordPageVisit(page: string): void {
    try {
      const raw = localStorage.getItem(SESSION_PAGES_KEY);
      const pages: string[] = raw ? JSON.parse(raw) : [];
      if (pages[pages.length - 1] !== page) {
        pages.push(page);
        localStorage.setItem(SESSION_PAGES_KEY, JSON.stringify(pages));
      }
    } catch { /* silent */ }
  },

  /** Update accumulated active seconds in localStorage */
  updateActiveSeconds(seconds: number): void {
    localStorage.setItem(SESSION_ACTIVE_KEY, seconds.toString());
  },

  /** Flush the current session to Supabase */
  async flushSession(overrideActiveSeconds?: number): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return;

    let durationSeconds = overrideActiveSeconds;
    if (durationSeconds === undefined) {
      const storedActive = localStorage.getItem(SESSION_ACTIVE_KEY);
      if (storedActive !== null) {
        durationSeconds = parseInt(storedActive, 10);
      } else {
        const startStr = localStorage.getItem(SESSION_START_KEY);
        durationSeconds = startStr ? Math.max(1, Math.round((Date.now() - parseInt(startStr, 10)) / 1000)) : 0;
      }
    }

    const pages: string[] = (() => {
      try { return JSON.parse(localStorage.getItem(SESSION_PAGES_KEY) || '[]'); }
      catch { return []; }
    })();

    try {
      await supabase.from('user_sessions').update({
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        pages_visited: pages,
      }).eq('id', sessionId);
    } catch (err) {
      console.warn('flushSession exception:', err);
    }
  },

  /** Clear session from localStorage (on logout) */
  clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_START_KEY);
    localStorage.removeItem(SESSION_ACTIVE_KEY);
    localStorage.removeItem(SESSION_PAGES_KEY);
  },

  getCurrentSessionId(): string | null {
    return localStorage.getItem(SESSION_KEY);
  },

  /** Admin: get all users' analytics summaries */
  async getAllUsersAnalytics(): Promise<UserAnalyticsSummary[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const [profilesRes, sessionsRes, ticketsRes, messagesRes] = await Promise.all([
        supabase.from('profiles').select('id, name, contact_email, avatar_url, created_at').order('created_at', { ascending: false }),
        supabase.from('user_sessions').select('*').order('started_at', { ascending: false }),
        supabase.from('tickets').select('user_id'),
        supabase.from('team_messages').select('user_id'),
      ]);

      const profiles = profilesRes.data || [];
      const sessions: any[] = sessionsRes.data || [];
      const tickets: any[] = ticketsRes.data || [];
      const messages: any[] = messagesRes.data || [];

      const ticketMap: Record<string, number> = {};
      tickets.forEach(t => { ticketMap[t.user_id] = (ticketMap[t.user_id] || 0) + 1; });

      const msgMap: Record<string, number> = {};
      messages.forEach(m => { if (m.user_id) msgMap[m.user_id] = (msgMap[m.user_id] || 0) + 1; });

      const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

      return profiles.map(p => {
        const userSessions: UserSession[] = sessions
          .filter(s => s.user_id === p.id)
          .map((s: any) => ({
            id: s.id,
            userId: s.user_id,
            startedAt: s.started_at,
            endedAt: s.ended_at || undefined,
            durationSeconds: s.duration_seconds || 0,
            pagesVisited: Array.isArray(s.pages_visited) ? s.pages_visited : [],
            userAgent: s.user_agent || '',
          }));

        const totalSessions = userSessions.length;
        const totalTimeSeconds = userSessions.reduce((sum: number, s) => sum + s.durationSeconds, 0);
        const avgSessionSeconds = totalSessions > 0 ? Math.round(totalTimeSeconds / totalSessions) : 0;
        const lastSeen = userSessions.length > 0 ? userSessions[0].startedAt : p.created_at;

        // Daily breakdown calculation
        const dailyBreakdown = getDailyBreakdown(userSessions);
        const activeDaysCount = dailyBreakdown.length;
        const avgDailySeconds = activeDaysCount > 0 ? Math.round(totalTimeSeconds / activeDaysCount) : 0;

        // Today's total time
        const todaySessions = userSessions.filter(s => s.startedAt.slice(0, 10) === todayStr);
        const todaySeconds = todaySessions.reduce((sum, s) => sum + s.durationSeconds, 0);

        const allPages: string[] = [];
        userSessions.forEach(s => {
          if (Array.isArray(s.pagesVisited)) allPages.push(...s.pagesVisited);
        });
        const uniquePages = [...new Set(allPages)];
        const pageCounts: Record<string, number> = {};
        allPages.forEach(pg => { pageCounts[pg] = (pageCounts[pg] || 0) + 1; });
        const topPage = Object.entries(pageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        return {
          userId: p.id,
          userName: p.name || 'Anonymous',
          email: p.contact_email || '',
          avatarUrl: p.avatar_url || '',
          firstSeen: p.created_at,
          lastSeen,
          totalSessions,
          totalTimeSeconds,
          todaySeconds,
          avgSessionSeconds,
          avgDailySeconds,
          activeDaysCount,
          pagesVisited: uniquePages,
          topPage,
          ticketsCount: ticketMap[p.id] || 0,
          messagesSent: msgMap[p.id] || 0,
          dailyBreakdown,
          sessions: userSessions,
        };
      });
    } catch (err) {
      console.warn('getAllUsersAnalytics exception:', err);
      return [];
    }
  },
};

/** Format seconds as Xh Ym Zs */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Format ISO date as relative time */
export function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch { return '—'; }
}

/** Group a user's sessions by calendar day (last 30 days) */
export function getDailyBreakdown(sessions: UserSession[]): DailyUsage[] {
  const map: Record<string, { totalSeconds: number; sessionCount: number }> = {};

  sessions.forEach(s => {
    const date = s.startedAt.slice(0, 10); // "YYYY-MM-DD"
    if (!map[date]) map[date] = { totalSeconds: 0, sessionCount: 0 };
    map[date].totalSeconds += s.durationSeconds;
    map[date].sessionCount += 1;
  });

  return Object.entries(map)
    .map(([date, vals]) => ({
      date,
      label: new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ...vals,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // last 30 days
}

/** Aggregate daily usage across all users for platform-wide trend */
export function getPlatformDailyBreakdown(summaries: UserAnalyticsSummary[]): PlatformDailyUsage[] {
  const map: Record<string, { totalSeconds: number; userIds: Set<string>; sessionCount: number }> = {};

  summaries.forEach(user => {
    user.sessions.forEach(s => {
      const date = s.startedAt.slice(0, 10);
      if (!map[date]) {
        map[date] = { totalSeconds: 0, userIds: new Set<string>(), sessionCount: 0 };
      }
      map[date].totalSeconds += s.durationSeconds;
      map[date].userIds.add(user.userId);
      map[date].sessionCount += 1;
    });
  });

  return Object.entries(map)
    .map(([date, vals]) => ({
      date,
      label: new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      totalSeconds: vals.totalSeconds,
      activeUsersCount: vals.userIds.size,
      sessionCount: vals.sessionCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14); // last 14 days
}
