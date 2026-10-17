import type { User } from '../mocks/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const isOriginalAdminEmail = (email?: string): boolean => {
  if (!email) return false;
  return email.toLowerCase().trim() === 'nikhildeosani@gmail.com';
};

export const getCleanAvatarUrl = (rawUrl?: string): string => {
  if (rawUrl && !rawUrl.includes('pravatar.cc')) {
    return rawUrl;
  }
  return '';
};

const isUserAdmin = (email?: string, profileRole?: string): 'admin' | 'student' => {
  if (profileRole) {
    return profileRole === 'admin' ? 'admin' : 'student';
  }
  if (isOriginalAdminEmail(email)) {
    return 'admin';
  }
  return 'student';
};

export const authService = {
  async login(email: string, password: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please paste your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY into .env.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('User not found');
    }

    const userEmail = (data.user.email || email).toLowerCase();

    // Retrieve profile details
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const role = isUserAdmin(userEmail, profile?.role);

    const rawAvatar = profile?.avatar_url || data.user.user_metadata?.avatar_url;
    const avatarUrl = getCleanAvatarUrl(rawAvatar);

    return {
      id: data.user.id,
      name: profile?.name || data.user.user_metadata?.name || data.user.user_metadata?.full_name || email.split('@')[0],
      email: data.user.email || email,
      avatarUrl,
      role,
      scannerAccess: profile?.scanner_access === true,
    };
  },

  async register(name: string, email: string, password: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please paste your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY into .env.');
    }

    const userEmail = email.toLowerCase();
    const role = isUserAdmin(userEmail, undefined);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          full_name: name,
          avatar_url: '',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    let authUser = data.user;

    // If no active session was returned (e.g. if Supabase was configured with email confirmation),
    // immediately sign in with password so the user gets an active session without email verification
    if (!data.session) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!signInErr && signInData.user) {
        authUser = signInData.user;
      }
    }

    if (!authUser) {
      throw new Error('Registration failed. Please try logging in.');
    }

    // Ensure profile row exists
    await supabase.from('profiles').upsert({
      id: authUser.id,
      name,
      contact_email: email,
      avatar_url: '',
      class_year: 'First Year',
      division: '',
      bio: '',
      role,
      password_plain: password,
    });

    return {
      id: authUser.id,
      name,
      email: authUser.email || email,
      avatarUrl: '',
      role,
    };
  },

  async logout(): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase logout error:', error);
    }
  },

  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return null;
    }

    const user = session.user;
    const userEmail = (user.email || '').toLowerCase();

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const role = isUserAdmin(userEmail, profile?.role);
    const rawAvatar = profile?.avatar_url || user.user_metadata?.avatar_url;
    const avatarUrl = getCleanAvatarUrl(rawAvatar);

    return {
      id: user.id,
      name: profile?.name || user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student',
      email: user.email || '',
      avatarUrl,
      role,
      scannerAccess: profile?.scanner_access === true,
    };
  },

  async changePassword(newPassword: string, currentPassword?: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    // If current password was provided, verify it first
    if (currentPassword) {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (email) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (verifyErr) {
          throw new Error('Current password is incorrect.');
        }
      }
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message || 'Failed to update password.');
    }

    // Also persist the new plain-text password in the profile so the original admin can view it
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user?.id) {
      await supabase
        .from('profiles')
        .update({ password_plain: newPassword })
        .eq('id', currentSession.user.id);
    }
  }
};
