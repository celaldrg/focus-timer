/**
 * Turns the app view into what the screen says: i18n keys for the button and the status line, the cycle
 * dots, the page title and the end-of-session message. Pure module, so node:test can check it.
 */
import { formatClock } from './timer.js';

/** @typedef {import('./app.js').View} View */
/** @typedef {import('./app.js').SessionEnd} SessionEnd */
/** @typedef {import('./i18n.js').Translate} Translate */
/** @typedef {import('./settings.js').Mode} Mode */
/** @typedef {'done' | 'current' | 'todo'} CycleDot */

/** i18n key of each mode's name. */
export const MODE_KEYS = Object.freeze({ focus: 'modeFocus', short: 'modeShort', long: 'modeLong' });

const STATUS_KEYS = { idle: 'statusReady', paused: 'statusPaused', finished: 'statusFinished' };
const PRIMARY_KEYS = { idle: 'start', running: 'pause', paused: 'resume' };
const NEXT_BODY_KEYS = { focus: 'nextFocusBody', short: 'nextShortBody', long: 'nextLongBody' };

/**
 * i18n key of the Start/Pause button. After a finished session it names what starts next.
 * @param {View} view
 * @returns {string}
 */
export function primaryActionKey(view) {
  if (view.status !== 'finished') return PRIMARY_KEYS[view.status];
  return view.nextMode === 'focus' ? 'startFocus' : 'startBreak';
}

/**
 * i18n key of the short status line in the ring: the mode while running, otherwise the state.
 * @param {View} view
 * @returns {string}
 */
export function statusKey(view) {
  return view.status === 'running' ? MODE_KEYS[view.mode] : STATUS_KEYS[view.status];
}

/**
 * One dot per focus session of the cycle (the sessions before a long break): 'done', 'current' for the
 * focus session that is under way, or 'todo'.
 * @param {View} view
 * @returns {CycleDot[]}
 */
export function cycleDots(view) {
  const total = view.settings.longBreakInterval;
  const done = Math.min(view.cycle, total);
  const inFocus = view.mode === 'focus' && view.status !== 'finished';
  return Array.from({ length: total }, (_, index) => {
    if (index < done) return 'done';
    return inFocus && index === done ? 'current' : 'todo';
  });
}

/**
 * The browser tab title: remaining time, status and app name, e.g. "09:59 · Focus – Focus Timer".
 * @param {View} view
 * @param {Translate} t
 * @returns {string}
 */
export function pageTitle(view, t) {
  return t('pageTitle', { time: formatClock(view.remainingMs), status: t(statusKey(view)), app: t('appTitle') });
}

/**
 * Title and body of the chime notification for a session that has just ended.
 * @param {SessionEnd} ended
 * @param {Translate} t
 * @returns {{ title: string, body: string }}
 */
export function endMessage(ended, t) {
  return {
    title: t(ended.mode === 'focus' ? 'endFocusTitle' : 'endBreakTitle'),
    body: t(NEXT_BODY_KEYS[ended.nextMode]),
  };
}

/**
 * The question a mode tab asks before it throws away the session in progress (see `selectModeDiscards`).
 * @param {View} view  the session in progress
 * @param {Mode} mode  the mode that was chosen
 * @param {Translate} t
 * @returns {{ title: string, body: string, confirm: string }}
 */
export function switchModeQuestion(view, mode, t) {
  return {
    title: t('switchTitle', { mode: t(MODE_KEYS[mode]) }),
    body: t(view.mode === 'focus' ? 'switchFocusBody' : 'switchBreakBody'),
    confirm: t('switchConfirm'),
  };
}

/**
 * The task that completed focus sessions are credited to, or null.
 * @param {View} view
 * @returns {import('./tasks.js').Task | null}
 */
export function activeTask(view) {
  return view.tasks.find((task) => task.id === view.activeTaskId) ?? null;
}
