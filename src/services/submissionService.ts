import type { Submission } from '../mocks/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (file.size > 12 * 1024 * 1024) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

const mapDbSubmission = (row: any): Submission => {
  const fileUrl = row.file_url || '';
  const repoUrl = row.repo_url || '';
  return {
    id: row.id,
    teamId: row.team_id || row.teamId,
    eventId: row.event_id || row.eventId,
    repoUrl: repoUrl || fileUrl,
    fileName: row.file_name || row.fileName,
    fileSize: row.file_size ? Number(row.file_size) : row.fileSize,
    fileUrl: fileUrl || (repoUrl && repoUrl.startsWith('http') && !row.file_name ? repoUrl : undefined),
    fileData: row.file_data || row.fileData,
    description: row.description || '',
    timestamp: row.timestamp || row.created_at,
  };
};

export const submissionService = {
  async getSubmissions(eventId: string): Promise<Submission[]> {
    // Always include local submissions (works without Supabase too)
    let localSubs: Submission[] = [];
    try {
      const key = `tiredboss_submissions_${eventId}`;
      localSubs = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) { /* ignore */ }

    if (!isSupabaseConfigured() || !eventId) {
      return localSubs;
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('event_id', eventId)
      .order('timestamp', { ascending: false });

    if (error || !data) {
      console.warn('Supabase getSubmissions error:', error);
      return localSubs;
    }

    const dbSubs = data.map(mapDbSubmission);
    // Merge: db wins over local for same teamId, but preserve local fileData/fileUrl if db is missing it
    const localMap = new Map<string, Submission>();
    localSubs.forEach(s => localMap.set(s.teamId, s));

    const mergedDbSubs = dbSubs.map(s => {
      const local = localMap.get(s.teamId);
      if (local) {
        return {
          ...s,
          repoUrl: s.repoUrl || local.repoUrl,
          fileUrl: s.fileUrl || local.fileUrl || local.fileData,
          fileData: s.fileData || local.fileData,
          fileName: s.fileName || local.fileName,
          fileSize: s.fileSize || local.fileSize,
        };
      }
      return s;
    });

    const dbTeamIds = new Set(mergedDbSubs.map(s => s.teamId));
    const onlyLocalSubs = localSubs.filter(s => !dbTeamIds.has(s.teamId));
    return [...mergedDbSubs, ...onlyLocalSubs];
  },

  /**
   * Unified submission handler — supports file upload (PPT, PDF, DOCX, XLSX, ZIP, Images, all types),
   * project URL (GitHub, Drive, Live Demo), or BOTH simultaneously.
   */
  async submitProject(
    teamId: string,
    eventId: string,
    payload: {
      file?: File | null;
      repoUrl?: string;
      description?: string;
    }
  ): Promise<Submission> {
    const { file, repoUrl = '', description = '' } = payload;
    const trimmedUrl = repoUrl.trim();
    const trimmedDesc = description.trim();

    let dataUrl = '';
    let storageFileUrl = '';
    let fileName = file?.name || undefined;
    let fileSize = file?.size || undefined;

    if (file) {
      try {
        dataUrl = await readFileAsDataUrl(file);
      } catch (e) {
        console.warn('readFileAsDataUrl error:', e);
      }
    }

    const newSubId = `sub-${Date.now()}`;
    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;

        // Upload file to Supabase storage if file is present
        if (file) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${eventId}/${teamId}/${Date.now()}_${safeName}`;
          try {
            const { error: uploadError } = await supabase.storage
              .from('submissions')
              .upload(filePath, file, { upsert: true });

            if (!uploadError) {
              const { data: pubData } = supabase.storage.from('submissions').getPublicUrl(filePath);
              storageFileUrl = pubData?.publicUrl || '';
            } else {
              console.warn('Supabase storage upload error:', uploadError);
            }
          } catch (storageErr) {
            console.warn('Supabase storage exception:', storageErr);
          }
        }

        const effectiveFileUrl = storageFileUrl || dataUrl || '';
        const effectiveRepoUrl = trimmedUrl || effectiveFileUrl || (file ? file.name : '');

        const { error: insertError } = await supabase.from('submissions').insert({
          id: newSubId,
          team_id: teamId,
          event_id: eventId,
          user_id: userId,
          repo_url: effectiveRepoUrl,
          file_name: fileName || null,
          file_size: fileSize || null,
          file_url: effectiveFileUrl || null,
          description: trimmedDesc,
          timestamp,
        });

        if (insertError) {
          console.warn('Supabase insert submission error:', insertError);
          // if it failed because column types or missing columns, throw to fallback
          throw new Error(insertError.message);
        }

        const sub: Submission = {
          id: newSubId,
          teamId,
          eventId,
          repoUrl: effectiveRepoUrl,
          fileName,
          fileSize,
          fileUrl: effectiveFileUrl || undefined,
          fileData: dataUrl || undefined,
          description: trimmedDesc,
          timestamp,
        };

        // Cache locally as well
        try {
          const key = `tiredboss_submissions_${eventId}`;
          const existing: Submission[] = JSON.parse(localStorage.getItem(key) || '[]');
          const filtered = existing.filter(s => s.teamId !== teamId);
          filtered.push(sub);
          localStorage.setItem(key, JSON.stringify(filtered));
        } catch {}

        return sub;
      } catch (err: any) {
        console.warn('Supabase submitProject failed, using local fallback:', err?.message);
      }
    }

    // Local Storage Fallback
    const effectiveFileUrl = dataUrl || '';
    const effectiveRepoUrl = trimmedUrl || effectiveFileUrl || (file ? file.name : '');

    const localSub: Submission = {
      id: `sub-local-${Date.now()}`,
      teamId,
      eventId,
      repoUrl: effectiveRepoUrl,
      fileName,
      fileSize,
      fileUrl: effectiveFileUrl || undefined,
      fileData: dataUrl || undefined,
      description: trimmedDesc,
      timestamp,
    };

    try {
      const key = `tiredboss_submissions_${eventId}`;
      const existing: Submission[] = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter(s => s.teamId !== teamId);
      filtered.push(localSub);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      console.warn('localStorage submission save error:', e);
    }

    return localSub;
  },

  /** URL/text-based submission */
  async submitCode(teamId: string, eventId: string, repoUrl: string, description: string): Promise<Submission> {
    return this.submitProject(teamId, eventId, { repoUrl, description });
  },

  /** URL submission — works with or without Supabase, falls back to localStorage */
  async submitCodeOrLocal(teamId: string, eventId: string, repoUrl: string, description: string): Promise<Submission> {
    return this.submitProject(teamId, eventId, { repoUrl, description });
  },

  /** Zip/PDF/PPT/Doc file upload submission. */
  async submitZipOrLocal(
    teamId: string,
    eventId: string,
    file: File,
    description: string,
    repoUrl?: string
  ): Promise<Submission> {
    return this.submitProject(teamId, eventId, { file, repoUrl, description });
  },

  async submitZip(
    teamId: string,
    eventId: string,
    file: File,
    description: string,
    repoUrl?: string
  ): Promise<Submission> {
    return this.submitProject(teamId, eventId, { file, repoUrl, description });
  },

  /** Delete a submission by its ID. Works for both Supabase and localStorage. */
  async deleteSubmission(submissionId: string, eventId: string): Promise<boolean> {
    // Remove from Supabase
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', submissionId);

      if (error) {
        console.warn('Supabase deleteSubmission error:', error);
        // Fall through to also clean localStorage
      }
    }

    // Always clean localStorage too (covers local fallback)
    try {
      const key = `tiredboss_submissions_${eventId}`;
      const existing: Submission[] = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter(s => s.id !== submissionId);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) { /* ignore */ }

    return true;
  }
};
