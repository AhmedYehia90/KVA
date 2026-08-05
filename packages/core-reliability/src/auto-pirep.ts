export function suggestedBlockMinutes(
  startedAt?: string | null,
  completedAt?: string | null,
  scheduledMinutes?: number | null,
): number {
  if (startedAt && completedAt) {
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.max(1, Math.round((end - start) / 60000));
    }
  }
  return Math.max(1, Math.round(scheduledMinutes ?? 1));
}
