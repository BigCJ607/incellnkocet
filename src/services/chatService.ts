import type { Message } from '../mocks/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const mapDbMessage = (row: any): Message => ({
  id: row.id,
  teamId: row.team_id || row.teamId,
  userId: row.user_id || row.userId,
  content: row.content,
  timestamp: row.timestamp || row.created_at,
});

export const chatService = {
  async getMessages(teamId: string): Promise<Message[]> {
    if (!isSupabaseConfigured() || !teamId) {
      return [];
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('team_id', teamId)
      .order('timestamp', { ascending: true });

    if (error || !data) {
      console.warn('Supabase getMessages error:', error);
      return [];
    }

    return data.map(mapDbMessage);
  },

  async sendMessage(teamId: string, userId: string, content: string): Promise<Message> {
    if (!isSupabaseConfigured()) {
      throw new Error('Please configure Supabase in .env to send messages.');
    }

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      teamId,
      userId,
      content,
      timestamp: new Date().toISOString()
    };

    const { error } = await supabase.from('messages').insert({
      id: newMsg.id,
      team_id: teamId,
      user_id: userId,
      content,
      timestamp: newMsg.timestamp,
    });

    if (error) {
      throw new Error(error.message);
    }

    return newMsg;
  },

  /**
   * Subscribe to new realtime messages for a specific team.
   * Returns an unsubscribe function.
   */
  subscribeToMessages(teamId: string, onNewMessage: (msg: Message) => void): () => void {
    if (!isSupabaseConfigured() || !teamId) {
      return () => {};
    }

    const channel = supabase
      .channel(`team-chat-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          onNewMessage(mapDbMessage(payload.new));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
