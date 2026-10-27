/**
 * The whole app state as one JSON-safe snapshot (settings, timer, tasks, daily stats), plus the
 * validation that turns saved data back into a usable state.
 */
import { normalizeSettings } from './settings.js';
import { applySettings, createTimer, restoreTimer } from './timer.js';
import { createTaskList, restoreTaskList } from './tasks.js';
import { restoreStats } from './stats.js';

/** Format version of the snapshot; saves with another version are not restored. */
export const STATE_VERSION = 1;

/**
 * @typedef {object} AppState
 * @property {number} version
 * @property {import('./settings.js').Settings} settings
 * @property {import('./timer.js').TimerState} timer
 * @property {import('./tasks.js').TaskList} tasks
 * @property {import('./stats.js').Stats} stats
 */

/**
 * A first-visit state: default settings, an idle focus session, no tasks, no stats.
 * @returns {AppState}
 */
export function createAppState() {
  const settings = normalizeSettings();
  return { version: STATE_VERSION, settings, timer: createTimer(settings), tasks: createTaskList(), stats: {} };
}

/**
 * Rebuilds the state from saved data. Each part is validated on its own, so a damaged part falls back to
 * its default without losing the rest; unknown or missing data gives a first-visit state. A session that
 * has not started yet always matches the restored settings.
 * @param {unknown} input
 * @returns {AppState}
 */
export function restoreAppState(input) {
  if (typeof input !== 'object' || input === null || input.version !== STATE_VERSION) return createAppState();
  const settings = normalizeSettings(input.settings);
  return {
    version: STATE_VERSION,
    settings,
    timer: applySettings(restoreTimer(input.timer, settings), settings),
    tasks: restoreTaskList(input.tasks),
    stats: restoreStats(input.stats),
  };
}
