/** Display formatting helpers (dates, durations). */

const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function formatDeliveryTime(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return `${hours} hours`;
}

export function formatDate(value: string | Date | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSeconds, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSeconds / 86400), "day");
  return formatDate(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toString()} MB`;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export const EXPERIENCE_LABELS = {
  entry: "Entry level",
  intermediate: "Intermediate",
  expert: "Expert",
} as const;

export const AVAILABILITY_LABELS = {
  available: "Available",
  busy: "Busy",
  unavailable: "Unavailable",
} as const;

export const URGENCY_LABELS = {
  flexible: "Flexible",
  standard: "Standard",
  urgent: "Urgent",
} as const;
