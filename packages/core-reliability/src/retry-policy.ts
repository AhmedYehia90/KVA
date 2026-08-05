export function retryDelaySeconds(
  attempts: number,
  maxAttempts = 5,
): number | null {
  const safeAttempts = Math.max(1, Math.trunc(attempts));
  if (safeAttempts >= Math.max(1, Math.trunc(maxAttempts))) return null;
  return Math.min(3600, 30 * 2 ** Math.max(0, safeAttempts - 1));
}
