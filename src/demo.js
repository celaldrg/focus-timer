/**
 * The deterministic "?demo" state used for the README screenshot: a running focus session about 60 %
 * done, three tasks and a filled weekly chart. The same `now` always gives the same state.
 */
import { createAppState } from './state.js';
import { start } from './timer.js';
import { lastDays } from './stats.js';
import { translate } from './i18n.js';

const DEMO_PROGRESS = 0.6;
const DEMO_CYCLE = 2;
const DEMO_SESSIONS_PER_DAY = [5, 7, 4, 8, 6, 3, 2];
const DEMO_TASKS = [
  { id: 1, titleKey: 'demoTask1', estimate: 4, spent: 2, done: false },
  { id: 2, titleKey: 'demoTask2', estimate: 2, spent: 2, done: true },
  { id: 3, titleKey: 'demoTask3', estimate: 1, spent: 0, done: false },
];

/**
 * Builds the demo state around `now`, with task titles in the given language.
 * @param {number} now epoch milliseconds
 * @param {import('./i18n.js').Language} [language='en']
 * @returns {import('./state.js').AppState}
 */
export function createDemoState(now, language = 'en') {
  const state = createAppState();
  const focusMs = state.timer.durationMs;
  const startedAt = now - Math.round(DEMO_PROGRESS * focusMs);
  const timer = start({ ...state.timer, cycle: DEMO_CYCLE }, state.settings, startedAt);
  const items = DEMO_TASKS.map(({ titleKey, ...task }) => ({ ...task, title: translate(language, titleKey) }));
  const tasks = { items, activeId: 1, nextId: DEMO_TASKS.length + 1 };
  const week = lastDays({}, now, DEMO_SESSIONS_PER_DAY.length);
  const stats = Object.fromEntries(week.map(({ day }, index) => {
    const sessions = DEMO_SESSIONS_PER_DAY[index];
    return [day, { sessions, focusMs: sessions * focusMs }];
  }));
  return { ...state, timer, tasks, stats };
}

/**
 * The renames that move the demo tasks into another language when the visitor switches it. Only tasks
 * that still carry their demo title are renamed, so tasks the visitor added or edited stay as they are.
 * @param {import('./tasks.js').Task[]} tasks
 * @param {import('./i18n.js').Language} fromLanguage
 * @param {import('./i18n.js').Language} toLanguage
 * @returns {{ id: number, title: string }[]}
 */
export function demoTitleChanges(tasks, fromLanguage, toLanguage) {
  return DEMO_TASKS.flatMap(({ id, titleKey }) => {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.title !== translate(fromLanguage, titleKey)) return [];
    return [{ id, title: translate(toLanguage, titleKey) }];
  });
}
