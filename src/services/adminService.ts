import type { AdminUserView, EventEnrollmentView, PlatformStats, UserTicket, ClassYear, Team, TeamMember } from '../mocks/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isEventInPast } from './eventService';

export const adminService = {
  async getAllUsers(): Promise<AdminUserView[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profError || !profiles) {
      console.warn('Supabase getAllUsers error:', profError);
      return [];
    }

    const { data: tickets } = await supabase
      .from('tickets')
      .select('*');

    const allTickets: any[] = tickets || [];

    return profiles.map(p => {
      const uTickets: UserTicket[] = allTickets
        .filter(t => t.user_id === p.id)
        .map(t => ({
          id: t.id,
          eventId: t.event_id,
          eventTitle: t.event_title,
          date: t.date,
          location: t.location,
          teamName: t.team_name,
          status: t.status,
          userId: t.user_id,
        }));

      return {
        id: p.id,
        name: p.name || 'Anonymous Student',
        email: p.contact_email || 'No email registered',
        pnr: p.pnr || '',
        branch: p.branch || 'Unassigned',
        role: (p.role === 'admin' ? 'admin' : 'student') as 'admin' | 'student',
        classYear: (p.class_year || 'First Year') as ClassYear,
        division: p.division || 'Unassigned',
        phoneNumber: p.phone_number || '',
        bio: p.bio || '',
        avatarUrl: p.avatar_url && !p.avatar_url.includes('pravatar.cc')
          ? p.avatar_url
          : '',
        createdAt: p.created_at,
        ticketsCount: uTickets.length,
        tickets: uTickets,
        passwordPlain: p.password_plain || '',
        scannerAccess: p.scanner_access === true,
      };
    });
  },

  /**
   * Fetches all student registrations/enrollments with their complete live profile details.
   */
  async getAllEnrollments(eventId?: string): Promise<EventEnrollmentView[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    let query = supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data: tickets, error: ticketError } = await query;
    if (ticketError || !tickets) {
      console.warn('Supabase getAllEnrollments error:', ticketError);
      return [];
    }

    const userIds = Array.from(new Set(tickets.map(t => t.user_id).filter(Boolean)));

    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profiles) {
        profiles.forEach(p => {
          profilesMap[p.id] = p;
        });
      }
    }

    return tickets.map(t => {
      const p = profilesMap[t.user_id] || {};
      return {
        id: t.id,
        eventId: t.event_id,
        eventTitle: t.event_title,
        eventDate: t.date,
        eventLocation: t.location,
        userId: t.user_id,
        studentName: p.name || 'Anonymous Student',
        studentEmail: p.contact_email || 'No email registered',
        pnr: p.pnr || 'Not Provided',
        classYear: (p.class_year || 'First Year') as ClassYear,
        division: p.division || 'Unassigned',
        branch: p.branch || 'Unassigned',
        phoneNumber: p.phone_number || '',
        bio: p.bio || '',
        avatarUrl: p.avatar_url && !p.avatar_url.includes('pravatar.cc') ? p.avatar_url : '',
        teamName: t.team_name,
        status: t.status as 'Confirmed' | 'Waitlisted',
        enrolledAt: t.created_at,
      };
    });
  },

  async getPlatformStats(): Promise<PlatformStats> {
    if (!isSupabaseConfigured()) {
      return {
        totalEvents: 0,
        activeEvents: 0,
        pastEvents: 0,
        totalUsers: 0,
        totalTickets: 0,
      };
    }

    const [eventsRes, profilesRes, ticketsRes] = await Promise.all([
      supabase.from('events').select('id, date, is_past'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('tickets').select('id', { count: 'exact', head: true }),
    ]);

    const eventsList = eventsRes.data || [];
    const past = eventsList.filter(e => isEventInPast({ date: e.date, isPast: e.is_past })).length;
    const active = eventsList.length - past;

    return {
      totalEvents: eventsList.length,
      activeEvents: active,
      pastEvents: past,
      totalUsers: profilesRes.count ?? profilesRes.data?.length ?? 0,
      totalTickets: ticketsRes.count ?? ticketsRes.data?.length ?? 0,
    };
  },

  async updateUserRole(userId: string, role: 'student' | 'admin'): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return false;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Supabase updateUserRole error:', error);
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      throw new Error('Role update failed. Please run the updated supabase/schema.sql in your Supabase SQL Editor to enable admin updates.');
    }

    return true;
  },

  /** Grant or revoke QR scanner access for a user (without making them admin) */
  async setScannerAccess(userId: string, grant: boolean): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { data, error } = await supabase
      .from('profiles')
      .update({ scanner_access: grant })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Supabase setScannerAccess error:', error);
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      throw new Error('Scanner access update failed. Run the latest supabase/schema.sql to add the scanner_access column.');
    }

    return true;
  },

  /** Fetch all teams across all events with their members (for admin chat viewer) */
  async getAllTeamsWithChats(): Promise<{ team: Team; members: TeamMember[] }[]> {
    if (!isSupabaseConfigured()) return [];

    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (teamsError || !teamsData) {
      console.warn('adminService.getAllTeamsWithChats teams error:', teamsError);
      return [];
    }

    const { data: membersData } = await supabase
      .from('team_members')
      .select('*');

    const allMembers: any[] = membersData || [];

    return teamsData.map((t: any) => {
      const members: TeamMember[] = allMembers
        .filter((m: any) => m.team_id === t.id)
        .map((m: any) => ({
          id: m.id,
          teamId: m.team_id,
          userId: m.user_id,
          userName: m.user_name || 'Unknown',
          userEmail: m.user_email || '',
          joinedAt: m.joined_at || m.created_at || '',
        }));

      const team: Team = {
        id: t.id,
        name: t.name,
        eventId: t.event_id || '',
        createdBy: t.created_by || '',
        createdAt: t.created_at || '',
        memberIds: members.map(m => m.userId),
        memberCount: members.length,
      };

      return { team, members };
    });
  },

  /** Delete a user profile and their associated data */
  async deleteUser(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    // Delete tickets, team_members, team_join_requests, team_invitations, and profile
    await Promise.allSettled([
      supabase.from('tickets').delete().eq('user_id', userId),
      supabase.from('team_members').delete().eq('user_id', userId),
      supabase.from('team_join_requests').delete().eq('user_id', userId),
      supabase.from('team_invitations').delete().or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`),
      supabase.from('user_sessions').delete().eq('user_id', userId),
    ]);

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('adminService.deleteUser error:', error);
      throw new Error(error.message);
    }

    return true;
  },

  /** Delete a team and clean up team members and requests */
  async deleteTeam(teamId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    await Promise.allSettled([
      supabase.from('team_members').delete().eq('team_id', teamId),
      supabase.from('team_join_requests').delete().eq('team_id', teamId),
      supabase.from('team_invitations').delete().eq('team_id', teamId),
      supabase.from('team_messages').delete().eq('team_id', teamId),
      supabase.from('tickets').update({ team_id: null, team_name: null }).eq('team_id', teamId),
    ]);

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      console.error('adminService.deleteTeam error:', error);
      throw new Error(error.message);
    }

    return true;
  }
};

