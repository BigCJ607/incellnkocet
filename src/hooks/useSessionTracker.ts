import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../services/analyticsService';

/**
 * Tracks user sessions for analytics with high accuracy:
 * - Starts a fresh session on load
 * - Tracks actual active time (pauses if tab is hidden or user is idle > 2 mins)
 * - Periodically flushes active duration to Supabase (every 15s)
 * - Tracks page visits on route change
 * - Flushes immediately on visibility change (tab switch / minimize) & page unload
 */
export function useSessionTracker(userId: string | null | undefined) {
  const location = useLocation();
  const sessionStartedForUser = useRef<string | null>(null);
  const sessionReady = useRef(false);
  const activeSeconds = useRef(0);
  const lastInteractionTime = useRef(Date.now());

  // Start a fresh session once per user per page load
  useEffect(() => {
    if (!userId || sessionStartedForUser.current === userId) return;
    sessionStartedForUser.current = userId;
    sessionReady.current = false;
    activeSeconds.current = 0;
    lastInteractionTime.current = Date.now();

    analyticsService.startSession(userId).then(() => {
      sessionReady.current = true;
      analyticsService.recordPageVisit(location.pathname);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Track page visits on route change
  useEffect(() => {
    if (!userId || !sessionReady.current) return;
    analyticsService.recordPageVisit(location.pathname);
  }, [location.pathname, userId]);

  // Active time ticker & user interaction listener
  useEffect(() => {
    if (!userId) return;

    const onUserAction = () => {
      lastInteractionTime.current = Date.now();
    };

    // User activity listeners
    window.addEventListener('mousemove', onUserAction, { passive: true });
    window.addEventListener('keydown', onUserAction, { passive: true });
    window.addEventListener('click', onUserAction, { passive: true });
    window.addEventListener('scroll', onUserAction, { passive: true });
    window.addEventListener('touchstart', onUserAction, { passive: true });

    let tickCount = 0;
    const ticker = setInterval(() => {
      if (!sessionReady.current) return;

      const isVisible = document.visibilityState === 'visible';
      const isRecentlyActive = Date.now() - lastInteractionTime.current < 120_000; // 2 minutes idle threshold

      if (isVisible && isRecentlyActive) {
        activeSeconds.current += 1;
        analyticsService.updateActiveSeconds(activeSeconds.current);
      }

      tickCount += 1;
      // Sync with Supabase every 15 seconds while active
      if (tickCount % 15 === 0 && isVisible && activeSeconds.current > 0) {
        analyticsService.flushSession(activeSeconds.current);
      }
    }, 1000);

    return () => {
      clearInterval(ticker);
      window.removeEventListener('mousemove', onUserAction);
      window.removeEventListener('keydown', onUserAction);
      window.removeEventListener('click', onUserAction);
      window.removeEventListener('scroll', onUserAction);
      window.removeEventListener('touchstart', onUserAction);
    };
  }, [userId]);

  // Immediate flush on visibility change and browser close
  useEffect(() => {
    if (!userId) return;

    const handleHide = () => {
      if (document.visibilityState === 'hidden' && activeSeconds.current > 0) {
        analyticsService.flushSession(activeSeconds.current);
      }
    };
    const handleUnload = () => {
      if (activeSeconds.current > 0) {
        analyticsService.flushSession(activeSeconds.current);
      }
    };

    document.addEventListener('visibilitychange', handleHide);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleHide);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [userId]);
}
