const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatIndiaDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatIndiaDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatIndiaTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    timeStyle: "short",
  }).format(new Date(value));
}
