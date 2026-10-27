/**
 * Timer settings: defaults, validation and per-mode lookups.
 * Pure module: no DOM and no storage access.
 */

/**
 * @typedef {'focus' | 'short' | 'long'} Mode
 */

/**
 * @typedef {object} Settings
 * @property {number} focusMinutes       length of a focus session
 * @property {number} shortBreakMinutes  length of a short break
 * @property {number} longBreakMinutes   length of a long break
 * @property {number} longBreakInterval  completed focus sessions before a long break
 * @property {boolean} autoStartBreaks   start a break by itself when a focus session ends
 * @property {boolean} autoStartFocus    start a focus session by itself when a break ends
 * @property {boolean} sound             play a chime when a session ends
 * @property {boolean} notifications     show a system notification when a session ends
 */

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  sound: true,
  notifications: false,
});

/** Inclusive bounds of the numeric settings (handy for the min/max of form inputs). */
export const SETTING_LIMITS = Object.freeze({
  focusMinutes: Object.freeze({ min: 1, max: 180 }),
  shortBreakMinutes: Object.freeze({ min: 1, max: 60 }),
  longBreakMinutes: Object.freeze({ min: 1, max: 90 }),
  longBreakInterval: Object.freeze({ min: 1, max: 12 }),
});

const BOOLEAN_KEYS = ['autoStartBreaks', 'autoStartFocus', 'sound', 'notifications'];

const MINUTES_KEY_BY_MODE = { focus: 'focusMinutes', short: 'shortBreakMinutes', long: 'longBreakMinutes' };

const MINUTE_MS = 60_000;

/**
 * Builds a complete, valid settings object from untrusted input such as a saved snapshot or form values.
 * Numbers and numeric strings are rounded and clamped to SETTING_LIMITS; booleans must be real booleans.
 * Anything missing or invalid falls back to its default.
 * @param {unknown} [input]
 * @returns {Settings}
 */
export function normalizeSettings(input) {
  const source = typeof input === 'object' && input !== null ? input : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const [key, { min, max }] of Object.entries(SETTING_LIMITS)) {
    settings[key] = toBoundedInteger(source[key], min, max, DEFAULT_SETTINGS[key]);
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof source[key] === 'boolean') settings[key] = source[key];
  }
  return settings;
}

/**
 * Full length of a session of the given mode.
 * @param {Mode} mode
 * @param {Settings} settings
 * @returns {number} milliseconds
 */
export function sessionLengthMs(mode, settings) {
  return settings[MINUTES_KEY_BY_MODE[mode]] * MINUTE_MS;
}

/**
 * Whether a session of the given mode starts by itself when the session before it ends.
 * @param {Mode} mode
 * @param {Settings} settings
 * @returns {boolean}
 */
export function startsAutomatically(mode, settings) {
  return mode === 'focus' ? settings.autoStartFocus : settings.autoStartBreaks;
}

function toBoundedInteger(value, min, max, fallback) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}
