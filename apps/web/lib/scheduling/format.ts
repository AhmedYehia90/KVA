export function validScheduleId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function formatScheduledTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone, dateStyle: "medium", timeStyle: "short"
  }).format(new Date(value));
}
