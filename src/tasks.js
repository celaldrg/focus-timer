/**
 * Task list as plain data with pure update functions. Every function returns a new list and leaves its
 * input untouched; invalid input (an empty title, an unknown id) leaves the list as it was.
 *
 * Invariant: while any task is open, exactly one open task is active. Completed focus sessions are
 * credited to the active task.
 */

/**
 * @typedef {object} Task
 * @property {number} id
 * @property {string} title
 * @property {number} estimate  focus sessions planned for the task
 * @property {number} spent     focus sessions completed while the task was active
 * @property {boolean} done
 */

/**
 * @typedef {object} TaskList
 * @property {Task[]} items
 * @property {number | null} activeId  the open task that receives completed focus sessions
 * @property {number} nextId
 */

/** Longest task title in characters; longer titles are cut. */
export const MAX_TITLE_LENGTH = 120;

/** Highest number of focus sessions a task can be estimated at. */
export const MAX_ESTIMATE = 20;

/**
 * An empty task list.
 * @returns {TaskList}
 */
export function createTaskList() {
  return { items: [], activeId: null, nextId: 1 };
}

/**
 * Appends a task. The title is trimmed, inner whitespace collapsed and the text cut to MAX_TITLE_LENGTH;
 * an empty title is ignored. The estimate is clamped to 1…MAX_ESTIMATE.
 * @param {TaskList} list
 * @param {string} title
 * @param {number | string} [estimate=1]
 * @returns {TaskList}
 */
export function addTask(list, title, estimate = 1) {
  const cleanTitle = toTitle(title);
  if (!cleanTitle) return list;
  const task = { id: list.nextId, title: cleanTitle, estimate: toEstimate(estimate, 1), spent: 0, done: false };
  return withActiveTask({ ...list, items: [...list.items, task], nextId: list.nextId + 1 });
}

/**
 * Changes the title and/or the estimate of a task. Missing or invalid fields keep their old value.
 * @param {TaskList} list
 * @param {number} id
 * @param {{ title?: string, estimate?: number | string }} [changes]
 * @returns {TaskList}
 */
export function editTask(list, id, changes = {}) {
  return updateTask(list, id, (task) => ({
    ...task,
    title: toTitle(changes.title) || task.title,
    estimate: toEstimate(changes.estimate, task.estimate),
  }));
}

/**
 * Marks a task done or open again. When the active task is done, the first open task becomes active.
 * @param {TaskList} list
 * @param {number} id
 * @param {boolean} done
 * @returns {TaskList}
 */
export function setTaskDone(list, id, done) {
  return withActiveTask(updateTask(list, id, (task) => ({ ...task, done: done === true })));
}

/**
 * Removes a task. When it was the active one, the first open task becomes active.
 * @param {TaskList} list
 * @param {number} id
 * @returns {TaskList}
 */
export function deleteTask(list, id) {
  if (!list.items.some((task) => task.id === id)) return list;
  return withActiveTask({ ...list, items: list.items.filter((task) => task.id !== id) });
}

/**
 * Makes an open task the active one. Done or unknown tasks are ignored.
 * @param {TaskList} list
 * @param {number} id
 * @returns {TaskList}
 */
export function selectTask(list, id) {
  const task = list.items.find((item) => item.id === id);
  return task && !task.done ? { ...list, activeId: id } : list;
}

/**
 * Counts one completed focus session on the active task, if there is one.
 * @param {TaskList} list
 * @returns {TaskList}
 */
export function creditActiveTask(list) {
  return updateTask(list, list.activeId, (task) => ({ ...task, spent: task.spent + 1 }));
}

/**
 * Rebuilds a task list from saved data. Invalid or duplicate tasks are dropped, and the active task and
 * the next id are repaired, so a damaged save never breaks the list. Anything unusable gives an empty list.
 * @param {unknown} input
 * @returns {TaskList}
 */
export function restoreTaskList(input) {
  if (typeof input !== 'object' || input === null || !Array.isArray(input.items)) return createTaskList();
  const items = [];
  for (const raw of input.items) {
    const task = restoreTask(raw);
    if (task && !items.some((item) => item.id === task.id)) items.push(task);
  }
  const highestId = items.reduce((highest, task) => Math.max(highest, task.id), 0);
  const nextId = Number.isInteger(input.nextId) && input.nextId > highestId ? input.nextId : highestId + 1;
  const activeId = Number.isInteger(input.activeId) ? input.activeId : null;
  return withActiveTask({ items, activeId, nextId });
}

function restoreTask(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const title = toTitle(raw.title);
  if (!Number.isInteger(raw.id) || raw.id < 1 || !title) return null;
  const spent = Number.isInteger(raw.spent) && raw.spent > 0 ? raw.spent : 0;
  return { id: raw.id, title, estimate: toEstimate(raw.estimate, 1), spent, done: raw.done === true };
}

function updateTask(list, id, change) {
  if (!list.items.some((task) => task.id === id)) return list;
  return { ...list, items: list.items.map((task) => (task.id === id ? change(task) : task)) };
}

/** Keeps the invariant: the active task is open, or else the first open task (or none) takes over. */
function withActiveTask(list) {
  const active = list.items.find((task) => task.id === list.activeId);
  if (active && !active.done) return list;
  const firstOpen = list.items.find((task) => !task.done);
  return { ...list, activeId: firstOpen ? firstOpen.id : null };
}

function toTitle(value) {
  if (typeof value !== 'string') return '';
  const characters = [...value.replace(/\s+/g, ' ').trim()];
  return characters.slice(0, MAX_TITLE_LENGTH).join('').trimEnd();
}

function toEstimate(value, fallback) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return fallback;
  return Math.min(MAX_ESTIMATE, Math.max(1, Math.round(number)));
}
