import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AppNotification } from '../mocks/types';

const STORAGE_PREFIX = 'tiredboss_notifications_';
const STORAGE_DELETED_PREFIX = 'tiredboss_deleted_notifications_';
const STORAGE_READ_PREFIX = 'tiredboss_read_notifications_';

const getDeletedNotificationIds = (userId: string): Set<string> => {
  if (typeof window === 'undefined' || !userId) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_PREFIX + userId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const addDeletedNotificationId = (userId: string, notifId: string): void => {
  if (typeof window === 'undefined' || !userId || !notifId) return;
  try {
    const set = getDeletedNotificationIds(userId);
    set.add(notifId);
    localStorage.setItem(STORAGE_DELETED_PREFIX + userId, JSON.stringify(Array.from(set)));
  } catch {}
};

const getReadNotificationIds = (userId: string): Set<string> => {
  if (typeof window === 'undefined' || !userId) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_READ_PREFIX + userId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const addReadNotificationId = (userId: string, notifId: string): void => {
  if (typeof window === 'undefined' || !userId || !notifId) return;
  try {
    const set = getReadNotificationIds(userId);
    set.add(notifId);
    localStorage.setItem(STORAGE_READ_PREFIX + userId, JSON.stringify(Array.from(set)));
  } catch {}
};

const getLocalStorageNotifications = (userId: string): AppNotification[] => {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to parse notifications from localStorage:', e);
    return [];
  }
};

const setLocalStorageNotifications = (userId: string, notifs: AppNotification[]): void => {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(notifs));
    window.dispatchEvent(new CustomEvent('app_notifications_updated', { detail: { userId } }));
  } catch (e) {
    console.warn('Failed to save notifications to localStorage:', e);
  }
};

export const notificationService = {
  /** Fetch all notifications for a user (sorted newest first) */
  async getNotifications(userId: string): Promise<AppNotification[]> {
    if (!userId) return [];

    const deletedIds = getDeletedNotificationIds(userId);
    const readIds = getReadNotificationIds(userId);

    let remoteNotifs: AppNotification[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          remoteNotifs = data.map((n: any) => ({
            id: n.id,
            userId: n.user_id,
            teamId: n.team_id || undefined,
            teamName: n.team_name || undefined,
            eventId: n.event_id || undefined,
            eventTitle: n.event_title || undefined,
            type: n.type || 'info',
            title: n.title,
            message: n.message,
            read: !!n.read || readIds.has(n.id),
            createdAt: n.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase getNotifications error:', err);
      }
    }

    const localNotifs = getLocalStorageNotifications(userId);

    // Merge remote and local by id, filtering out deleted ones
    const map = new Map<string, AppNotification>();
    localNotifs.forEach(n => {
      if (!deletedIds.has(n.id)) {
        map.set(n.id, { ...n, read: n.read || readIds.has(n.id) });
      }
    });
    remoteNotifs.forEach(n => {
      if (!deletedIds.has(n.id)) {
        const isRead = n.read || readIds.has(n.id);
        map.set(n.id, { ...n, read: isRead });
      }
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Sync back to local storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(merged));
      } catch {}
    }

    return merged;
  },

  /** Get unread notification count for a user */
  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) return 0;
    const notifs = await this.getNotifications(userId);
    return notifs.filter(n => !n.read).length;
  },

  /** Create and dispatch a new notification to a specific user */
  async createNotification(
    data: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
  ): Promise<AppNotification> {
    const newNotif: AppNotification = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: data.userId,
      teamId: data.teamId,
      teamName: data.teamName,
      eventId: data.eventId,
      eventTitle: data.eventTitle,
      type: data.type || 'info',
      title: data.title,
      message: data.message,
      read: false,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const { data: created, error } = await supabase
          .from('notifications')
          .insert({
            id: newNotif.id,
            user_id: newNotif.userId,
            team_id: newNotif.teamId || null,
            team_name: newNotif.teamName || '',
            event_id: newNotif.eventId || null,
            event_title: newNotif.eventTitle || '',
            type: newNotif.type,
            title: newNotif.title,
            message: newNotif.message,
            read: false,
          })
          .select()
          .single();

        if (!error && created) {
          newNotif.createdAt = created.created_at || newNotif.createdAt;
        }
      } catch (err) {
        console.warn('Supabase createNotification failed, using localStorage fallback:', err);
      }
    }

    // Always update localStorage
    const current = getLocalStorageNotifications(data.userId);
    const updated = [newNotif, ...current.filter(n => n.id !== newNotif.id)];
    setLocalStorageNotifications(data.userId, updated);

    return newNotif;
  },

  /** Mark a notification as read */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    if (!notificationId || !userId) return;

    addReadNotificationId(userId, notificationId);

    // Update local storage immediately
    const current = getLocalStorageNotifications(userId);
    const updated = current.map(n => n.id === notificationId ? { ...n, read: true } : n);
    setLocalStorageNotifications(userId, updated);

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId)
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase markAsRead error:', err);
      }
    }
  },

  /** Mark all notifications as read for a user */
  async markAllAsRead(userId: string): Promise<void> {
    if (!userId) return;

    const notifs = await this.getNotifications(userId);
    notifs.forEach(n => addReadNotificationId(userId, n.id));

    const current = getLocalStorageNotifications(userId);
    const updated = current.map(n => ({ ...n, read: true }));
    setLocalStorageNotifications(userId, updated);

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase markAllAsRead error:', err);
      }
    }
  },

  /** Delete a notification */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    if (!notificationId || !userId) return;

    addDeletedNotificationId(userId, notificationId);

    const current = getLocalStorageNotifications(userId);
    const updated = current.filter(n => n.id !== notificationId);
    setLocalStorageNotifications(userId, updated);

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId)
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase deleteNotification error:', err);
      }
    }
  },

  /** Clear and delete all profile incomplete alert notifications when profile is completed */
  async clearProfileAlerts(userId: string): Promise<void> {
    if (!userId) return;

    const notifs = await this.getNotifications(userId);
    const alerts = notifs.filter(
      n => n.type === 'profile_alert' || (n.title && n.title.toLowerCase().includes('profile'))
    );

    for (const a of alerts) {
      addDeletedNotificationId(userId, a.id);
    }

    const current = getLocalStorageNotifications(userId);
    const updated = current.filter(
      n => n.type !== 'profile_alert' && !(n.title && n.title.toLowerCase().includes('profile'))
    );
    setLocalStorageNotifications(userId, updated);

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', userId)
          .eq('type', 'profile_alert');
      } catch (err) {
        console.warn('Supabase clearProfileAlerts error:', err);
      }
    }
  },

  /** Subscribe to real-time notifications for a user */
  subscribeToNotifications(
    userId: string,
    onNewNotification: (notif: AppNotification) => void
  ) {
    if (!userId) return () => {};

    // Listen to local storage event
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.userId === userId) {
        const notifs = getLocalStorageNotifications(userId);
        if (notifs.length > 0) {
          onNewNotification(notifs[0]);
        }
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('app_notifications_updated', handleCustomEvent);
    }

    if (!isSupabaseConfigured()) {
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('app_notifications_updated', handleCustomEvent);
        }
      };
    }

    try {
      const channel = supabase
        .channel(`user_notifications_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const n = payload.new;
            if (n) {
              const mapped: AppNotification = {
                id: n.id,
                userId: n.user_id,
                teamId: n.team_id || undefined,
                teamName: n.team_name || undefined,
                eventId: n.event_id || undefined,
                eventTitle: n.event_title || undefined,
                type: n.type || 'info',
                title: n.title,
                message: n.message,
                read: !!n.read,
                createdAt: n.created_at,
              };

              // Update localStorage
              const current = getLocalStorageNotifications(userId);
              if (!current.some(c => c.id === mapped.id)) {
                setLocalStorageNotifications(userId, [mapped, ...current]);
              }

              onNewNotification(mapped);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        if (typeof window !== 'undefined') {
          window.removeEventListener('app_notifications_updated', handleCustomEvent);
        }
      };
    } catch (err) {
      console.warn('Realtime notifications subscription error:', err);
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('app_notifications_updated', handleCustomEvent);
        }
      };
    }
  },
};
