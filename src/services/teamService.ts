import type { Team, TeamMember, JoinRequest, TeamInvitation, PlatformUserSearchResult } from '../mocks/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { notificationService } from './notificationService';
import { teamChatService } from './teamChatService';

const mapDbTeam = (row: any, members: any[]): Team => ({
  id: row.id,
  name: row.name,
  eventId: row.event_id,
  createdBy: row.created_by,
  memberIds: members.map(m => m.user_id),
  memberCount: members.length,
  createdAt: row.created_at,
  skills: row.skills || '',
  achievements: row.achievements || '',
  openRoles: Array.isArray(row.open_roles)
    ? row.open_roles
    : (typeof row.open_roles === 'string'
        ? row.open_roles.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []),
  bannerUrl: row.banner_url || (typeof window !== 'undefined' ? localStorage.getItem(`team_banner_${row.id}`) : null) || undefined,
  logoUrl: row.logo_url || undefined,
});

const mapDbMember = (row: any, profile: any): TeamMember => ({
  id: row.id,
  teamId: row.team_id,
  userId: row.user_id,
  userName: profile?.name || 'Unknown',
  userEmail: profile?.contact_email || '',
  userPnr: profile?.pnr || '',
  userBranch: profile?.branch || '',
  userDivision: profile?.division || '',
  userYear: profile?.class_year || '',
  userPhoneNumber: profile?.phone_number || '',
  joinedAt: row.joined_at,
});

export const teamService = {
  /** Fetch all teams for a given event with member counts and populated profiles */
  async getTeamsForEvent(eventId: string): Promise<Team[]> {
    if (!isSupabaseConfigured() || !eventId) return [];

    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error || !teams || teams.length === 0) return [];

    const teamIds = teams.map(t => t.id);
    const { data: members } = await supabase
      .from('team_members')
      .select('*')
      .in('team_id', teamIds);

    const allMembers: any[] = members || [];

    return teams.map(t => {
      const teamMembers = allMembers.filter(m => m.team_id === t.id);
      return mapDbTeam(t, teamMembers);
    });
  },

  /** Get all teams a user belongs to across all events */
  async getUserTeams(userId: string): Promise<Team[]> {
    if (!isSupabaseConfigured() || !userId) return [];

    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) return [];

    const teamIds = memberships.map(m => m.team_id);
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds);

    if (!teams || teams.length === 0) return [];

    const { data: allMembers } = await supabase
      .from('team_members')
      .select('*')
      .in('team_id', teamIds);

    const membersList: any[] = allMembers || [];

    return teams.map(t => {
      const teamMembers = membersList.filter(m => m.team_id === t.id);
      return mapDbTeam(t, teamMembers);
    });
  },

  /** Get members of a specific team with profile details */
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    if (!isSupabaseConfigured() || !teamId) return [];

    const { data: members, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (error || !members || members.length === 0) return [];

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, contact_email, pnr, branch, division, class_year, phone_number')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    return members.map(m => mapDbMember(m, profileMap[m.user_id]));
  },

  /** Get the team the user is in for a specific event (if any) */
  async getUserTeamForEvent(eventId: string, userId: string): Promise<Team | null> {
    if (!isSupabaseConfigured() || !eventId || !userId) return null;

    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('event_id', eventId);

    if (!teams || teams.length === 0) return null;

    const teamIds = teams.map(t => t.id);

    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .in('team_id', teamIds)
      .maybeSingle();

    if (!membership) return null;

    const myTeam = teams.find(t => t.id === membership.team_id);
    if (!myTeam) return null;

    const { data: members } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', myTeam.id);

    return mapDbTeam(myTeam, members || []);
  },

  /** Create a new team and add the creator as captain and first member */
  async createTeam(
    eventId: string,
    teamName: string,
    userId: string,
    details?: { skills?: string; achievements?: string; openRoles?: string[]; bannerUrl?: string }
  ): Promise<Team> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    if (!teamName || !teamName.trim()) {
      throw new Error('Team name is required.');
    }

    const existing = await this.getUserTeamForEvent(eventId, userId);
    if (existing) throw new Error('You are already in a team for this event. Leave your current team first.');

    const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const trimmedName = teamName.trim();

    const insertPayload: any = {
      id: teamId,
      name: trimmedName,
      event_id: eventId,
      created_by: userId,
    };
    if (details?.skills?.trim()) insertPayload.skills = details.skills.trim();
    if (details?.achievements?.trim()) insertPayload.achievements = details.achievements.trim();
    if (details?.openRoles && details.openRoles.length > 0) insertPayload.open_roles = details.openRoles;
    if (details?.bannerUrl?.trim()) insertPayload.banner_url = details.bannerUrl.trim();

    let team: any = null;
    let teamError: any = null;

    const res1 = await supabase
      .from('teams')
      .insert(insertPayload)
      .select()
      .single();

    if (res1.error && (res1.error.message.includes('Could not find the') || res1.error.code === 'PGRST204')) {
      // Schema fallback if optional columns missing
      const res2 = await supabase
        .from('teams')
        .insert({
          id: teamId,
          name: trimmedName,
          event_id: eventId,
          created_by: userId,
        })
        .select()
        .single();
      team = res2.data;
      teamError = res2.error;
    } else {
      team = res1.data;
      teamError = res1.error;
    }

    if (teamError || !team) throw new Error(teamError?.message || 'Failed to create team.');

    // Save banner fallback in localStorage if provided
    if (details?.bannerUrl && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`team_banner_${teamId}`, details.bannerUrl);
      } catch (e) {}
    }

    // Add creator as first member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
      });

    if (memberError) throw new Error(memberError.message);

    // Update ticket team affiliation
    try {
      await supabase
        .from('tickets')
        .update({ team_id: teamId, team_name: trimmedName })
        .match({ event_id: eventId, user_id: userId });
    } catch (e) {}

    const created = mapDbTeam(team, [{ user_id: userId }]);
    if (details?.skills) created.skills = details.skills;
    if (details?.achievements) created.achievements = details.achievements;
    if (details?.openRoles) created.openRoles = details.openRoles;
    if (details?.bannerUrl) created.bannerUrl = details.bannerUrl;
    return created;
  },

  /** Update team details (name, skills, achievements, open roles, banner) by captain */
  async updateTeamDetails(
    teamId: string,
    captainUserId: string,
    updates: { name: string; skills?: string; achievements?: string; openRoles?: string[]; bannerUrl?: string }
  ): Promise<Team> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    if (!updates.name || !updates.name.trim()) {
      throw new Error('Team name cannot be empty.');
    }

    const { data: team, error: fetchErr } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (fetchErr || !team) throw new Error('Team not found.');
    if (team.created_by !== captainUserId) throw new Error('Only the team captain can edit team details.');

    const trimmedName = updates.name.trim();
    const updatePayload: Record<string, any> = {
      name: trimmedName,
    };

    if (updates.skills !== undefined) updatePayload.skills = updates.skills.trim();
    if (updates.achievements !== undefined) updatePayload.achievements = updates.achievements.trim();
    if (updates.openRoles !== undefined) updatePayload.open_roles = updates.openRoles;
    if (updates.bannerUrl !== undefined) updatePayload.banner_url = updates.bannerUrl;

    let res = await supabase
      .from('teams')
      .update(updatePayload)
      .eq('id', teamId)
      .select()
      .single();

    // Fallback if schema doesn't have optional columns
    if (res.error && (res.error.message.includes('Could not find the') || res.error.code === 'PGRST204')) {
      res = await supabase
        .from('teams')
        .update({ name: trimmedName })
        .eq('id', teamId)
        .select()
        .single();
    }

    if (res.error) throw new Error(res.error.message);

    // Also update banner in localStorage cache
    if (updates.bannerUrl !== undefined && typeof window !== 'undefined') {
      try {
        if (updates.bannerUrl) {
          localStorage.setItem(`team_banner_${teamId}`, updates.bannerUrl);
        } else {
          localStorage.removeItem(`team_banner_${teamId}`);
        }
      } catch (e) {}
    }

    // Also update tickets with new team name
    try {
      await supabase
        .from('tickets')
        .update({ team_name: trimmedName })
        .eq('team_id', teamId);
    } catch (e) {}

    const { data: members } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);

    const updatedTeam = mapDbTeam(res.data, members || []);
    if (updates.skills !== undefined) updatedTeam.skills = updates.skills.trim();
    if (updates.achievements !== undefined) updatedTeam.achievements = updates.achievements.trim();
    if (updates.openRoles !== undefined) updatedTeam.openRoles = updates.openRoles;
    if (updates.bannerUrl !== undefined) updatedTeam.bannerUrl = updates.bannerUrl;

    return updatedTeam;
  },

  /** Kick / Remove a teammate from the team (only the creator/captain) */
  async kickMember(teamId: string, captainUserId: string, memberUserId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    if (captainUserId === memberUserId) {
      throw new Error('As captain, you cannot kick yourself. Please exit or disband the team instead.');
    }

    const { data: team, error: fetchErr } = await supabase
      .from('teams')
      .select('name, created_by, event_id')
      .eq('id', teamId)
      .single();

    if (fetchErr || !team) throw new Error('Team not found.');
    if (team.created_by !== captainUserId) throw new Error('Only the team captain can remove teammates.');

    // Fetch member's name for chat announcement
    const { data: memberProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', memberUserId)
      .maybeSingle();

    const memberName = memberProfile?.name || 'A teammate';

    // Delete membership from team_members
    const { error: delError } = await supabase
      .from('team_members')
      .delete()
      .match({ team_id: teamId, user_id: memberUserId });

    if (delError) throw new Error(delError.message);

    // Update tickets to clear team affiliation
    try {
      await supabase
        .from('tickets')
        .update({ team_id: null, team_name: null })
        .match({ team_id: teamId, user_id: memberUserId });
    } catch (e) {}

    // Clean up any accepted join request record
    try {
      await supabase
        .from('team_join_requests')
        .delete()
        .match({ team_id: teamId, user_id: memberUserId });
    } catch (e) {}

    // Notify the kicked member
    try {
      await notificationService.createNotification({
        userId: memberUserId,
        teamId: teamId,
        teamName: team.name,
        eventId: team.event_id,
        type: 'member_kicked',
        title: 'Removed from Team',
        message: `You were removed from "${team.name}" by the team captain.`,
      });
    } catch (e) {
      console.warn('Failed to notify kicked member:', e);
    }

    // Broadcast system message in team chat
    try {
      await teamChatService.sendMessage(
        teamId,
        'system',
        'System',
        `🚫 ${memberName} was removed from the team by the captain.`
      );
    } catch (e) {
      console.warn('Failed to broadcast kick in team chat:', e);
    }
  },

  /** Transfer captainship to another team member */
  async transferCaptaincy(teamId: string, currentCaptainId: string, newCaptainId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { data: team, error: fetchErr } = await supabase
      .from('teams')
      .select('name, created_by, event_id')
      .eq('id', teamId)
      .single();

    if (fetchErr || !team) throw new Error('Team not found.');
    if (team.created_by !== currentCaptainId) throw new Error('Only the current team captain can transfer captaincy.');

    const { error } = await supabase
      .from('teams')
      .update({ created_by: newCaptainId })
      .eq('id', teamId);

    if (error) throw new Error(error.message);

    // Fetch names for notification
    const [{ data: oldCapProfile }, { data: newCapProfile }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', currentCaptainId).maybeSingle(),
      supabase.from('profiles').select('name').eq('id', newCaptainId).maybeSingle(),
    ]);

    const oldCapName = oldCapProfile?.name || 'Previous captain';
    const newCapName = newCapProfile?.name || 'New captain';

    // Notify new captain
    try {
      await notificationService.createNotification({
        userId: newCaptainId,
        teamId: teamId,
        teamName: team.name,
        eventId: team.event_id,
        type: 'captain_promoted',
        title: 'You are now Team Captain! 👑',
        message: `Captaincy of "${team.name}" has been transferred to you by ${oldCapName}.`,
      });
    } catch (e) {
      console.warn('Failed to notify new captain:', e);
    }

    // Post to team chat
    try {
      await teamChatService.sendMessage(
        teamId,
        'system',
        'System',
        `👑 ${oldCapName} transferred captaincy of "${team.name}" to ${newCapName}.`
      );
    } catch (e) {}
  },

  /** Join a team directly (enforces max size) */
  async joinTeam(teamId: string, userId: string, eventId: string, maxSize: number): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const existing = await this.getUserTeamForEvent(eventId, userId);
    if (existing) throw new Error('You are already in a team for this event.');

    const { count, error: countError } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= maxSize) throw new Error(`This team is full (max ${maxSize} members).`);

    const { error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
      });

    if (error) throw new Error(error.message);

    // Update ticket
    try {
      const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single();
      await supabase
        .from('tickets')
        .update({ team_id: teamId, team_name: team?.name || null })
        .match({ event_id: eventId, user_id: userId });
    } catch (e) {}
  },

  /** Universal Leave / Exit Team (Supported for both regular teammates and team captains) */
  async leaveTeam(
    teamId: string,
    userId: string,
    newCaptainId?: string
  ): Promise<{ wasCaptain: boolean; disbanded: boolean; newCaptainId?: string }> {
    if (!isSupabaseConfigured()) return { wasCaptain: false, disbanded: false };

    // 1. Fetch team details
    const { data: team, error: fetchErr } = await supabase
      .from('teams')
      .select('id, name, created_by, event_id')
      .eq('id', teamId)
      .single();

    if (fetchErr || !team) throw new Error('Team not found.');

    // 2. Fetch exiting user profile
    const { data: exitingProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .maybeSingle();

    const exitingUserName = exitingProfile?.name || 'A teammate';

    // 3. Fetch all current members
    const { data: currentMembers } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);

    const membersList = currentMembers || [];
    const isCaptain = team.created_by === userId;

    if (isCaptain) {
      const remaining = membersList.filter(m => m.user_id !== userId);

      // Case A: Captain is the only member -> Disband/delete team
      if (remaining.length === 0) {
        await this.deleteTeam(teamId, userId);
        return { wasCaptain: true, disbanded: true };
      }

      // Case B: Captain exits but other members remain -> Pass captaincy
      const successorId = newCaptainId && remaining.some(m => m.user_id === newCaptainId)
        ? newCaptainId
        : remaining[0].user_id;

      // Fetch successor name
      const { data: succProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', successorId)
        .maybeSingle();

      const successorName = succProfile?.name || 'A teammate';

      // Update captain in teams table
      const { error: capError } = await supabase
        .from('teams')
        .update({ created_by: successorId })
        .eq('id', teamId);

      if (capError) throw new Error(capError.message);

      // Remove old captain from team_members
      const { error: delError } = await supabase
        .from('team_members')
        .delete()
        .match({ team_id: teamId, user_id: userId });

      if (delError) throw new Error(delError.message);

      // Clean up join requests
      try {
        await supabase.from('team_join_requests').delete().match({ team_id: teamId, user_id: userId });
      } catch (e) {}

      // Update tickets for old captain
      try {
        await supabase
          .from('tickets')
          .update({ team_id: null, team_name: null })
          .match({ team_id: teamId, user_id: userId });
      } catch (e) {}

      // Notify the new captain
      try {
        await notificationService.createNotification({
          userId: successorId,
          teamId: team.id,
          teamName: team.name,
          eventId: team.event_id,
          type: 'captain_promoted',
          title: 'You are now Team Captain! 👑',
          message: `${exitingUserName} has exited "${team.name}" and passed captaincy to you.`,
        });
      } catch (e) {
        console.warn('Failed to notify new captain on exit:', e);
      }

      // Announce in team chat
      try {
        await teamChatService.sendMessage(
          teamId,
          'system',
          'System',
          `👑 ${exitingUserName} has exited the team. ${successorName} is now the Team Captain.`
        );
      } catch (e) {}

      return { wasCaptain: true, disbanded: false, newCaptainId: successorId };
    }

    // Regular teammate leaving
    const { error } = await supabase
      .from('team_members')
      .delete()
      .match({ team_id: teamId, user_id: userId });

    if (error) throw new Error(error.message);

    // Clean up any join requests
    try {
      await supabase.from('team_join_requests').delete().match({ team_id: teamId, user_id: userId });
    } catch (e) {}

    // Update tickets
    try {
      await supabase
        .from('tickets')
        .update({ team_id: null, team_name: null })
        .match({ team_id: teamId, user_id: userId });
    } catch (e) {}

    // NOTIFY THE TEAM CAPTAIN
    if (team.created_by) {
      try {
        await notificationService.createNotification({
          userId: team.created_by,
          teamId: team.id,
          teamName: team.name,
          eventId: team.event_id,
          type: 'member_exit',
          title: 'Teammate Exited Team 🚪',
          message: `${exitingUserName} has left your team "${team.name}". Your team now has an open spot!`,
        });
      } catch (e) {
        console.warn('Failed to notify captain of member exit:', e);
      }
    }

    // Broadcast in team chat
    try {
      await teamChatService.sendMessage(
        teamId,
        'system',
        'System',
        `🚪 ${exitingUserName} has left the team.`
      );
    } catch (e) {}

    return { wasCaptain: false, disbanded: false };
  },

  /** Delete / Kill a team entirely (only the creator/captain or admin) */
  async deleteTeam(teamId: string, userId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { data: team, error: fetchErr } = await supabase
      .from('teams')
      .select('created_by')
      .eq('id', teamId)
      .single();

    if (fetchErr || !team) throw new Error('Team not found.');

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isAdmin = profile?.role === 'admin';

    if (team.created_by !== userId && !isAdmin) {
      throw new Error('Only the team captain or an admin can delete this team.');
    }

    // Unlink tickets
    try {
      await supabase
        .from('tickets')
        .update({ team_id: null, team_name: null })
        .eq('team_id', teamId);
    } catch (e) {}

    await supabase.from('team_join_requests').delete().eq('team_id', teamId);
    await supabase.from('team_invitations').delete().eq('team_id', teamId);
    await supabase.from('team_members').delete().eq('team_id', teamId);

    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) throw new Error(error.message);
  },

  // ── JOIN REQUEST SYSTEM ───────────────────────────────────────────────────

  /** Send a join request to a team with user skills and pitch */
  async sendJoinRequest(
    teamId: string,
    userId: string,
    eventId: string,
    details?: { userSkills?: string; userPitch?: string; requestedRole?: string }
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    // Must not already be in a team for this event
    const existing = await this.getUserTeamForEvent(eventId, userId);
    if (existing) throw new Error('You are already in a team for this event.');

    // Check for any existing request
    const { data: existingReq } = await supabase
      .from('team_join_requests')
      .select('id, status')
      .match({ team_id: teamId, user_id: userId })
      .maybeSingle();

    if (existingReq?.status === 'pending') throw new Error('You already have a pending application for this team.');

    const payload: any = { status: 'pending' };
    if (details?.userSkills?.trim()) payload.user_skills = details.userSkills.trim();
    if (details?.userPitch?.trim()) payload.user_pitch = details.userPitch.trim();
    if (details?.requestedRole?.trim()) payload.requested_role = details.requestedRole.trim();

    if (existingReq) {
      let res = await supabase.from('team_join_requests').update(payload).eq('id', existingReq.id);
      if (res.error && (res.error.message.includes('Could not find the') || res.error.code === 'PGRST204')) {
        res = await supabase.from('team_join_requests').update({ status: 'pending' }).eq('id', existingReq.id);
      }
      if (res.error) throw new Error(res.error.message);
      return;
    }

    const insertPayload = { team_id: teamId, user_id: userId, ...payload };
    let { error } = await supabase.from('team_join_requests').insert(insertPayload);
    if (error && (error.message.includes('Could not find the') || error.code === 'PGRST204')) {
      const res = await supabase.from('team_join_requests').insert({ team_id: teamId, user_id: userId, status: 'pending' });
      error = res.error;
    }
    if (error) throw new Error(error.message);
  },

  /** Get all pending requests for a team (for the captain) */
  async getRequestsForTeam(teamId: string): Promise<JoinRequest[]> {
    if (!isSupabaseConfigured() || !teamId) return [];

    const { data: requests, error } = await supabase
      .from('team_join_requests')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error || !requests || requests.length === 0) return [];

    const userIds = requests.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, pnr, branch, class_year, division, phone_number')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    return requests.map(r => {
      const p = profileMap[r.user_id] || {};
      return {
        id: r.id,
        teamId: r.team_id,
        userId: r.user_id,
        status: r.status,
        createdAt: r.created_at,
        userName: p.name || 'Unknown',
        userPnr: p.pnr || '',
        userBranch: p.branch || '',
        userYear: p.class_year || '',
        userDivision: p.division || '',
        userPhoneNumber: p.phone_number || '',
        userSkills: r.user_skills || '',
        userPitch: r.user_pitch || '',
        requestedRole: r.requested_role || '',
      };
    });
  },

  /** Accept a join request: adds member to team and updates ticket */
  async acceptRequest(
    requestId: string,
    teamId: string,
    userId: string,
    maxSize: number
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    // Check team capacity
    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if ((count ?? 0) >= maxSize) throw new Error(`This team is already full (max ${maxSize} members).`);

    // Check if applicant is already in a team for this event
    const { data: teamRow } = await supabase.from('teams').select('event_id, name').eq('id', teamId).single();
    if (teamRow?.event_id) {
      const existingTeam = await this.getUserTeamForEvent(teamRow.event_id, userId);
      if (existingTeam) throw new Error('This user has already joined another team for this event.');
    }

    // Add to team_members
    const { error: joinError } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, user_id: userId });

    if (joinError) throw new Error(joinError.message);

    // Update request status to accepted
    await supabase
      .from('team_join_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    // Update ticket affiliation
    if (teamRow?.event_id) {
      try {
        await supabase
          .from('tickets')
          .update({ team_id: teamId, team_name: teamRow.name })
          .match({ event_id: teamRow.event_id, user_id: userId });
      } catch (e) {}
    }
  },

  /** Reject a join request */
  async rejectRequest(requestId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('team_join_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (error) throw new Error(error.message);
  },

  /** Cancel own pending request */
  async cancelRequest(requestId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('team_join_requests')
      .delete()
      .eq('id', requestId);

    if (error) throw new Error(error.message);
  },

  /** Get user's request status for all teams */
  async getMyRequestStatuses(userId: string): Promise<Record<string, { status: string; id: string }>> {
    if (!isSupabaseConfigured() || !userId) return {};

    const { data } = await supabase
      .from('team_join_requests')
      .select('id, team_id, status')
      .eq('user_id', userId);

    const map: Record<string, { status: string; id: string }> = {};
    (data || []).forEach(r => { map[r.team_id] = { status: r.status, id: r.id }; });
    return map;
  },

  // ── INVITATION SYSTEM ─────────────────────────────────────────────────────

  /** Send an invitation from captain to a user */
  async sendInvitation(
    teamId: string,
    inviterId: string,
    inviteeId: string,
    eventId?: string
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    // Check if invitee is already in a team for this event
    if (eventId) {
      const existing = await this.getUserTeamForEvent(eventId, inviteeId);
      if (existing) throw new Error('This user is already in a team for this event.');
    }

    // Check existing invite
    const { data: existingInvite } = await supabase
      .from('team_invitations')
      .select('id, status')
      .match({ team_id: teamId, invitee_id: inviteeId })
      .maybeSingle();

    if (existingInvite?.status === 'pending') {
      throw new Error('An invitation has already been sent to this user.');
    }

    if (existingInvite) {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'pending' })
        .eq('id', existingInvite.id);
      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await supabase
      .from('team_invitations')
      .insert({
        team_id: teamId,
        inviter_id: inviterId,
        invitee_id: inviteeId,
        event_id: eventId,
        status: 'pending',
      });

    if (error) throw new Error(error.message);
  },

  /** Fetch invitations received by a user */
  async getMyInvitations(userId: string): Promise<TeamInvitation[]> {
    if (!isSupabaseConfigured() || !userId) return [];

    const { data: invites, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !invites || invites.length === 0) return [];

    const teamIds = invites.map(i => i.team_id);
    const inviterIds = invites.map(i => i.inviter_id);
    const eventIds = invites.map(i => i.event_id).filter(Boolean);

    const [teamsRes, profilesRes, eventsRes] = await Promise.all([
      supabase.from('teams').select('id, name').in('id', teamIds),
      supabase.from('profiles').select('id, name').in('id', inviterIds),
      supabase.from('events').select('id, title').in('id', eventIds),
    ]);

    const teamMap: Record<string, string> = {};
    (teamsRes.data || []).forEach((t: any) => { teamMap[t.id] = t.name; });

    const profileMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = p.name; });

    const eventMap: Record<string, string> = {};
    (eventsRes.data || []).forEach((e: any) => { eventMap[e.id] = e.title; });

    return invites.map((inv: any) => ({
      id: inv.id,
      teamId: inv.team_id,
      teamName: teamMap[inv.team_id] || 'Unnamed Team',
      eventId: inv.event_id,
      eventTitle: eventMap[inv.event_id] || 'Event',
      inviterId: inv.inviter_id,
      inviterName: profileMap[inv.inviter_id] || 'Team Captain',
      inviteeId: inv.invitee_id,
      status: inv.status,
      createdAt: inv.created_at,
    }));
  },

  /** Respond to an invitation (Accept or Decline) */
  async respondToInvitation(
    invitationId: string,
    accept: boolean,
    userId: string,
    maxTeamSize: number = 4
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { data: invite, error: fetchErr } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (fetchErr || !invite) throw new Error('Invitation not found.');
    if (invite.invitee_id !== userId) throw new Error('Unauthorized invitation response.');

    if (accept) {
      // Check if user already in team for event
      if (invite.event_id) {
        const existing = await this.getUserTeamForEvent(invite.event_id, userId);
        if (existing) throw new Error('You are already in a team for this event.');
      }

      // Check team capacity
      const { count } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', invite.team_id);

      if ((count ?? 0) >= maxTeamSize) throw new Error(`This team is already full (max ${maxTeamSize} members).`);

      // Add to team_members
      const { error: joinError } = await supabase
        .from('team_members')
        .insert({
          team_id: invite.team_id,
          user_id: userId,
        });

      if (joinError) throw new Error(joinError.message);

      // Update ticket
      if (invite.event_id) {
        try {
          const { data: team } = await supabase.from('teams').select('name').eq('id', invite.team_id).single();
          await supabase
            .from('tickets')
            .update({ team_id: invite.team_id, team_name: team?.name || null })
            .match({ event_id: invite.event_id, user_id: userId });
        } catch (e) {}
      }

      // Update invite status
      await supabase
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);
    } else {
      // Reject invite
      await supabase
        .from('team_invitations')
        .update({ status: 'rejected' })
        .eq('id', invitationId);
    }
  },

  /** Get invitation status map for a team (for captain's invite modal) — alias */
  async getTeamInviteStatuses(teamId: string): Promise<Record<string, string>> {
    if (!isSupabaseConfigured() || !teamId) return {};
    const { data } = await supabase
      .from('team_invitations')
      .select('invitee_id, status')
      .eq('team_id', teamId);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.invitee_id] = r.status; });
    return map;
  },

  /** Get invitation status map for a team (for captain's invite modal) */
  async getTeamInvitationStatuses(teamId: string): Promise<Record<string, string>> {
    if (!isSupabaseConfigured() || !teamId) return {};

    const { data } = await supabase
      .from('team_invitations')
      .select('invitee_id, status')
      .eq('team_id', teamId);

    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.invitee_id] = r.status; });
    return map;
  },

  /** Count pending invitations for a user (for nav menu badge) */
  async getPendingInviteCount(userId: string): Promise<number> {
    if (!isSupabaseConfigured() || !userId) return 0;

    const { count } = await supabase
      .from('team_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('invitee_id', userId)
      .eq('status', 'pending');

    return count ?? 0;
  },

  /** Autocomplete search platform users by name, email, or PNR */
  async searchPlatformUsers(query: string): Promise<PlatformUserSearchResult[]> {
    if (!isSupabaseConfigured() || !query.trim()) return [];

    const q = query.trim().toLowerCase();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, contact_email, pnr, branch, class_year, division, avatar_url')
      .or(`name.ilike.%${q}%,contact_email.ilike.%${q}%,pnr.ilike.%${q}%`)
      .limit(25);

    if (error || !data) return [];

    return data.map((p: any) => ({
      id: p.id,
      name: p.name || 'Unknown',
      email: p.contact_email || '',
      pnr: p.pnr || '',
      branch: p.branch || '',
      classYear: p.class_year || '',
      division: p.division || '',
      avatarUrl: p.avatar_url || '',
    }));
  },

  // ── Backward-Compatibility Aliases (used by InvitesInbox & legacy components) ──

  /** Accept an invitation — alias */
  async acceptInvitation(
    invitationId: string,
    _teamId: string,
    userId: string,
    _eventId: string,
    maxTeamSize: number = 4
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');
    const { data: invite, error: fetchErr } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();
    if (fetchErr || !invite) throw new Error('Invitation not found.');
    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', invite.team_id);
    if ((count ?? 0) >= maxTeamSize) throw new Error(`Team is already full.`);
    const { error: joinError } = await supabase
      .from('team_members')
      .insert({ team_id: invite.team_id, user_id: userId });
    if (joinError) throw new Error(joinError.message);
    if (invite.event_id) {
      try {
        const { data: team } = await supabase.from('teams').select('name').eq('id', invite.team_id).single();
        await supabase.from('tickets').update({ team_id: invite.team_id, team_name: team?.name || null }).match({ event_id: invite.event_id, user_id: userId });
      } catch (e) {}
    }
    await supabase.from('team_invitations').update({ status: 'accepted' }).eq('id', invitationId);
  },

  /** Reject an invitation — alias */
  async rejectInvitation(invitationId: string, _userId?: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('team_invitations')
      .update({ status: 'rejected' })
      .eq('id', invitationId);
    if (error) throw new Error(error.message);
  },
};
