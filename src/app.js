/**
 * The app model the UI drives: one object that owns the app state, reads the time from an injected clock
 * and saves every change through an injected storage. It never touches the DOM, so the browser and the
 * tests run exactly the same code.
 */
import { normalizeSettings } from './settings.js';
import {
  applySettings, pause, progressAt, remainingAt, reset, resume, selectMode, skip, start, tick, toggle, upNext,
} from './timer.js';
import { addTask, creditActiveTask, deleteTask, editTask, selectTask, setTaskDone } from './tasks.js';
import { lastDays, pruneStats, recordFocusSession } from './stats.js';
import { restoreAppState } from './state.js';

/** Storage key under which the state is saved. */
export const STORAGE_KEY = 'focus-timer:state';

/** @typedef {import('./state.js').AppState} AppState */
/** @typedef {import('./settings.js').Mode} Mode */
/** @typedef {import('./settings.js').Settings} Settings */

/**
 * A session that ran to its end, for the chime and the notification.
 * @typedef {object} SessionEnd
 * @property {Mode} mode      the mode that ended
 * @property {Mode} nextMode  the mode that comes next (already running when auto-start is on)
 * @property {number} endedAt
 */

/**
 * Live values for rendering, computed at the current clock time.
 * @typedef {object} View
 * @property {Mode} mode
 * @property {import('./timer.js').Status} status
 * @property {number} cycle        focus sessions completed since the last long break
 * @property {number} remainingMs
 * @property {number} progress     share of the current session behind us, 0…1
 * @property {Mode} nextMode       what follows once the current session runs to its end
 * @property {Settings} settings
 * @property {import('./tasks.js').Task[]} tasks
 * @property {number | null} activeTaskId
 * @property {import('./stats.js').DayBar[]} week  the last 7 days, oldest first
 */

/**
 * @typedef {object} FocusApp
 * @property {() => AppState} getState  current state: plain data, the same shape that is saved
 * @property {() => View} getView       live values for rendering
 * @property {() => SessionEnd | null} tick  call often (every animation frame); reports a session that just ended
 * @property {() => SessionEnd | null} start
 * @property {() => SessionEnd | null} pause
 * @property {() => SessionEnd | null} resume
 * @property {() => SessionEnd | null} toggle  the Start/Pause button and the Space key
 * @property {() => SessionEnd | null} skip
 * @property {() => SessionEnd | null} reset
 * @property {(mode: Mode) => SessionEnd | null} selectMode
 * @property {(changes: Partial<Settings>) => void} updateSettings
 * @property {(title: string, estimate?: number) => void} addTask
 * @property {(id: number, changes: { title?: string, estimate?: number }) => void} editTask
 * @property {(id: number, done: boolean) => void} setTaskDone
 * @property {(id: number) => void} deleteTask
 * @property {(id: number) => void} selectTask
 */

/**
 * Creates the app model. Timer actions first bring the timer up to date, so a session whose time ran out
 * just before the action is still completed, and reported as the action's return value.
 * @param {object} [options]
 * @param {{ now(): number }} [options.clock=Date]  time source; tests pass a fake clock
 * @param {import('./storage.js').SafeStorage | null} [options.storage=null]
 *   loads the saved state and saves every change; null keeps everything in memory
 * @param {AppState} [options.initialState]  start from this state instead of the saved one (the ?demo state)
 * @returns {FocusApp}
 */
export function createFocusApp({ clock = Date, storage = null, initialState } = {}) {
  let state = initialState ?? restoreAppState(storage?.load(STORAGE_KEY, null));

  const save = () => storage?.save(STORAGE_KEY, state);

  const catchUp = (now) => {
    const { timer, completed } = tick(state.timer, state.settings, now);
    if (!completed) return null;
    state = { ...countCompletion(state, completed, now), timer };
    return describeEnd(completed, timer, state.settings);
  };

  const timerAction = (apply) => {
    const now = clock.now();
    const ended = catchUp(now);
    state = { ...state, timer: apply(state.timer, now) };
    save();
    return ended;
  };

  const change = (changes) => {
    state = { ...state, ...changes };
    save();
  };

  return {
    getState: () => state,
    getView: () => buildView(state, clock.now()),
    tick() {
      const ended = catchUp(clock.now());
      if (ended) save();
      return ended;
    },
    start: () => timerAction((timer, now) => start(timer, state.settings, now)),
    pause: () => timerAction(pause),
    resume: () => timerAction(resume),
    toggle: () => timerAction((timer, now) => toggle(timer, state.settings, now)),
    skip: () => timerAction((timer, now) => skip(timer, state.settings, now)),
    reset: () => timerAction((timer) => reset(timer, state.settings)),
    selectMode: (mode) => timerAction((timer) => selectMode(timer, mode, state.settings)),
    updateSettings(changes) {
      const settings = normalizeSettings({ ...state.settings, ...changes });
      change({ settings, timer: applySettings(state.timer, settings) });
    },
    addTask: (title, estimate) => change({ tasks: addTask(state.tasks, title, estimate) }),
    editTask: (id, changes) => change({ tasks: editTask(state.tasks, id, changes) }),
    setTaskDone: (id, done) => change({ tasks: setTaskDone(state.tasks, id, done) }),
    deleteTask: (id) => change({ tasks: deleteTask(state.tasks, id) }),
    selectTask: (id) => change({ tasks: selectTask(state.tasks, id) }),
  };
}

/** A completed focus session goes into the daily stats and onto the active task; breaks count nowhere. */
function countCompletion(state, completed, now) {
  if (completed.mode !== 'focus') return state;
  return {
    ...state,
    tasks: creditActiveTask(state.tasks),
    stats: pruneStats(recordFocusSession(state.stats, completed.segments), now),
  };
}

function describeEnd(completed, timer, settings) {
  const nextMode = timer.status === 'finished' ? upNext(timer, settings) : timer.mode;
  return { mode: completed.mode, nextMode, endedAt: completed.endedAt };
}

function buildView({ settings, timer, tasks, stats }, now) {
  return {
    mode: timer.mode,
    status: timer.status,
    cycle: timer.cycle,
    remainingMs: remainingAt(timer, now),
    progress: progressAt(timer, now),
    nextMode: upNext(timer, settings),
    settings,
    tasks: tasks.items,
    activeTaskId: tasks.activeId,
    week: lastDays(stats, now),
  };
}
