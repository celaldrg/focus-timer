/**
 * The timer card: mode buttons, the progress ring with the remaining time, the cycle dots, the active task
 * and the Start/Pause, Skip and Reset buttons. A tap on the ring also starts or pauses; it is handled with
 * pointer events, so mouse, touch and pen behave the same.
 *
 * The coloured arc is the time that is left. Its moving end carries a knob that travels clockwise from
 * 12 o'clock like a clock hand, so the arc shrinks as the session runs.
 */
import { formatClock } from './timer.js';
import { MODE_KEYS, activeTask, cycleDots, primaryActionKey, statusKey } from './labels.js';
import { el, setAttr, setText } from './dom.js';

/** @typedef {import('./app.js').View} View */
/** @typedef {import('./i18n.js').Translate} Translate */

/**
 * @typedef {object} TimerActions
 * @property {() => void} toggle
 * @property {() => void} skip
 * @property {() => void} reset
 * @property {(mode: import('./settings.js').Mode) => void} selectMode
 */

const RING_RADIUS = 144;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/** A press that moves further than this is a drag or a scroll, not a tap. */
const TAP_SLOP_PX = 10;

/**
 * Connects the timer card's markup to the actions and returns its renderer.
 * @param {ParentNode} root  the document, or any node that contains #timer-card
 * @param {TimerActions} actions
 * @returns {{ render(view: View, t: Translate): void }}
 */
export function createTimerView(root, actions) {
  const card = root.querySelector('#timer-card');
  const parts = findParts(card);
  parts.progress.style.strokeDasharray = `${RING_LENGTH}`;
  wireControls(parts, actions);
  let shownDots = { key: '', t: null };

  return {
    render(view, t) {
      setAttr(card, 'data-mode', view.mode);
      setAttr(card, 'data-status', view.status);
      for (const button of parts.modeButtons) {
        setAttr(button, 'aria-pressed', String(button.dataset.mode === view.mode));
      }
      drawRing(parts, view.progress);
      const clock = formatClock(view.remainingMs);
      setText(parts.time, clock);
      parts.time.classList.toggle('has-hours', clock.length > 5);
      setText(parts.status, t(statusKey(view)));
      setText(parts.next, t('upNext', { mode: t(MODE_KEYS[view.nextMode]) }));
      setText(parts.toggleLabel, t(primaryActionKey(view)));
      setAttr(parts.toggle, 'data-state', view.status === 'running' ? 'pause' : 'play');
      drawCurrentTask(parts, view, t);
      const dots = cycleDots(view);
      if (dots.join() !== shownDots.key || t !== shownDots.t) {
        drawCycle(parts.cycle, dots, t);
        shownDots = { key: dots.join(), t };
      }
      if (!card.classList.contains('is-ready')) enableRingMotion(card);
    },
  };
}

/**
 * Lets the ring animate from the second draw on. Measuring the card first makes the browser apply the first
 * position while transitions are still off, so the ring opens in place instead of sweeping in.
 */
function enableRingMotion(card) {
  card.getBoundingClientRect();
  card.classList.add('is-ready');
}

function findParts(card) {
  const find = (selector) => card.querySelector(selector);
  return {
    modeButtons: [...card.querySelectorAll('.mode-tab')],
    dial: find('#dial'),
    progress: find('#ring-progress'),
    knob: find('#ring-knob'),
    status: find('#dial-status'),
    time: find('#dial-time'),
    next: find('#dial-next'),
    cycle: find('#cycle'),
    currentTask: find('#current-task'),
    currentLabel: find('#current-label'),
    currentTitle: find('#current-title'),
    toggle: find('#toggle-button'),
    toggleLabel: find('#toggle-label'),
    skip: find('#skip-button'),
    reset: find('#reset-button'),
  };
}

function wireControls(parts, actions) {
  for (const button of parts.modeButtons) {
    button.addEventListener('click', () => actions.selectMode(button.dataset.mode));
  }
  parts.toggle.addEventListener('click', () => actions.toggle());
  parts.skip.addEventListener('click', () => actions.skip());
  parts.reset.addEventListener('click', () => actions.reset());
  onTap(parts.dial, () => actions.toggle());
}

/**
 * Calls `handler` when a pointer goes down and up on `target` without moving away. A scroll that starts
 * on the target makes the browser cancel the pointer, so it never counts as a tap.
 */
function onTap(target, handler) {
  let press = null;
  target.addEventListener('pointerdown', (event) => {
    press = event.isPrimary && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  target.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.id) return;
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (moved <= TAP_SLOP_PX) handler();
  });
  for (const type of ['pointercancel', 'pointerleave']) {
    target.addEventListener(type, () => { press = null; });
  }
}

/** Shortens the arc to the share of time left and turns the knob (drawn at 12 o'clock) to the arc's start. */
function drawRing({ progress, knob }, share) {
  const done = Math.min(1, Math.max(0, share));
  progress.style.strokeDashoffset = (-RING_LENGTH * done).toFixed(2);
  knob.style.transform = `rotate(${(done * 360).toFixed(2)}deg)`;
}

function drawCurrentTask(parts, view, t) {
  const task = activeTask(view);
  parts.currentTask.classList.toggle('is-empty', !task);
  setText(parts.currentLabel, task ? t('workingOn') : '');
  setText(parts.currentTitle, task ? task.title : t(view.tasks.length > 0 ? 'allTasksDone' : 'noTasks'));
}

function drawCycle(container, dots, t) {
  container.replaceChildren(...dots.map((dot) => el('span', { className: `cycle-dot is-${dot}` })));
  const done = dots.filter((dot) => dot === 'done').length;
  const label = t('cycleLabel', { done, total: dots.length });
  container.setAttribute('aria-label', label);
  container.title = label;
}
