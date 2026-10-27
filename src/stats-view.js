/**
 * The weekly statistics: totals for today and for the last 7 days, and an SVG bar chart of focus minutes
 * per day. The chart is drawn at the pixel size of its box, so its labels keep the same size on every screen.
 */
import { formatMinutes } from './i18n.js';
import { layoutBars } from './chart.js';
import { setText, svgEl } from './dom.js';

/** @typedef {import('./app.js').View} View */
/** @typedef {import('./i18n.js').Translate} Translate */
/** @typedef {import('./stats.js').DayBar} DayBar */

const DAY_LABEL_OFFSET = 17;
const VALUE_LABEL_GAP = 7;
const BAR_RADIUS = 6;

/**
 * Finds the statistics panel's elements and returns its renderer.
 * @param {ParentNode} root  the document, or any node that contains the statistics panel
 * @returns {{ render(view: View, t: Translate): void }}
 */
export function createStatsView(root) {
  const ui = {
    chart: root.querySelector('#chart'),
    todayTime: root.querySelector('#today-time'),
    todaySessions: root.querySelector('#today-sessions'),
    weekTime: root.querySelector('#week-time'),
    weekSessions: root.querySelector('#week-sessions'),
  };
  let shown = { key: '', t: null };
  let size = { width: 0, height: 0 };

  const drawChart = () => {
    if (!shown.t || size.width === 0 || size.height === 0) return;
    ui.chart.replaceChildren(chartSvg(shown.week, size, shown.t));
  };

  new ResizeObserver(() => {
    const next = { width: Math.floor(ui.chart.clientWidth), height: Math.floor(ui.chart.clientHeight) };
    if (next.width === size.width && next.height === size.height) return;
    size = next;
    drawChart();
  }).observe(ui.chart);

  return {
    render(view, t) {
      const key = JSON.stringify(view.week);
      if (key === shown.key && t === shown.t) return;
      shown = { key, t, week: view.week };
      drawTotals(ui, view.week, t);
      drawChart();
    },
  };
}

function drawTotals(ui, week, t) {
  const today = week[week.length - 1];
  const minutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const sessions = week.reduce((sum, day) => sum + day.sessions, 0);
  setText(ui.todayTime, formatMinutes(t, today.minutes));
  setText(ui.todaySessions, t('sessions', { count: today.sessions }));
  setText(ui.weekTime, formatMinutes(t, minutes));
  setText(ui.weekSessions, t('sessions', { count: sessions }));
}

/** @param {DayBar[]} week @param {{ width: number, height: number }} size @param {Translate} t */
function chartSvg(week, { width, height }, t) {
  const { bars, baseline } = layoutBars(week, width, height);
  const summary = bars.map((bar) => `${t(`weekday${bar.weekday}`)} ${formatMinutes(t, bar.minutes)}`).join(', ');
  return svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: 'img',
    'aria-label': `${t('chartLabel')}: ${summary}`,
  }, [
    svgEl('line', { class: 'chart-base', x1: 0, x2: width, y1: baseline + 0.5, y2: baseline + 0.5 }),
    ...bars.map((bar) => barGroup(bar, baseline, t)),
  ]);
}

function barGroup(bar, baseline, t) {
  const day = t(`weekday${bar.weekday}`);
  const tooltip = t('barTitle', {
    day,
    time: formatMinutes(t, bar.minutes),
    sessions: t('sessions', { count: bar.sessions }),
  });
  const children = [
    svgEl('title', {}, [tooltip]),
    svgEl('rect', {
      x: round(bar.x),
      y: round(bar.y),
      width: round(bar.width),
      height: round(bar.height),
      rx: Math.min(BAR_RADIUS, round(bar.width / 2)),
    }),
    svgEl('text', { class: 'bar-day', x: round(bar.centerX), y: baseline + DAY_LABEL_OFFSET }, [day]),
  ];
  if (bar.minutes > 0) {
    children.push(svgEl('text', { class: 'bar-value', x: round(bar.centerX), y: round(bar.y - VALUE_LABEL_GAP) }, [String(bar.minutes)]));
  }
  return svgEl('g', { class: bar.isToday ? 'bar is-today' : 'bar' }, children);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
