import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, createFocusApp } from '../src/app.js';
import { createDemoState } from '../src/demo.js';
import { createStorage } from '../src/storage.js';

const MIN = 60_000;

/** Local wall-clock time in January 2026, far from daylight-saving changes, so every time zone agrees. */
function at(day, hours, minutes = 0) {
  return new Date(2026, 0, day, hours, minutes).getTime();
}

const MORNING = at(14, 9);

function createFakeClock(start) {
  let time = start;
  return {
    now: () => time,
    advance(ms) { time += ms; },
    set(newTime) { time = newTime; },
  };
}

function memoryStorage() {
  const data = new Map();
  const backend = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, value); },
  };
  return { storage: createStorage(() => backend), data };
}

function today(app) {
  return app.getView().week.at(-1);
}

describe('focus cycle with a fake clock', () => {
  test('work, short break x3, long break after the 4th work session, then a new cycle (auto-start)', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    app.updateSettings({ autoStartBreaks: true, autoStartFocus: true });
    app.start();

    const transitions = [];
    for (let i = 0; i < 8; i += 1) {
      clock.advance(app.getView().remainingMs + 250);
      const end = app.tick();
      transitions.push(`${end.mode} > ${end.nextMode}`);
      assert.equal(app.getView().status, 'running');
    }

    assert.deepEqual(transitions, [
      'focus > short', 'short > focus', 'focus > short', 'short > focus',
      'focus > short', 'short > focus', 'focus > long', 'long > focus',
    ]);
    const { timer } = app.getState();
    assert.equal(timer.runningSince, MORNING + (4 * 25 + 3 * 5 + 15) * MIN);
    assert.equal(timer.cycle, 0);
    assert.equal(app.getView().remainingMs, 25 * MIN - 250);
    assert.deepEqual([today(app).sessions, today(app).minutes], [4, 100]);
  });

  test('without auto-start every session waits in "finished" until it is started', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    const sessions = [];
    for (let i = 0; i < 8; i += 1) {
      app.start();
      const view = app.getView();
      sessions.push(`${view.mode} ${view.remainingMs / MIN}`);
      clock.advance(view.remainingMs);
      app.tick();
      assert.equal(app.getView().status, 'finished');
      assert.equal(app.getView().remainingMs, 0);
      clock.advance(30_000);
    }
    assert.deepEqual(sessions, [
      'focus 25', 'short 5', 'focus 25', 'short 5', 'focus 25', 'short 5', 'focus 25', 'long 15',
    ]);
    app.start();
    assert.equal(app.getView().mode, 'focus');
    assert.equal(app.getView().cycle, 0);
  });

  test('the view announces the long break during the 4th work session', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    const upcoming = [];
    for (let i = 0; i < 4; i += 1) {
      app.start();
      upcoming.push(app.getView().nextMode);
      clock.advance(25 * MIN);
      app.tick();
      app.skip();
      app.skip();
    }
    assert.deepEqual(upcoming, ['short', 'short', 'short', 'long']);
  });
});

describe('pause and resume with a fake clock', () => {
  test('pausing keeps the remaining time exact, however long the pause and however many ticks', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    app.start();
    clock.advance(7 * MIN + 13_457);
    app.pause();
    const left = 25 * MIN - (7 * MIN + 13_457);
    assert.equal(app.getView().remainingMs, left);

    for (let i = 0; i < 120; i += 1) {
      clock.advance(30_000);
      assert.equal(app.tick(), null);
    }
    assert.equal(app.getView().status, 'paused');
    assert.equal(app.getView().remainingMs, left);

    app.resume();
    clock.advance(left - 1);
    assert.equal(app.tick(), null);
    assert.equal(app.getView().remainingMs, 1);
    clock.advance(1);
    assert.deepEqual(app.tick(), { mode: 'focus', nextMode: 'short', endedAt: clock.now() });
    assert.deepEqual([today(app).sessions, today(app).minutes], [1, 25]);
  });

  test('many pauses still add up to exactly one session length', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    const runs = [61_001, 3 * MIN + 7, 9 * MIN + 999];
    const pauses = [45_000, 2 * MIN + 1, 13_337];
    app.toggle();
    runs.forEach((run, index) => {
      clock.advance(run);
      app.toggle();
      clock.advance(pauses[index]);
      app.toggle();
    });
    const ranSoFar = runs.reduce((sum, run) => sum + run, 0);
    assert.equal(app.getView().remainingMs, 25 * MIN - ranSoFar);

    clock.advance(25 * MIN - ranSoFar);
    const end = app.tick();
    const pausedTotal = pauses.reduce((sum, pause) => sum + pause, 0);
    assert.equal(end.endedAt, MORNING + 25 * MIN + pausedTotal);
    assert.equal(today(app).minutes, 25);
  });

  test('an action right after the time ran out still completes and reports that session', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    app.start();
    clock.advance(25 * MIN + 400);
    const end = app.toggle();
    assert.deepEqual(end, { mode: 'focus', nextMode: 'short', endedAt: MORNING + 25 * MIN });
    assert.equal(app.getView().mode, 'short');
    assert.equal(app.getView().status, 'running');
    assert.equal(today(app).sessions, 1);
  });
});

describe('restoring after a reload', () => {
  test('a running timer keeps running with the right remaining time', () => {
    const { storage } = memoryStorage();
    const clock = createFakeClock(MORNING);
    const before = createFocusApp({ clock, storage });
    before.addTask('Write tests', 2);
    before.start();
    clock.advance(10 * MIN);

    const after = createFocusApp({ clock, storage });
    assert.equal(after.getView().status, 'running');
    assert.equal(after.getView().remainingMs, 15 * MIN);
    assert.equal(after.getView().tasks[0].title, 'Write tests');

    clock.advance(15 * MIN - 1);
    assert.equal(after.tick(), null);
    clock.advance(1);
    assert.deepEqual(after.tick(), { mode: 'focus', nextMode: 'short', endedAt: MORNING + 25 * MIN });
    assert.equal(after.getView().tasks[0].spent, 1);
    assert.deepEqual([today(after).sessions, today(after).minutes], [1, 25]);
  });

  test('a paused timer stays paused with the same remaining time', () => {
    const { storage } = memoryStorage();
    const clock = createFakeClock(MORNING);
    const before = createFocusApp({ clock, storage });
    before.start();
    clock.advance(4 * MIN + 321);
    before.pause();
    clock.advance(3 * 60 * MIN);

    const after = createFocusApp({ clock, storage });
    assert.equal(after.getView().status, 'paused');
    assert.equal(after.getView().remainingMs, 21 * MIN - 321);
    after.resume();
    clock.advance(21 * MIN - 321);
    assert.equal(after.tick().mode, 'focus');
    assert.equal(today(after).minutes, 25);
  });

  test('a session that ended while the page was closed is counted once, at its real end time', () => {
    const { storage } = memoryStorage();
    const clock = createFakeClock(MORNING);
    const before = createFocusApp({ clock, storage });
    before.updateSettings({ autoStartBreaks: true });
    before.start();
    clock.advance(27 * MIN);

    const after = createFocusApp({ clock, storage });
    assert.deepEqual(after.tick(), { mode: 'focus', nextMode: 'short', endedAt: MORNING + 25 * MIN });
    assert.equal(after.getView().mode, 'short');
    assert.equal(after.getView().status, 'running');
    assert.equal(after.getView().remainingMs, 3 * MIN);

    const again = createFocusApp({ clock, storage });
    assert.equal(again.tick(), null);
    assert.equal(today(again).sessions, 1);
  });

  test('after hours away the timer waits instead of replaying sessions nobody saw', () => {
    const { storage } = memoryStorage();
    const clock = createFakeClock(MORNING);
    const before = createFocusApp({ clock, storage });
    before.updateSettings({ autoStartBreaks: true, autoStartFocus: true });
    before.start();
    clock.advance(5 * 60 * MIN);

    const after = createFocusApp({ clock, storage });
    assert.equal(after.tick().endedAt, MORNING + 25 * MIN);
    assert.equal(after.tick(), null);
    assert.equal(after.getView().status, 'finished');
    assert.equal(after.getView().nextMode, 'short');
    assert.equal(today(after).sessions, 1);
  });

  test('damaged or unknown saves fall back to a fresh state, keeping the parts that are still valid', () => {
    const clock = createFakeClock(MORNING);
    for (const raw of ['{not json', '"text"', '{"version":99,"timer":{}}']) {
      const { storage, data } = memoryStorage();
      data.set(STORAGE_KEY, raw);
      const app = createFocusApp({ clock, storage });
      const view = app.getView();
      assert.deepEqual([view.mode, view.status, view.remainingMs, view.tasks.length], ['focus', 'idle', 25 * MIN, 0]);
      app.start();
      assert.equal(JSON.parse(data.get(STORAGE_KEY)).timer.status, 'running');
    }

    const { storage, data } = memoryStorage();
    data.set(STORAGE_KEY, JSON.stringify({
      version: 1,
      settings: { focusMinutes: 40 },
      timer: { mode: 'focus', status: 'running' },
      tasks: { items: [{ id: 1, title: 'Kept', estimate: 2, spent: 1, done: false }], activeId: 1, nextId: 2 },
      stats: 'oops',
    }));
    const view = createFocusApp({ clock, storage }).getView();
    assert.equal(view.status, 'idle');
    assert.equal(view.remainingMs, 40 * MIN);
    assert.equal(view.tasks[0].title, 'Kept');
    assert.equal(view.week.every((bar) => bar.sessions === 0), true);
  });
});

describe('settings', () => {
  test('changes apply to the next session, never to the one that is running', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    app.start();
    clock.advance(5 * MIN);
    app.updateSettings({ focusMinutes: 50, shortBreakMinutes: 10 });
    assert.equal(app.getView().remainingMs, 20 * MIN);

    clock.advance(20 * MIN);
    assert.equal(app.tick().endedAt, MORNING + 25 * MIN);
    app.start();
    assert.equal(app.getView().mode, 'short');
    assert.equal(app.getView().remainingMs, 10 * MIN);

    clock.advance(10 * MIN);
    app.tick();
    app.start();
    assert.equal(app.getView().mode, 'focus');
    assert.equal(app.getView().remainingMs, 50 * MIN);
  });

  test('a session that has not started picks up its new length at once', () => {
    const app = createFocusApp({ clock: createFakeClock(MORNING) });
    app.updateSettings({ focusMinutes: '45' });
    assert.equal(app.getView().remainingMs, 45 * MIN);
    assert.equal(app.getView().settings.focusMinutes, 45);
  });

  test('a shorter long-break interval takes effect within the current cycle', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    app.start();
    clock.advance(25 * MIN);
    app.tick();
    app.skip();
    app.skip();
    app.updateSettings({ longBreakInterval: 2 });
    assert.equal(app.getView().nextMode, 'long');
    app.start();
    clock.advance(25 * MIN);
    assert.equal(app.tick().nextMode, 'long');
  });
});

describe('daily statistics', () => {
  test('a session across midnight splits its minutes and counts on the day it ended', () => {
    const clock = createFakeClock(at(14, 23, 50));
    const app = createFocusApp({ clock });
    app.start();
    clock.advance(25 * MIN);
    app.tick();
    assert.deepEqual(app.getView().week.slice(-2).map(({ day, sessions, minutes }) => ({ day, sessions, minutes })), [
      { day: '2026-01-14', sessions: 0, minutes: 10 },
      { day: '2026-01-15', sessions: 1, minutes: 15 },
    ]);
  });

  test('a pause across midnight puts each running stretch on its own day', () => {
    const clock = createFakeClock(at(14, 23, 40));
    const app = createFocusApp({ clock });
    app.start();
    clock.set(at(14, 23, 55));
    app.pause();
    clock.set(at(15, 0, 30));
    app.resume();
    clock.set(at(15, 0, 40));
    app.tick();
    const [yesterday, todayBar] = app.getView().week.slice(-2);
    assert.deepEqual([yesterday.sessions, yesterday.minutes], [0, 15]);
    assert.deepEqual([todayBar.sessions, todayBar.minutes], [1, 10]);
  });

  test('days add up and the 7-day window rolls over exactly at midnight', () => {
    const clock = createFakeClock(at(14, 23, 50));
    const app = createFocusApp({ clock });
    const focusFor = (minutes) => {
      app.selectMode('focus');
      app.start();
      clock.advance(minutes * MIN);
      app.tick();
    };
    focusFor(25);
    clock.set(at(15, 8));
    focusFor(25);
    clock.set(at(15, 14));
    app.selectMode('short');
    app.start();
    clock.advance(5 * MIN);
    assert.equal(app.tick().mode, 'short');
    clock.set(at(20, 21));
    focusFor(25);

    const week = app.getView().week;
    assert.deepEqual(week.map((bar) => `${bar.day} ${bar.sessions}/${bar.minutes}`), [
      '2026-01-14 0/10', '2026-01-15 2/40', '2026-01-16 0/0', '2026-01-17 0/0',
      '2026-01-18 0/0', '2026-01-19 0/0', '2026-01-20 1/25',
    ]);

    clock.set(at(21, 0) - 1);
    assert.equal(app.getView().week[0].day, '2026-01-14');
    clock.set(at(21, 0));
    const rolled = app.getView().week;
    assert.equal(rolled[0].day, '2026-01-15');
    assert.deepEqual([rolled[0].sessions, rolled[0].minutes], [2, 40]);
    assert.deepEqual([rolled[6].day, rolled[6].sessions], ['2026-01-21', 0]);
  });
});

describe('tasks and the demo', () => {
  test('completed focus sessions are credited to the active task, breaks are not', () => {
    const clock = createFakeClock(MORNING);
    const app = createFocusApp({ clock });
    app.addTask('First', 2);
    app.addTask('Second', 3);
    app.selectTask(2);
    app.start();
    clock.advance(25 * MIN);
    app.tick();
    app.start();
    clock.advance(5 * MIN);
    assert.equal(app.tick().mode, 'short');
    assert.deepEqual(app.getView().tasks.map((task) => task.spent), [0, 1]);

    app.setTaskDone(2, true);
    assert.equal(app.getView().activeTaskId, 1);
    app.editTask(1, { title: 'First, renamed' });
    app.deleteTask(2);
    assert.deepEqual(app.getView().tasks.map((task) => task.title), ['First, renamed']);
  });

  test('the demo is a running focus session at 60 % with three tasks and a full week', () => {
    const now = at(14, 10);
    const demo = createDemoState(now);
    assert.deepEqual(createDemoState(now), demo);

    const app = createFocusApp({ clock: createFakeClock(now), initialState: demo });
    const view = app.getView();
    assert.deepEqual([view.mode, view.status, view.remainingMs], ['focus', 'running', 10 * MIN]);
    assert.ok(Math.abs(view.progress - 0.6) < 1e-9);
    assert.equal(view.tasks.length, 3);
    assert.equal(view.week.length, 7);
    assert.equal(view.week.every((bar) => bar.sessions > 0 && bar.minutes > 0), true);
  });

  test('the demo session runs on like a real one', () => {
    const now = at(14, 10);
    const clock = createFakeClock(now);
    const app = createFocusApp({ clock, initialState: createDemoState(now) });
    const before = today(app).sessions;
    clock.advance(10 * MIN);
    assert.equal(app.tick().mode, 'focus');
    assert.equal(today(app).sessions, before + 1);
    assert.equal(app.getView().tasks.find((task) => task.id === app.getView().activeTaskId).spent, 3);
  });
});
