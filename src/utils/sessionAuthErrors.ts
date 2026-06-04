/** True when Supabase auth cannot be recovered without signing in again. */
export function isSupabaseAuthFatalError(error: unknown): boolean {
  if (!error) return false;
  const msg = String(
    (error as { message?: string })?.message ?? error
  ).toLowerCase();
  const code = String((error as { code?: string })?.code ?? '').toLowerCase();

  if (code === 'invalid_grant' || code === 'refresh_token_not_found') return true;

  return (
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token not found') ||
    msg.includes('refresh_token_not_found') ||
    msg.includes('invalid_grant') ||
    (msg.includes('refresh') && msg.includes('not found')) ||
    (msg.includes('jwt') && msg.includes('invalid'))
  );
}
