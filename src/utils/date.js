// Date helpers — the single source of truth for date handling in the app.
//
// There are two distinct jobs here, and they must not be confused:
//
//   1. KEY arithmetic  → "YYYY-MM-DD" strings used as the primary key for a day
//      (the `logs.date` column, the ‹/› navigation, the next-day analytics).
//      These MUST be built from LOCAL date parts (getFullYear/getMonth/getDate),
//      NEVER via toISOString(). toISOString() converts to UTC, and in a positive
//      offset timezone (CEST = UTC+2) that rolls the date back a day — it made
//      "+1 day" cancel out (forward nav did nothing), "-1 day" jump two days back,
//      and would skew the next-day analytics. (See CLAUDE.md gotcha #14.)
//
//   2. DISPLAY formatting → human-readable labels. toLocaleDateString('en-GB', …)
//      is fine here; it only reads the date for display, it doesn't feed arithmetic.
//
// Everything that used to define its own copy of these now imports from here, so
// the local-parts rule lives in exactly one place and can't drift back to UTC.

// A Date built from a "YYYY-MM-DD" key at local midnight. Used by the formatters
// below so display always reflects the local calendar day, not a UTC instant.
function atLocalMidnight(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

// ─── Key arithmetic (local parts only) ─────────────────────────────────────────

// Date object → "YYYY-MM-DD" key, from local parts.
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Today's key.
export function todayStr() {
  return toDateStr(new Date());
}

// Shift a key by n calendar days (n may be negative). Goes through a local Date
// so month/year boundaries and DST are handled correctly.
export function addDays(dateStr, n) {
  const d = atLocalMidnight(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// The next calendar day — used by the next-day pain analytics.
export function nextDateStr(dateStr) {
  return addDays(dateStr, 1);
}

// ─── Display formatting ─────────────────────────────────────────────────────────

// "Monday, 5 June 2026"
export function formatFullDate(dateStr) {
  return atLocalMidnight(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// "Monday, 5 June"
export function formatWeekdayDate(dateStr) {
  return atLocalMidnight(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// "5 Jun"
export function formatDayMonth(dateStr) {
  return atLocalMidnight(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

// "5/6" — compact day/month for chart x-axis ticks where space is tight. Built
// straight from the key parts (no leading zeros), so 2026-06-05 → "5/6".
export function formatDayMonthSlash(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d}/${m}`;
}

// "Monday"
export function formatWeekday(dateStr) {
  return atLocalMidnight(dateStr).toLocaleDateString('en-GB', { weekday: 'long' });
}
