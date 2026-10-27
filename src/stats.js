/**
 * Daily focus statistics keyed by local calendar day ("YYYY-MM-DD").
 *
 * Running time is split at local midnight, so each day gets the focus minutes actually spent in it, and a
 * session counts on the day of its last running moment. Pure module: time always comes in as an argument.
 */

/** @typedef {import('./timer.js').Segment} Segment */

/**
 * @typedef {object} DayTotals
 * @property {number} sessions  completed focus sessions
 * @property {number} focusMs   focus time in milliseconds
 */

/** @typedef {Record<string, DayTotals>} Stats */

/**
 * @typedef {object} DayBar
 * @property {string} day       "YYYY-MM-DD"
 * @property {number} weekday   0 = Sunday … 6 = Saturday
 * @property {number} sessions
 * @property {number} minutes   focus minutes, rounded
 */

const WEEK_DAYS = 7;
const MINUTE_MS = 60_000;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Local calendar day of a timestamp.
 * @param {number} time epoch milliseconds
 * @returns {string} "YYYY-MM-DD"
 */
export function dayKey(time) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Splits the time range [from, to) at every local midnight it crosses.
 * @param {number} from
 * @param {number} to
 * @returns {{ day: string, ms: number }[]} chronological parts; empty when to <= from
 */
export function splitByDay(from, to) {
  const parts = [];
  let partStart = from;
  while (partStart < to) {
    const partEnd = Math.min(to, startOfDay(partStart, 1));
    parts.push({ day: dayKey(partStart), ms: partEnd - partStart });
    partStart = partEnd;
  }
  return parts;
}

/**
 * Adds one completed focus session. Each running stretch adds its time to the day or days it ran in;
 * the session itself counts on the day of its last running moment.
 * @param {Stats} stats
 * @param {Segment[]} segments chronological running stretches of the session
 * @returns {Stats}
 */
export function recordFocusSession(stats, segments) {
  const parts = segments.flatMap(([from, to]) => splitByDay(from, to));
  if (parts.length === 0) return stats;
  const next = { ...stats };
  for (const { day, ms } of parts) next[day] = addTotals(next[day], 0, ms);
  const lastDay = parts[parts.length - 1].day;
  next[lastDay] = addTotals(next[lastDay], 1, 0);
  return next;
}

/**
 * Totals of the `count` days that end with today, oldest first; days without data are zero.
 * @param {Stats} stats
 * @param {number} now
 * @param {number} [count=7]
 * @returns {DayBar[]}
 */
export function lastDays(stats, now, count = WEEK_DAYS) {
  return Array.from({ length: count }, (_, index) => {
    const dayStart = startOfDay(now, index - (count - 1));
    const day = dayKey(dayStart);
    const totals = stats[day] ?? { sessions: 0, focusMs: 0 };
    return {
      day,
      weekday: new Date(dayStart).getDay(),
      sessions: totals.sessions,
      minutes: Math.round(totals.focusMs / MINUTE_MS),
    };
  });
}

/**
 * Drops the days that fell out of the `count`-day window ending today.
 * @param {Stats} stats
 * @param {number} now
 * @param {number} [count=7]
 * @returns {Stats}
 */
export function pruneStats(stats, now, count = WEEK_DAYS) {
  const oldestKept = dayKey(startOfDay(now, 1 - count));
  return Object.fromEntries(Object.entries(stats).filter(([day]) => day >= oldestKept));
}

/**
 * Rebuilds statistics from saved data, keeping only well-formed days.
 * @param {unknown} input
 * @returns {Stats}
 */
export function restoreStats(input) {
  if (typeof input !== 'object' || input === null) return {};
  const stats = {};
  for (const [day, totals] of Object.entries(input)) {
    if (DAY_KEY_PATTERN.test(day) && isDayTotals(totals)) {
      stats[day] = { sessions: totals.sessions, focusMs: totals.focusMs };
    }
  }
  return stats;
}

/** Local midnight of the day `dayOffset` days away from the day of `time`, as epoch milliseconds. */
function startOfDay(time, dayOffset) {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset).getTime();
}

function addTotals(totals = { sessions: 0, focusMs: 0 }, sessions, focusMs) {
  return { sessions: totals.sessions + sessions, focusMs: totals.focusMs + focusMs };
}

function isDayTotals(value) {
  return typeof value === 'object'
    && value !== null
    && Number.isInteger(value.sessions)
    && value.sessions >= 0
    && Number.isFinite(value.focusMs)
    && value.focusMs >= 0;
}
