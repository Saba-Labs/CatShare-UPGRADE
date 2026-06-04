import { supabase } from '../supabaseClient';
import { SUPABASE_SESSION_TIMEOUT_MS } from '../config/offlineBuilder';

type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getSessionOnce(timeoutMs: number): Promise<SessionResult> {
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

/**
 * getSession() can hang when Supabase is unhealthy. Race with a timeout and retry
 * so slow mobile networks are less likely to be treated as "logged out".
 */
export async function getSessionWithTimeout(
  timeoutMs: number = SUPABASE_SESSION_TIMEOUT_MS,
  retries: number = 2
): Promise<SessionResult> {
  let last: SessionResult = { data: { session: null }, error: null };
  const attempts = Math.max(1, retries + 1);
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(250 * i);
    last = await getSessionOnce(timeoutMs);
    if (last.data.session?.user) return last;
    if (last.error) return last;
  }
  return last;
}
