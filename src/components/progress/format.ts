export const TIME_ZONE = "Europe/Madrid";

const dateTime = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const shortDay = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", day: "numeric", month: "short" });
const relative = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });

export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}

/** `YYYY-MM-DD` (día ya local) → «3 oct». */
export function formatDay(day: string): string {
  return shortDay.format(new Date(`${day}T12:00:00Z`));
}

export function formatRelative(date: Date, now = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "ahora mismo";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), "day");
  return formatDateTime(date);
}

export function formatPracticeTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export function formatSpeed(speed: number): string {
  return `${Math.round(speed * 100)} %`;
}
