import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, lastDays, pruneStats, recordFocusSession, restoreStats, splitByDay } from '../src/stats.js';

const MIN = 60_000;

/** Local wall-clock time, so the tests pass in every time zone. */
function at(day, hours, minutes = 0, seconds = 0) {
  return new Date(2026, 0, day, hours, minutes, seconds).getTime();
}

test('dayKey uses the local calendar day with zero padding', () => {
  assert.equal(dayKey(at(5, 0, 0)), '2026-01-05');
  assert.equal(dayKey(at(5, 23, 59, 59)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 9, 31, 12).getTime()), '2026-10-31');
});

test('splitByDay cuts a time range at every local midnight', () => {
  assert.deepEqual(splitByDay(at(14, 23, 50), at(15, 0, 15)), [
    { day: '2026-01-14', ms: 10 * MIN },
    { day: '2026-01-15', ms: 15 * MIN },
  ]);
  assert.deepEqual(splitByDay(at(14, 22), at(16, 1)), [
    { day: '2026-01-14', ms: 120 * MIN },
    { day: '2026-01-15', ms: 24 * 60 * MIN },
    { day: '2026-01-16', ms: 60 * MIN },
  ]);
  assert.deepEqual(splitByDay(at(14, 10), at(14, 10)), []);
});

test('a session across midnight splits its minutes and counts on the day it ended', () => {
  const stats = recordFocusSession({}, [[at(14, 23, 50), at(15, 0, 15)]]);
  assert.deepEqual(stats, {
    '2026-01-14': { sessions: 0, focusMs: 10 * MIN },
    '2026-01-15': { sessions: 1, focusMs: 15 * MIN },
  });
});

test('a session ending exactly at midnight belongs to the day it ran in', () => {
  const stats = recordFocusSession({}, [[at(14, 23, 35), at(15, 0, 0)]]);
  assert.deepEqual(stats, { '2026-01-14': { sessions: 1, focusMs: 25 * MIN } });
});

test('paused sessions add each running stretch to its own day', () => {
  const segments = [[at(14, 23, 40), at(14, 23, 55)], [at(15, 0, 30), at(15, 0, 40)]];
  const stats = recordFocusSession({ '2026-01-15': { sessions: 2, focusMs: 50 * MIN } }, segments);
  assert.deepEqual(stats, {
    '2026-01-14': { sessions: 0, focusMs: 15 * MIN },
    '2026-01-15': { sessions: 3, focusMs: 60 * MIN },
  });
});

test('recording returns a new object and ignores empty sessions', () => {
  const before = { '2026-01-14': { sessions: 1, focusMs: 25 * MIN } };
  const snapshot = structuredClone(before);
  recordFocusSession(before, [[at(14, 9), at(14, 9, 25)]]);
  assert.deepEqual(before, snapshot);
  assert.equal(recordFocusSession(before, []), before);
});

test('lastDays lists the 7 days ending today, oldest first, with zeros for empty days', () => {
  const stats = {
    '2026-01-09': { sessions: 1, focusMs: 25 * MIN },
    '2026-01-14': { sessions: 3, focusMs: 75 * MIN + 29_000 },
    '2026-01-15': { sessions: 2, focusMs: 50 * MIN + 31_000 },
  };
  const week = lastDays(stats, at(15, 18));
  assert.deepEqual(week.map((bar) => bar.day), [
    '2026-01-09', '2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15',
  ]);
  assert.deepEqual(week.map((bar) => bar.sessions), [1, 0, 0, 0, 0, 3, 2]);
  assert.deepEqual(week.map((bar) => bar.minutes), [25, 0, 0, 0, 0, 75, 51]);
  assert.equal(week[6].weekday, new Date(2026, 0, 15).getDay());
});

test('the 7-day window moves on exactly at midnight', () => {
  const stats = { '2026-01-09': { sessions: 4, focusMs: 100 * MIN } };
  assert.equal(lastDays(stats, at(15, 23, 59, 59) + 999)[0].day, '2026-01-09');
  assert.equal(lastDays(stats, at(16, 0, 0))[0].day, '2026-01-10');
  assert.equal(lastDays(stats, at(16, 0, 0)).some((bar) => bar.sessions > 0), false);
});

test('lastDays crosses month and year boundaries', () => {
  const days = lastDays({}, new Date(2026, 0, 3, 12).getTime()).map((bar) => bar.day);
  assert.deepEqual(days, [
    '2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03',
  ]);
});

test('every night of the year splits without losing time, daylight-saving nights included', () => {
  for (let day = 1; day <= 365; day += 1) {
    const from = new Date(2026, 0, day, 22).getTime();
    const parts = splitByDay(from, from + 5 * 60 * MIN);
    assert.equal(parts.length, 2);
    assert.equal(parts[0].day, dayKey(from));
    assert.ok(parts[0].day < parts[1].day);
    assert.equal(parts[0].ms + parts[1].ms, 5 * 60 * MIN);
  }
});

test('on every day of the year lastDays gives 7 consecutive days ending today', () => {
  const dayAfter = (key) => {
    const [year, month, date] = key.split('-').map(Number);
    return dayKey(new Date(year, month - 1, date + 1, 12).getTime());
  };
  for (let day = 1; day <= 365; day += 1) {
    const now = new Date(2026, 0, day, 0, 30).getTime();
    const keys = lastDays({}, now).map((bar) => bar.day);
    assert.equal(keys.length, 7);
    assert.equal(keys[6], dayKey(now));
    keys.slice(1).forEach((key, index) => assert.equal(key, dayAfter(keys[index])));
  }
});

test('pruneStats drops days outside the window ending today', () => {
  const stats = {
    '2026-01-08': { sessions: 1, focusMs: MIN },
    '2026-01-09': { sessions: 2, focusMs: MIN },
    '2026-01-15': { sessions: 3, focusMs: MIN },
  };
  assert.deepEqual(Object.keys(pruneStats(stats, at(15, 12))), ['2026-01-09', '2026-01-15']);
});

test('restoreStats keeps only well-formed days', () => {
  const restored = restoreStats({
    '2026-01-14': { sessions: 2, focusMs: 50 * MIN },
    '2026-01-15': { sessions: -1, focusMs: 0 },
    '2026-01-16': { sessions: 1, focusMs: 'lots' },
    'yesterday': { sessions: 1, focusMs: MIN },
    '2026-01-17': null,
  });
  assert.deepEqual(restored, { '2026-01-14': { sessions: 2, focusMs: 50 * MIN } });
  assert.deepEqual(restoreStats(null), {});
  assert.deepEqual(restoreStats(['2026-01-14']), {});
});
