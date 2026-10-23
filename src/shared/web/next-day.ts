const dayLength = 86_400_000;

// The day after a YYYY-MM-DD day, in the browser without loading Temporal. Midnight UTC is only a carrier for the
// date, so no time zone or clock change can move it.
export function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + dayLength).toISOString().slice(0, 10);
}
