import type { UserProfile } from '../mocks/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const REQUIRED_PROFILE_FIELDS: { key: keyof UserProfile; label: string }[] = [
  { key: 'phoneNumber', label: 'Phone Number' },
  { key: 'pnr', label: 'PRN Number' },
  { key: 'branch', label: 'Branch' },
  { key: 'division', label: 'Division' },
];

export function checkProfileCompletion(profile: UserProfile | null): {
  isComplete: boolean;
  missingFields: string[];
  completedCount: number;
  totalCount: number;
} {
  if (!profile) {
    return {
      isComplete: false,
      missingFields: REQUIRED_PROFILE_FIELDS.map(f => f.label),
      completedCount: 0,
      totalCount: REQUIRED_PROFILE_FIELDS.length,
    };
  }

  const missing: string[] = [];
  let completed = 0;

  for (const f of REQUIRED_PROFILE_FIELDS) {
    const val = profile[f.key];
    const str = val !== undefined && val !== null ? String(val).trim() : '';

    let isMissing = false;
    if (!str) {
      isMissing = true;
    } else if (f.key === 'pnr' && (str.toUpperCase() === 'NOT SET' || str.toUpperCase() === 'NOT PROVIDED' || str.toUpperCase() === 'N/A')) {
      isMissing = true;
    } else if (f.key === 'branch' && (str.toLowerCase().includes('unassigned') || str.toLowerCase().includes('select branch') || str.toUpperCase() === 'NOT SET')) {
      isMissing = true;
    } else if (f.key === 'phoneNumber') {
      const digits = str.replace(/\D/g, '');
      if (digits.length < 10 || str.toUpperCase() === 'N/A' || str.toUpperCase() === 'NOT SET') {
        isMissing = true;
      }
    } else if (f.key === 'division' && (str.toUpperCase() === 'NOT SET' || str.toUpperCase() === 'N/A')) {
      isMissing = true;
    }

    if (isMissing) {
      missing.push(f.label);
    } else {
      completed++;
    }
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
    completedCount: completed,
    totalCount: REQUIRED_PROFILE_FIELDS.length,
  };
}

const mapDbProfile = (row: any): UserProfile => {
  const rawAvatar = row.avatar_url || row.avatarUrl || '';
  const cleanAvatar = rawAvatar && !rawAvatar.includes('pravatar.cc')
    ? rawAvatar
    : '';

  return {
    userId: row.id,
    name: row.name || '',
    pnr: row.pnr || '',
    classYear: row.class_year || row.classYear || 'First Year',
    division: row.division || '',
    branch: row.branch || '',
    contactEmail: row.contact_email || row.contactEmail || '',
    phoneNumber: row.phone_number || row.phoneNumber || '',
    bio: row.bio || '',
    avatarUrl: cleanAvatar,
    avatarLocalUrl: row.avatarLocalUrl,
    role: row.role || 'student',
    scannerAccess: row.scanner_access === true,
    createdAt: row.created_at,
  };
};

export const profileService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured() || !userId) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return mapDbProfile(data);
  },

  async updateProfile(userId: string, updates: Partial<Omit<UserProfile, 'userId'>>): Promise<UserProfile> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please configure .env to save profile updates.');
    }

    const dbPayload: Record<string, any> = {
      id: userId,
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.pnr !== undefined) dbPayload.pnr = updates.pnr;
    if (updates.classYear !== undefined) dbPayload.class_year = updates.classYear;
    if (updates.division !== undefined) dbPayload.division = updates.division;
    if (updates.branch !== undefined) dbPayload.branch = updates.branch;
    if (updates.contactEmail !== undefined) dbPayload.contact_email = updates.contactEmail;
    if (updates.phoneNumber !== undefined) dbPayload.phone_number = updates.phoneNumber;
    if (updates.bio !== undefined) dbPayload.bio = updates.bio;
    if (updates.avatarUrl !== undefined) dbPayload.avatar_url = updates.avatarUrl;
    if (updates.role !== undefined) dbPayload.role = updates.role;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(dbPayload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbProfile(data);
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    if (!isSupabaseConfigured()) {
      return URL.createObjectURL(file);
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.warn('Avatar upload to Supabase storage failed, using local URL:', uploadError);
      return URL.createObjectURL(file);
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  }
};
