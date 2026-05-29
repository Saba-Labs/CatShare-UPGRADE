import { supabase } from '../supabaseClient';
import { SUPABASE_SESSION_TIMEOUT_MS } from '../config/offlineBuilder';

type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

/**
 * getSession() can hang when Supabase is unhealthy (disk IO budget, etc.).
 * Always race with a timeout so the UI can fall back to cached auth / offline mode.
 */
export async function getSessionWithTimeout(
  timeoutMs: number = SUPABASE_SESSION_TIMEOUT_MS
): Promise<SessionResult> {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<SessionResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: { session: null },
            error: null,
          } as SessionResult),
        timeoutMs
      )
    ),
  ]);
}
