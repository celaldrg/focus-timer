import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_VERSION, createAppState, restoreAppState } from '../src/state.js';
import { normalizeSettings } from '../src/settings.js';
import { addTask, createTaskList } from '../src/tasks.js';
import { createTimer, start } from '../src/timer.js';
import { createDemoState } from '../src/demo.js';

const MIN = 60_000;
const T0 = new Date(2026, 0, 14, 10).getTime();

test('a first-visit state has default settings, an idle focus session, no tasks and no stats', () => {
  const state = createAppState();
  assert.equal(state.version, STATE_VERSION);
  assert.deepEqual(state.settings, normalizeSettings());
  assert.deepEqual(state.timer, createTimer(state.settings));
  assert.deepEqual(state.tasks, createTaskList());
  assert.deepEqual(state.stats, {});
});

test('a saved state survives the JSON round trip unchanged, running timer included', () => {
  const state = createDemoState(T0);
  assert.equal(state.timer.status, 'running');
  assert.deepEqual(restoreAppState(JSON.parse(JSON.stringify(state))), state);
});

test('saves from another version or of the wrong type give a first-visit state', () => {
  const saved = JSON.parse(JSON.stringify(createDemoState(T0)));
  for (const input of [undefined, null, 'state', [], { ...saved, version: STATE_VERSION + 1 }]) {
    assert.deepEqual(restoreAppState(input), createAppState());
  }
});

test('an idle session follows the restored settings; a started one keeps its length', () => {
  const settings = normalizeSettings({ focusMinutes: 30 });
  const idle = { ...createAppState(), settings, tasks: addTask(createTaskList(), 'Kept') };
  assert.equal(restoreAppState(JSON.parse(JSON.stringify(idle))).timer.durationMs, 30 * MIN);

  const running = { ...createAppState(), settings, timer: start(createTimer(normalizeSettings()), settings, T0) };
  assert.equal(restoreAppState(JSON.parse(JSON.stringify(running))).timer.durationMs, 25 * MIN);
});
