// Release-date gating: whether a title or episode is out yet is
// decided from TMDB's dates alone - never by looking for a file. Dates are the
// boundary's normalized ISO YYYY-MM-DD strings (schemas.ts), so "after today"
// is a plain string comparison: no Date arithmetic, no timezone drift between
// server and client.

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Today as TMDB writes dates (UTC YYYY-MM-DD). Computed once per server
 * render and handed down (TodayProvider on the browse pages) - never called in
 * a client render path, where it could disagree with the server's HTML. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** A missing date counts as released: an old obscure title must never be
 * blocked by thin TMDB data. */
export function isReleased(date: string | null, today: string): boolean {
  return !date || date <= today;
}

/** "October 3", with the year only when it isn't this year ("October 3, 2027"). */
export function formatComingDate(date: string, today: string): string {
  const [year, month, day] = date.split("-");
  const label = `${MONTHS[Number(month) - 1]} ${Number(day)}`;
  return year === today.slice(0, 4) ? label : `${label}, ${year}`;
}

/** The formatted date for something that isn't out yet, or null when it is
 * (or undated - see isReleased). */
export function comingDate(date: string | null, today: string): string | null {
  if (date === null || isReleased(date, today)) return null;
  return formatComingDate(date, today);
}
