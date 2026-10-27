import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, SETTING_LIMITS, normalizeSettings, sessionLengthMs, startsAutomatically,
} from '../src/settings.js';

const MIN = 60_000;

test('defaults are 25 / 5 / 15 minutes with a long break after 4 focus sessions', () => {
  assert.equal(DEFAULT_SETTINGS.focusMinutes, 25);
  assert.equal(DEFAULT_SETTINGS.shortBreakMinutes, 5);
  assert.equal(DEFAULT_SETTINGS.longBreakMinutes, 15);
  assert.equal(DEFAULT_SETTINGS.longBreakInterval, 4);
  assert.equal(DEFAULT_SETTINGS.autoStartBreaks, false);
  assert.equal(DEFAULT_SETTINGS.autoStartFocus, false);
  assert.equal(DEFAULT_SETTINGS.sound, true);
});

test('missing or unusable input gives the defaults', () => {
  for (const input of [undefined, null, 'x', 42, [], {}]) {
    assert.deepEqual(normalizeSettings(input), { ...DEFAULT_SETTINGS });
  }
});

test('numbers are rounded and clamped, numeric strings accepted, junk falls back to the default', () => {
  const settings = normalizeSettings({
    focusMinutes: '50',
    shortBreakMinutes: 0,
    longBreakMinutes: 999,
    longBreakInterval: 2.6,
  });
  assert.equal(settings.focusMinutes, 50);
  assert.equal(settings.shortBreakMinutes, SETTING_LIMITS.shortBreakMinutes.min);
  assert.equal(settings.longBreakMinutes, SETTING_LIMITS.longBreakMinutes.max);
  assert.equal(settings.longBreakInterval, 3);

  const junk = normalizeSettings({ focusMinutes: '', shortBreakMinutes: 'abc', longBreakMinutes: NaN, longBreakInterval: null });
  assert.equal(junk.focusMinutes, 25);
  assert.equal(junk.shortBreakMinutes, 5);
  assert.equal(junk.longBreakMinutes, 15);
  assert.equal(junk.longBreakInterval, 4);
});

test('switches only accept real booleans', () => {
  const settings = normalizeSettings({ autoStartBreaks: true, autoStartFocus: 'yes', sound: false, notifications: 1 });
  assert.equal(settings.autoStartBreaks, true);
  assert.equal(settings.autoStartFocus, false);
  assert.equal(settings.sound, false);
  assert.equal(settings.notifications, false);
});

test('normalizing does not touch the input and drops unknown keys', () => {
  const input = { focusMinutes: 30, extra: 'ignored' };
  const settings = normalizeSettings(input);
  assert.deepEqual(input, { focusMinutes: 30, extra: 'ignored' });
  assert.equal('extra' in settings, false);
});

test('session length and auto-start are looked up per mode', () => {
  const settings = normalizeSettings({ focusMinutes: 40, shortBreakMinutes: 7, longBreakMinutes: 20, autoStartBreaks: true });
  assert.equal(sessionLengthMs('focus', settings), 40 * MIN);
  assert.equal(sessionLengthMs('short', settings), 7 * MIN);
  assert.equal(sessionLengthMs('long', settings), 20 * MIN);
  assert.equal(startsAutomatically('short', settings), true);
  assert.equal(startsAutomatically('long', settings), true);
  assert.equal(startsAutomatically('focus', settings), false);
});
