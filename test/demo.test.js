import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState, demoTitleChanges } from '../src/demo.js';
import { restoreAppState } from '../src/state.js';
import { editTask } from '../src/tasks.js';

/** Local wall-clock time in January 2026, far from daylight-saving changes. */
const NOW = new Date(2026, 0, 14, 10, 0).getTime();

const titles = (language) => createDemoState(NOW, language).tasks.items.map((task) => task.title);

test('the demo tasks are written in the chosen language, English by default', () => {
  assert.deepEqual(titles('en'), ['Write the weekly report', 'Review pull requests', 'Plan tomorrow']);
  assert.deepEqual(titles('tr'), ['Haftalık raporu yaz', 'Kod incelemelerini bitir', 'Yarını planla']);
  assert.deepEqual(titles(), titles('en'));
});

test('the demo state survives a save and restore unchanged', () => {
  const demo = createDemoState(NOW, 'tr');
  assert.deepEqual(restoreAppState(JSON.parse(JSON.stringify(demo))), demo);
});

test('switching language renames the demo tasks that still carry their demo title', () => {
  const { tasks } = createDemoState(NOW, 'en');
  assert.deepEqual(demoTitleChanges(tasks.items, 'en', 'tr'), [
    { id: 1, title: 'Haftalık raporu yaz' },
    { id: 2, title: 'Kod incelemelerini bitir' },
    { id: 3, title: 'Yarını planla' },
  ]);
  const edited = editTask(tasks, 2, { title: 'My own title' });
  assert.deepEqual(demoTitleChanges(edited.items, 'en', 'tr').map((change) => change.id), [1, 3]);
});

test('tasks that are gone, or not in the language being left, are not renamed', () => {
  assert.deepEqual(demoTitleChanges(createDemoState(NOW, 'tr').tasks.items, 'en', 'tr'), []);
  assert.deepEqual(demoTitleChanges([], 'en', 'tr'), []);
});
