import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, UserTicket, UserProfile } from '../mocks/types';
import { authService } from '../services/authService';
import { eventService } from '../services/eventService';
import { profileService, checkProfileCompletion } from '../services/profileService';
import { notificationService } from '../services/notificationService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const isOriginalAdminEmail = (email?: string): boolean => {
  if (!email) return false;
  return email.toLowerCase().trim() === 'nikhildeosani@gmail.com';
};

interface AppContextType {
  user: User | null;
  profile: UserProfile | null;
  isProfileComplete: boolean;
  missingProfileFields: string[];
  tickets: UserTicket[];
  loading: boolean;
  hasScannerAccess: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  refreshTickets: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(true);
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>([]);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const checkAndAlertIncompleteProfile = async (currentUser: User, userProfile: UserProfile | null) => {
    if (!currentUser || currentUser.role === 'admin') return;
    const { isComplete, missingFields } = checkProfileCompletion(userProfile);
    if (!isComplete && missingFields.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const key = `tiredboss_profile_alert_sent_${currentUser.id}`;
      const lastSent = localStorage.getItem(key);
      if (lastSent !== today) {
        try {
          await notificationService.createNotification({
            userId: currentUser.id,
            type: 'profile_alert',
            title: '⚠️ Action Required: Complete Your Student Profile',
            message: `Your student profile is incomplete (missing: ${missingFields.join(', ')}). Please complete your profile in Settings so you can enroll in events and join teams.`,
          });
          localStorage.setItem(key, today);
        } catch (err) {
          console.warn('Failed to dispatch automated profile alert:', err);
        }
      }
    }
  };

  const fetchProfileData = useCallback(async (userId: string, currentUser?: User) => {
    try {
      const p = await profileService.getProfile(userId);
      setProfile(p);
      const { isComplete, missingFields } = checkProfileCompletion(p);
      setIsProfileComplete(isComplete);
      setMissingProfileFields(missingFields);
      if (isComplete) {
        await notificationService.clearProfileAlerts(userId);
      } else if (currentUser) {
        checkAndAlertIncompleteProfile(currentUser, p);
      }
      return p;
    } catch {
      return null;
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const [userTickets] = await Promise.all([
          eventService.getUserTickets(currentUser.id),
          fetchProfileData(currentUser.id, currentUser),
        ]);
        setTickets(userTickets);
      } else {
        setProfile(null);
        setIsProfileComplete(true);
        setMissingProfileFields([]);
      }
    } catch (err) {
      console.error('Error fetching user state', err);
    } finally {
      setLoading(false);
    }
  }, [fetchProfileData]);

  useEffect(() => {
    fetchInitialData();

    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const currentUser = await authService.getCurrentUser();
            setUser(currentUser);
            if (currentUser) {
              const userTickets = await eventService.getUserTickets(currentUser.id);
              setTickets(userTickets);
              fetchProfileData(currentUser.id, currentUser);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsProfileComplete(true);
          setMissingProfileFields([]);
          setTickets([]);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [fetchInitialData, fetchProfileData]);

  // Real-time listener for profile changes (e.g. role or scanner_access updates)
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`user-profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.new) {
            await fetchProfileData(user.id, user);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchProfileData, user]);

  const login = (newUser: User) => {
    setUser(newUser);
    eventService.getUserTickets(newUser.id).then(setTickets);
    fetchProfileData(newUser.id, newUser);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setProfile(null);
    setIsProfileComplete(true);
    setMissingProfileFields([]);
    setTickets([]);
  };

  const refreshTickets = async () => {
    if (user) {
      const userTickets = await eventService.getUserTickets(user.id);
      setTickets(userTickets);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      return await fetchProfileData(user.id, user);
    }
    return null;
  };

  const hasScannerAccess = Boolean(
    profile?.scannerAccess ||
    user?.scannerAccess ||
    user?.role === 'admin' ||
    isOriginalAdminEmail(user?.email)
  );

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        isProfileComplete,
        missingProfileFields,
        tickets,
        loading,
        hasScannerAccess,
        login,
        logout,
        refreshTickets,
        refreshProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
