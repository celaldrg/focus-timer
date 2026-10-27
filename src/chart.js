/**
 * Geometry of the 7-day bar chart, computed from the week data and the drawing size in CSS pixels.
 * Pure module: the SVG drawing itself lives in stats-view.js.
 */

/** @typedef {import('./stats.js').DayBar} DayBar */

/**
 * @typedef {DayBar & { isToday: boolean, x: number, y: number, width: number, height: number, centerX: number }} BarLayout
 *   one day's bar; x and y are its top-left corner
 */

/** Room above the plot for the value label of the tallest bar. */
export const VALUE_SPACE = 22;
/** Room under the baseline for the weekday labels. */
export const LABEL_SPACE = 24;
/** A day without focus time still gets a stub this tall, so every day is visible. */
export const MIN_BAR_HEIGHT = 3;
/** Bars never get wider than this, however wide the chart is. */
export const MAX_BAR_WIDTH = 34;

const BAR_SHARE = 0.6;

/**
 * Lays out one bar per day, oldest first; the last day is today. The tallest bar fills the plot height
 * and the others are scaled to it.
 * @param {DayBar[]} week
 * @param {number} width
 * @param {number} height
 * @returns {{ bars: BarLayout[], baseline: number }}
 */
export function layoutBars(week, width, height) {
  const baseline = height - LABEL_SPACE;
  const plotHeight = Math.max(0, baseline - VALUE_SPACE);
  const slot = week.length > 0 ? width / week.length : 0;
  const barWidth = Math.min(MAX_BAR_WIDTH, slot * BAR_SHARE);
  const most = Math.max(1, ...week.map((day) => day.minutes));
  const bars = week.map((day, index) => {
    const barHeight = Math.max(MIN_BAR_HEIGHT, (day.minutes / most) * plotHeight);
    const centerX = slot * (index + 0.5);
    return {
      ...day,
      isToday: index === week.length - 1,
      x: centerX - barWidth / 2,
      y: baseline - barHeight,
      width: barWidth,
      height: barHeight,
      centerX,
    };
  });
  return { bars, baseline };
}
