/**
 * Focus interval timer as a pure state machine: focus, short break and long break sessions with the
 * states idle, running, paused and finished.
 *
 * The state is plain JSON-safe data and every function returns a new state. Transitions take the current
 * time as an argument instead of reading a clock, so the caller injects the clock and tests can use fake
 * timestamps. Remaining time is derived from timestamps (`runningSince` and `remainingMs`), never from
 * counting ticks, so the timer cannot drift however irregularly `tick` is called.
 */
import { sessionLengthMs, startsAutomatically } from './settings.js';

/** @typedef {import('./settings.js').Settings} Settings */
/** @typedef {import('./settings.js').Mode} Mode */
/** @typedef {'idle' | 'running' | 'paused' | 'finished'} Status */
/** @typedef {[number, number]} Segment a stretch of running time [from, to) in epoch milliseconds */

/**
 * @typedef {object} TimerState
 * @property {Mode} mode                  kind of the current session
 * @property {Status} status              idle: not started; finished: ran to its end, waiting to move on
 * @property {number} durationMs          full length of the current session, fixed when the session is created
 * @property {number} remainingMs         time left at the last start, resume or pause
 * @property {number | null} runningSince when the timer last started or resumed; null unless running
 * @property {number} cycle               focus sessions completed since the last long break
 * @property {Segment[]} segments         running stretches of the current session that a pause has closed
 */

/**
 * A session that ran to its end.
 * @typedef {object} Completion
 * @property {Mode} mode
 * @property {number} endedAt      exact end time, not the (possibly later) time the tick noticed it
 * @property {Segment[]} segments  every running stretch of the session; together they last the full session
 */

/** @type {readonly Mode[]} */
export const MODES = Object.freeze(['focus', 'short', 'long']);

/** @type {readonly Status[]} */
const STATUSES = Object.freeze(['idle', 'running', 'paused', 'finished']);

/**
 * A fresh cycle: an idle focus session with no completed focus sessions behind it.
 * @param {Settings} settings
 * @returns {TimerState}
 */
export function createTimer(settings) {
  return newSession('focus', 0, settings);
}

/**
 * Time left in the current session at `now`. Never negative, and never grows if the clock goes back.
 * @param {TimerState} timer
 * @param {number} now epoch milliseconds
 * @returns {number} milliseconds
 */
export function remainingAt(timer, now) {
  if (timer.status !== 'running') return timer.remainingMs;
  const elapsed = Math.max(0, now - timer.runningSince);
  return Math.max(0, timer.remainingMs - elapsed);
}

/**
 * Share of the current session that is behind us at `now`: 0 when idle, 1 when finished.
 * @param {TimerState} timer
 * @param {number} now
 * @returns {number} from 0 to 1
 */
export function progressAt(timer, now) {
  return 1 - remainingAt(timer, now) / timer.durationMs;
}

/**
 * The mode that comes after the current session once it has run to its end.
 * During the last focus session of a cycle this is already 'long'.
 * @param {TimerState} timer
 * @param {Settings} settings
 * @returns {Mode}
 */
export function upNext(timer, settings) {
  return following(timer, settings, timer.status !== 'finished').mode;
}

/**
 * Starts the timer: an idle session starts, a paused one resumes, and after a finished session the next
 * session of the cycle starts. A running timer is returned unchanged.
 * @param {TimerState} timer
 * @param {Settings} settings
 * @param {number} now
 * @returns {TimerState}
 */
export function start(timer, settings, now) {
  if (timer.status === 'running') return timer;
  const session = timer.status === 'finished' ? following(timer, settings, false) : timer;
  return run(session, now);
}

/**
 * Pauses a running session and freezes its remaining time. Other states are returned unchanged.
 * @param {TimerState} timer
 * @param {number} now
 * @returns {TimerState}
 */
export function pause(timer, now) {
  if (timer.status !== 'running') return timer;
  return {
    ...timer,
    status: 'paused',
    remainingMs: remainingAt(timer, now),
    runningSince: null,
    segments: closeSegment(timer, now),
  };
}

/**
 * Resumes a paused session with exactly the time it had left. Other states are returned unchanged.
 * @param {TimerState} timer
 * @param {number} now
 * @returns {TimerState}
 */
export function resume(timer, now) {
  return timer.status === 'paused' ? run(timer, now) : timer;
}

/**
 * The Start/Pause button: pauses a running session, otherwise behaves like `start`.
 * @param {TimerState} timer
 * @param {Settings} settings
 * @param {number} now
 * @returns {TimerState}
 */
export function toggle(timer, settings, now) {
  return timer.status === 'running' ? pause(timer, now) : start(timer, settings, now);
}

/**
 * Leaves the current session without counting it and moves one step along the cycle. The next session
 * starts at once if auto-start is on for its mode, otherwise it waits idle.
 * @param {TimerState} timer
 * @param {Settings} settings
 * @param {number} now
 * @returns {TimerState}
 */
export function skip(timer, settings, now) {
  const next = following(timer, settings, false);
  return startsAutomatically(next.mode, settings) ? run(next, now) : next;
}

/**
 * Puts the current session back to its full length, stopped. When the timer is already idle there is
 * nothing to rewind, so it starts over with a fresh cycle instead.
 * @param {TimerState} timer
 * @param {Settings} settings
 * @returns {TimerState}
 */
export function reset(timer, settings) {
  if (timer.status === 'idle') return createTimer(settings);
  return newSession(timer.mode, timer.cycle, settings);
}

/**
 * Switches to an idle session of the chosen mode (the mode tabs). Choosing the current mode keeps the
 * session unless it has finished. Leaving a long break starts a new cycle.
 * @param {TimerState} timer
 * @param {Mode} mode
 * @param {Settings} settings
 * @returns {TimerState}
 */
export function selectMode(timer, mode, settings) {
  if (mode === timer.mode && timer.status !== 'finished') return timer;
  return newSession(mode, cycleAfterLeaving(timer), settings);
}

/**
 * Whether `selectMode` would throw away a session that has started (running or paused) without counting
 * it, so the UI can ask first. Choosing the current mode keeps the session, and an idle or finished
 * session has nothing to lose.
 * @param {{ mode: Mode, status: Status }} timer  a timer state, or the app view
 * @param {Mode} mode
 * @returns {boolean}
 */
export function selectModeDiscards(timer, mode) {
  return mode !== timer.mode && (timer.status === 'running' || timer.status === 'paused');
}

/**
 * Applies changed settings. A session that has not started takes its new length at once; a started
 * session keeps its length and the new settings apply from the next session on.
 * @param {TimerState} timer
 * @param {Settings} settings
 * @returns {TimerState}
 */
export function applySettings(timer, settings) {
  return timer.status === 'idle' ? newSession(timer.mode, timer.cycle, settings) : timer;
}

/**
 * Brings the timer up to `now`. A running session whose time is up is completed at its exact end time.
 * The next session then starts from that end time if auto-start is on for it and it would still be
 * running at `now`; otherwise the timer stays finished until started. So one tick completes at most one
 * session, even after the device slept for hours.
 * @param {TimerState} timer
 * @param {Settings} settings
 * @param {number} now
 * @returns {{ timer: TimerState, completed: Completion | null }}
 */
export function tick(timer, settings, now) {
  if (timer.status !== 'running') return { timer, completed: null };
  const endedAt = timer.runningSince + timer.remainingMs;
  if (now < endedAt) return { timer, completed: null };

  const completed = { mode: timer.mode, endedAt, segments: closeSegment(timer, endedAt) };
  const finished = {
    ...timer,
    status: 'finished',
    remainingMs: 0,
    runningSince: null,
    cycle: timer.mode === 'focus' ? timer.cycle + 1 : timer.cycle,
    segments: [],
  };
  const next = following(finished, settings, false);
  const keepGoing = startsAutomatically(next.mode, settings) && now < endedAt + next.durationMs;
  return { timer: keepGoing ? run(next, endedAt) : finished, completed };
}

/**
 * Rebuilds a timer from saved data, e.g. after a page reload. A running timer keeps running: its
 * remaining time follows from the saved timestamps. Invalid data gives a fresh timer.
 * @param {unknown} input
 * @param {Settings} settings used only for the fresh timer
 * @returns {TimerState}
 */
export function restoreTimer(input, settings) {
  if (!isTimerState(input)) return createTimer(settings);
  const { mode, status, durationMs, remainingMs, runningSince, cycle, segments } = input;
  const segmentsCopy = segments.map(([from, to]) => [from, to]);
  return { mode, status, durationMs, remainingMs, runningSince, cycle, segments: segmentsCopy };
}

/**
 * Formats a remaining time as a countdown, rounded up to whole seconds: "25:00", "04:59", "1:30:00".
 * @param {number} ms
 * @returns {string}
 */
export function formatClock(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  const clock = `${twoDigits(minutes)}:${twoDigits(seconds)}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

function newSession(mode, cycle, settings) {
  const durationMs = sessionLengthMs(mode, settings);
  return { mode, status: 'idle', durationMs, remainingMs: durationMs, runningSince: null, cycle, segments: [] };
}

function run(session, now) {
  return { ...session, status: 'running', runningSince: now };
}

/** The idle session that follows the current one; `countCurrent` counts a focus session as completed. */
function following(timer, settings, countCurrent) {
  if (timer.mode !== 'focus') return newSession('focus', cycleAfterLeaving(timer), settings);
  const focusDone = timer.cycle + (countCurrent ? 1 : 0);
  const mode = focusDone >= settings.longBreakInterval ? 'long' : 'short';
  return newSession(mode, focusDone, settings);
}

function cycleAfterLeaving(timer) {
  return timer.mode === 'long' ? 0 : timer.cycle;
}

function closeSegment(timer, to) {
  if (to <= timer.runningSince) return timer.segments;
  return [...timer.segments, [timer.runningSince, to]];
}

function isTimerState(value) {
  if (typeof value !== 'object' || value === null) return false;
  const { mode, status, durationMs, remainingMs, runningSince, cycle, segments } = value;
  const runningSinceValid = status === 'running' ? Number.isFinite(runningSince) : runningSince === null;
  return MODES.includes(mode)
    && STATUSES.includes(status)
    && Number.isFinite(durationMs) && durationMs > 0
    && Number.isFinite(remainingMs) && remainingMs >= 0 && remainingMs <= durationMs
    && runningSinceValid
    && Number.isInteger(cycle) && cycle >= 0
    && Array.isArray(segments) && segments.every(isSegment);
}

function isSegment(value) {
  return Array.isArray(value)
    && value.length === 2
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && value[0] < value[1];
}

function twoDigits(value) {
  return String(value).padStart(2, '0');
}
