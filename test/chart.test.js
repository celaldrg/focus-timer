import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABEL_SPACE, MAX_BAR_WIDTH, MIN_BAR_HEIGHT, VALUE_SPACE, layoutBars } from '../src/chart.js';

/** Seven DayBars with the given focus minutes, oldest first. */
function week(minutes) {
  return minutes.map((value, index) => ({
    day: `2026-01-${String(index + 8).padStart(2, '0')}`,
    weekday: (index + 4) % 7,
    sessions: Math.round(value / 25),
    minutes: value,
  }));
}

test('the tallest bar fills the plot, the others scale to it, and all stand on the baseline', () => {
  const { bars, baseline } = layoutBars(week([125, 175, 100, 200, 150, 75, 50]), 350, 168);
  const plotHeight = baseline - VALUE_SPACE;
  assert.equal(baseline, 168 - LABEL_SPACE);
  assert.equal(bars[3].y, VALUE_SPACE);
  assert.equal(bars[3].height, plotHeight);
  assert.equal(bars[6].height, (50 / 200) * plotHeight);
  for (const bar of bars) assert.equal(bar.y + bar.height, baseline);
});

test('bars are centred in equal slots, oldest first, keep their day data, and only the last is today', () => {
  const { bars } = layoutBars(week([10, 20, 30, 40, 50, 60, 70]), 350, 168);
  assert.deepEqual(bars.map((bar) => bar.centerX), [25, 75, 125, 175, 225, 275, 325]);
  assert.deepEqual(bars.map((bar) => bar.isToday), [false, false, false, false, false, false, true]);
  assert.deepEqual(bars.map((bar) => bar.minutes), [10, 20, 30, 40, 50, 60, 70]);
  for (const bar of bars) assert.equal(bar.x + bar.width / 2, bar.centerX);
});

test('a bar takes 60 % of its slot, but never more than MAX_BAR_WIDTH', () => {
  const ones = week([1, 1, 1, 1, 1, 1, 1]);
  assert.equal(layoutBars(ones, 140, 168).bars[0].width, 12);
  assert.equal(layoutBars(ones, 1400, 168).bars[0].width, MAX_BAR_WIDTH);
});

test('days without focus time keep a visible stub, and an empty week gives no bars', () => {
  const { bars } = layoutBars(week([0, 0, 0, 0, 0, 0, 0]), 350, 168);
  for (const bar of bars) {
    assert.equal(bar.height, MIN_BAR_HEIGHT);
    assert.ok(Number.isFinite(bar.x) && Number.isFinite(bar.y));
  }
  assert.deepEqual(layoutBars([], 350, 168).bars, []);
});

test('a chart too small for its labels still gives bars of at least the stub height', () => {
  const { bars } = layoutBars(week([10, 0, 0, 0, 0, 0, 20]), 70, 30);
  for (const bar of bars) assert.ok(bar.height >= MIN_BAR_HEIGHT);
});
