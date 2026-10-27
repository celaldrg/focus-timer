import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings } from '../src/settings.js';
import {
  MODES, applySettings, createTimer, formatClock, pause, progressAt, remainingAt, reset, restoreTimer, resume,
  selectMode, selectModeDiscards, skip, start, tick, toggle, upNext,
} from '../src/timer.js';

const MIN = 60_000;
const T0 = Date.UTC(2026, 0, 14, 9, 0);
const manual = normalizeSettings();
const auto = normalizeSettings({ autoStartBreaks: true, autoStartFocus: true });

function endOf(timer) {
  return timer.runningSince + timer.remainingMs;
}

function deepFreeze(value) {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test('a new timer is an idle focus session at full length', () => {
  const timer = createTimer(manual);
  assert.deepEqual(timer, {
    mode: 'focus', status: 'idle', durationMs: 25 * MIN, remainingMs: 25 * MIN, runningSince: null, cycle: 0, segments: [],
  });
  assert.equal(remainingAt(timer, T0 + 5 * MIN), 25 * MIN);
  assert.equal(progressAt(timer, T0), 0);
});

test('remaining time comes from timestamps, not from counting ticks', () => {
  const started = start(createTimer(manual), manual, T0);
  let ticked = started;
  for (let now = T0; now < T0 + 10 * MIN; now += 997) ticked = tick(ticked, manual, now).timer;
  assert.deepEqual(ticked, started);
  assert.equal(remainingAt(ticked, T0 + 10 * MIN), 15 * MIN);
  assert.ok(Math.abs(progressAt(ticked, T0 + 10 * MIN) - 0.4) < 1e-12);
});

test('a session completes at its exact end time even when the tick comes late', () => {
  const started = start(createTimer(manual), manual, T0);
  assert.equal(tick(started, manual, T0 + 25 * MIN - 1).completed, null);

  const { timer, completed } = tick(started, manual, T0 + 25 * MIN + 4_321);
  assert.deepEqual(completed, { mode: 'focus', endedAt: T0 + 25 * MIN, segments: [[T0, T0 + 25 * MIN]] });
  assert.equal(timer.status, 'finished');
  assert.equal(timer.mode, 'focus');
  assert.equal(timer.cycle, 1);
  assert.equal(remainingAt(timer, T0 + 30 * MIN), 0);
  assert.equal(progressAt(timer, T0 + 30 * MIN), 1);
  assert.equal(upNext(timer, manual), 'short');
});

test('manual cycle: focus, short break x3, long break after the 4th focus, then a new cycle', () => {
  let timer = createTimer(manual);
  let now = T0;
  const sessions = [];
  for (let i = 0; i < 8; i += 1) {
    timer = start(timer, manual, now);
    sessions.push(`${timer.mode} ${timer.durationMs / MIN}`);
    now = endOf(timer) + 2_000;
    timer = tick(timer, manual, now).timer;
    assert.equal(timer.status, 'finished');
  }
  assert.deepEqual(sessions, [
    'focus 25', 'short 5', 'focus 25', 'short 5', 'focus 25', 'short 5', 'focus 25', 'long 15',
  ]);
  timer = start(timer, manual, now);
  assert.equal(timer.mode, 'focus');
  assert.equal(timer.cycle, 0);
});

test('auto-start chains every session from the exact end of the previous one', () => {
  let timer = start(createTimer(auto), auto, T0);
  const completedModes = [];
  for (let i = 0; i < 8; i += 1) {
    const endsAt = endOf(timer);
    const result = tick(timer, auto, endsAt + 1_500);
    completedModes.push(result.completed.mode);
    assert.equal(result.timer.status, 'running');
    assert.equal(result.timer.runningSince, endsAt);
    timer = result.timer;
  }
  assert.deepEqual(completedModes, ['focus', 'short', 'focus', 'short', 'focus', 'short', 'focus', 'long']);
  assert.equal(timer.mode, 'focus');
  assert.equal(timer.cycle, 0);
  assert.equal(timer.runningSince, T0 + (4 * 25 + 3 * 5 + 15) * MIN);
});

test('auto-start does not replay sessions that would already be over after a long sleep', () => {
  const started = start(createTimer(auto), auto, T0);

  const justInTime = tick(started, auto, T0 + 30 * MIN - 1);
  assert.equal(justInTime.timer.mode, 'short');
  assert.equal(justInTime.timer.runningSince, T0 + 25 * MIN);
  assert.equal(remainingAt(justInTime.timer, T0 + 30 * MIN - 1), 1);

  const afterSleep = tick(started, auto, T0 + 8 * 60 * MIN);
  assert.equal(afterSleep.completed.endedAt, T0 + 25 * MIN);
  assert.equal(afterSleep.timer.status, 'finished');
  assert.equal(afterSleep.timer.mode, 'focus');
  assert.equal(tick(afterSleep.timer, auto, T0 + 9 * 60 * MIN).completed, null);

  const breakNow = start(afterSleep.timer, auto, T0 + 9 * 60 * MIN);
  assert.equal(breakNow.mode, 'short');
  assert.equal(breakNow.runningSince, T0 + 9 * 60 * MIN);
});

test('pause freezes the exact remaining time and resume continues from it', () => {
  const pausedAt = T0 + 7 * MIN + 13_457;
  const left = 25 * MIN - (7 * MIN + 13_457);
  let timer = pause(start(createTimer(manual), manual, T0), pausedAt);
  assert.equal(timer.status, 'paused');
  assert.equal(remainingAt(timer, T0 + 3 * 60 * MIN), left);
  assert.equal(tick(timer, manual, T0 + 3 * 60 * MIN).completed, null);

  const resumedAt = T0 + 60 * MIN;
  timer = resume(timer, resumedAt);
  assert.equal(remainingAt(timer, resumedAt + left - 1), 1);
  assert.equal(tick(timer, manual, resumedAt + left - 1).completed, null);

  const { completed } = tick(timer, manual, resumedAt + left);
  assert.equal(completed.endedAt, resumedAt + left);
  assert.deepEqual(completed.segments, [[T0, pausedAt], [resumedAt, resumedAt + left]]);
  const runningTime = completed.segments.reduce((sum, [from, to]) => sum + (to - from), 0);
  assert.equal(runningTime, 25 * MIN);
});

test('start, pause, resume and toggle leave states they do not apply to alone', () => {
  const idle = createTimer(manual);
  assert.equal(pause(idle, T0), idle);
  assert.equal(resume(idle, T0), idle);

  const running = start(idle, manual, T0);
  assert.equal(start(running, manual, T0 + MIN), running);
  assert.equal(resume(running, T0 + MIN), running);
  assert.equal(toggle(running, manual, T0 + MIN).status, 'paused');

  const paused = pause(running, T0 + MIN);
  assert.equal(toggle(paused, manual, T0 + 2 * MIN).status, 'running');
  assert.equal(start(paused, manual, T0 + 2 * MIN).runningSince, T0 + 2 * MIN);
  assert.equal(remainingAt(start(paused, manual, T0 + 2 * MIN), T0 + 2 * MIN), 24 * MIN);
});

test('skip moves one step along the cycle without counting the skipped session', () => {
  const skippedFocus = skip(start(createTimer(manual), manual, T0), manual, T0 + MIN);
  assert.equal(skippedFocus.mode, 'short');
  assert.equal(skippedFocus.status, 'idle');
  assert.equal(skippedFocus.cycle, 0);
  assert.equal(skippedFocus.remainingMs, 5 * MIN);
  assert.equal(skip(skippedFocus, manual, T0 + 2 * MIN).mode, 'focus');

  const fourthFocus = { ...createTimer(manual), cycle: 3 };
  assert.equal(skip(fourthFocus, manual, T0).mode, 'short');

  const longBreak = selectMode({ ...createTimer(manual), cycle: 4 }, 'long', manual);
  const afterLongBreak = skip(longBreak, manual, T0);
  assert.equal(afterLongBreak.mode, 'focus');
  assert.equal(afterLongBreak.cycle, 0);

  const autoSkipped = skip(start(createTimer(auto), auto, T0), auto, T0 + MIN);
  assert.equal(autoSkipped.mode, 'short');
  assert.equal(autoSkipped.status, 'running');
  assert.equal(autoSkipped.runningSince, T0 + MIN);
});

test('reset rewinds the current session; on an idle timer it starts a fresh cycle', () => {
  const running = start({ ...createTimer(manual), cycle: 2 }, manual, T0);
  const rewound = reset(pause(running, T0 + 3 * MIN), manual);
  assert.deepEqual(rewound, {
    mode: 'focus', status: 'idle', durationMs: 25 * MIN, remainingMs: 25 * MIN, runningSince: null, cycle: 2, segments: [],
  });
  assert.deepEqual(reset(rewound, manual), createTimer(manual));

  const shortBreak = start(selectMode(rewound, 'short', manual), manual, T0);
  const rewoundBreak = reset(shortBreak, manual);
  assert.equal(rewoundBreak.mode, 'short');
  assert.equal(rewoundBreak.remainingMs, 5 * MIN);
});

test('selectMode switches to an idle session of the chosen mode', () => {
  const running = start(createTimer(manual), manual, T0);
  assert.equal(selectMode(running, 'focus', manual), running);

  const longBreak = selectMode(running, 'long', manual);
  assert.equal(longBreak.mode, 'long');
  assert.equal(longBreak.status, 'idle');
  assert.equal(longBreak.remainingMs, 15 * MIN);

  assert.equal(selectMode({ ...longBreak, cycle: 4 }, 'focus', manual).cycle, 0);

  const finished = tick(running, manual, T0 + 25 * MIN).timer;
  const again = selectMode(finished, 'focus', manual);
  assert.equal(again.status, 'idle');
  assert.equal(again.remainingMs, 25 * MIN);
});

test('selectModeDiscards flags exactly the mode changes that would throw away a started session', () => {
  const idle = createTimer(manual);
  const running = start(idle, manual, T0);
  const paused = pause(running, T0 + 20 * MIN);
  const finished = tick(running, manual, T0 + 25 * MIN).timer;

  assert.equal(selectModeDiscards(running, 'short'), true);
  assert.equal(selectModeDiscards(paused, 'long'), true);
  assert.equal(selectModeDiscards(running, 'focus'), false);
  assert.equal(selectModeDiscards(paused, 'focus'), false);
  assert.equal(selectModeDiscards(idle, 'short'), false);
  assert.equal(selectModeDiscards(finished, 'short'), false);

  for (const timer of [running, paused, start(selectMode(idle, 'long', manual), manual, T0)]) {
    for (const mode of MODES) {
      const kept = selectMode(timer, mode, manual) === timer;
      assert.equal(selectModeDiscards(timer, mode), !kept, `${timer.mode} ${timer.status} -> ${mode}`);
    }
  }
});

test('upNext already shows the long break during the last focus session of a cycle', () => {
  const thirdFocus = { ...createTimer(manual), cycle: 2 };
  const fourthFocus = { ...createTimer(manual), cycle: 3 };
  assert.equal(upNext(thirdFocus, manual), 'short');
  assert.equal(upNext(fourthFocus, manual), 'long');
  assert.equal(upNext(start(fourthFocus, manual, T0), manual), 'long');

  const finished = tick(start(fourthFocus, manual, T0), manual, T0 + 25 * MIN).timer;
  assert.equal(finished.cycle, 4);
  assert.equal(upNext(finished, manual), 'long');
  assert.equal(upNext(selectMode(finished, 'short', manual), manual), 'focus');
});

test('new settings reach an idle session at once and a started one only from the next session', () => {
  const longer = normalizeSettings({ focusMinutes: 50, shortBreakMinutes: 10 });
  assert.equal(applySettings(createTimer(manual), longer).remainingMs, 50 * MIN);

  const running = start(createTimer(manual), manual, T0);
  assert.equal(applySettings(running, longer), running);
  const paused = pause(running, T0 + MIN);
  assert.equal(applySettings(paused, longer), paused);

  const finished = tick(running, longer, T0 + 25 * MIN).timer;
  assert.equal(start(finished, longer, T0 + 26 * MIN).durationMs, 10 * MIN);
});

test('the clock going backwards never adds time', () => {
  const running = start(createTimer(manual), manual, T0);
  assert.equal(remainingAt(running, T0 - 5 * MIN), 25 * MIN);
  const paused = pause(running, T0 - 5 * MIN);
  assert.equal(paused.remainingMs, 25 * MIN);
  assert.deepEqual(paused.segments, []);
});

test('transitions never mutate their input', () => {
  const running = deepFreeze(start(createTimer(manual), manual, T0));
  const paused = deepFreeze(pause(running, T0 + MIN));
  assert.doesNotThrow(() => {
    tick(running, auto, T0 + 30 * MIN);
    toggle(running, manual, T0 + MIN);
    resume(paused, T0 + 2 * MIN);
    skip(running, auto, T0 + MIN);
    reset(running, manual);
    selectMode(running, 'short', manual);
    applySettings(paused, auto);
  });
});

test('restoreTimer keeps a valid saved timer and replaces anything else with a fresh one', () => {
  const paused = pause(start(createTimer(manual), manual, T0), T0 + 3 * MIN);
  const saved = JSON.parse(JSON.stringify(paused));
  assert.deepEqual(restoreTimer(saved, manual), paused);

  const running = JSON.parse(JSON.stringify(start(createTimer(manual), manual, T0)));
  assert.deepEqual(restoreTimer(running, manual), running);

  const broken = [
    null, 'timer', {}, { ...saved, mode: 'nap' }, { ...saved, status: 'done' }, { ...saved, remainingMs: -1 },
    { ...saved, remainingMs: saved.durationMs + 1 }, { ...saved, durationMs: 0 }, { ...saved, runningSince: T0 },
    { ...running, runningSince: null }, { ...saved, cycle: 1.5 }, { ...saved, segments: [[T0, T0 - 1]] },
    { ...saved, segments: 'none' },
  ];
  for (const input of broken) assert.deepEqual(restoreTimer(input, manual), createTimer(manual));
});

test('formatClock shows a countdown rounded up to whole seconds', () => {
  assert.equal(formatClock(25 * MIN), '25:00');
  assert.equal(formatClock(25 * MIN - 1), '25:00');
  assert.equal(formatClock(4 * MIN + 59_000), '04:59');
  assert.equal(formatClock(4 * MIN + 58_001), '04:59');
  assert.equal(formatClock(1), '00:01');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(-500), '00:00');
  assert.equal(formatClock(90 * MIN), '1:30:00');
});
