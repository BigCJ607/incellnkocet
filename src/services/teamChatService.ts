import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface TeamMessage {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
}

const STORAGE_KEY_PREFIX = 'tiredboss_team_chat_';

export const teamChatService = {
  /** Fetch messages for a team */
  async getMessages(teamId: string): Promise<TeamMessage[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('team_messages')
          .select('*')
          .eq('team_id', teamId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map((m: any) => ({
            id: m.id,
            teamId: m.team_id,
            userId: m.user_id,
            userName: m.user_name || 'Teammate',
            userAvatar: m.user_avatar || '',
            content: m.content,
            createdAt: m.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase getMessages error, falling back to local:', err);
      }
    }

    // Fallback: localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + teamId);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /** Send a new message to the team chat */
  async sendMessage(
    teamId: string,
    userId: string,
    userName: string,
    content: string,
    userAvatar?: string
  ): Promise<TeamMessage> {
    const newMessage: TeamMessage = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      teamId,
      userId,
      userName,
      userAvatar: userAvatar || '',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('team_messages')
          .insert({
            id: newMessage.id,
            team_id: teamId,
            user_id: userId,
            user_name: userName,
            user_avatar: userAvatar || '',
            content: content.trim(),
          })
          .select()
          .single();

        if (!error && data) {
          newMessage.createdAt = data.created_at || newMessage.createdAt;
        }
      } catch (err) {
        console.warn('Supabase sendMessage failed, using local storage fallback:', err);
      }
    }

    // Always update local storage for smooth offline/instant UI experience
    try {
      const current = await this.getMessages(teamId);
      if (!current.some(m => m.id === newMessage.id)) {
        const updated = [...current, newMessage];
        localStorage.setItem(STORAGE_KEY_PREFIX + teamId, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('LocalStorage save message failed:', e);
    }

    return newMessage;
  },

  /** Delete (unsend) a message — only the sender can do this */
  async deleteMessage(messageId: string, teamId: string): Promise<boolean> {
    // Remove from localStorage immediately
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + teamId);
      if (raw) {
        const msgs: TeamMessage[] = JSON.parse(raw);
        const updated = msgs.filter(m => m.id !== messageId);
        localStorage.setItem(STORAGE_KEY_PREFIX + teamId, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('LocalStorage deleteMessage failed:', e);
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('team_messages')
          .delete()
          .eq('id', messageId);

        if (error) {
          console.warn('Supabase deleteMessage error:', error);
          return false;
        }
      } catch (err) {
        console.warn('Supabase deleteMessage exception:', err);
        return false;
      }
    }

    return true;
  },

  /** Subscribe to real-time messages for a team (INSERT + DELETE) */
  subscribeToMessages(
    teamId: string,
    onNewMessage: (msg: TeamMessage) => void,
    onDeleteMessage?: (messageId: string) => void
  ) {
    if (!isSupabaseConfigured()) return () => {};

    try {
      const channel = supabase
        .channel(`team_chat_${teamId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'team_messages',
            filter: `team_id=eq.${teamId}`,
          },
          (payload) => {
            const m = payload.new;
            if (m) {
              onNewMessage({
                id: m.id,
                teamId: m.team_id,
                userId: m.user_id,
                userName: m.user_name || 'Teammate',
                userAvatar: m.user_avatar || '',
                content: m.content,
                createdAt: m.created_at,
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'team_messages',
            filter: `team_id=eq.${teamId}`,
          },
          (payload) => {
            const deletedId = payload.old?.id;
            if (deletedId && onDeleteMessage) {
              onDeleteMessage(deletedId);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime subscription error:', err);
      return () => {};
    }
  },

  /** Get unread message count for a user in a team */
  async getUnreadCount(teamId: string, userId: string): Promise<number> {
    if (!teamId || !userId) return 0;
    const key = `tiredboss_chat_last_read_${teamId}_${userId}`;
    const lastRead = localStorage.getItem(key);
    const msgs = await this.getMessages(teamId);

    if (!lastRead) {
      return msgs.filter(m => m.userId !== userId).length;
    }

    const lastReadTime = new Date(lastRead).getTime();
    return msgs.filter(m => m.userId !== userId && new Date(m.createdAt).getTime() > lastReadTime).length;
  },

  /** Mark chat as read for a user in a team */
  markAsRead(teamId: string, userId: string): void {
    if (!teamId || !userId) return;
    const key = `tiredboss_chat_last_read_${teamId}_${userId}`;
    localStorage.setItem(key, new Date().toISOString());
  },
};
