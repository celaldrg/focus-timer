/**
 * Entry point: builds the app model (the saved state, or the fixed demo state with ?demo), connects the
 * views, the keyboard shortcuts and the language button, and keeps the screen in step with the clock.
 */
import { createFocusApp } from './app.js';
import { createStorage } from './storage.js';
import { createDemoState, demoTitleChanges } from './demo.js';
import { createTranslator, normalizeLanguage, otherLanguage } from './i18n.js';
import { endMessage, pageTitle, switchModeQuestion } from './labels.js';
import { selectModeDiscards } from './timer.js';
import { shortcutAction } from './shortcuts.js';
import { applyTranslations } from './dom.js';
import { createChime, showNotification } from './alerts.js';
import { createTimerView } from './timer-view.js';
import { createTasksView } from './tasks-view.js';
import { createStatsView } from './stats-view.js';
import { createSettingsDialog } from './settings-dialog.js';
import { createConfirmDialog } from './confirm-dialog.js';

/** Storage key of the chosen interface language. */
const LANGUAGE_KEY = 'focus-timer:lang';
/** How often the clock face is brought up to date. */
const TICK_MS = 250;
/**
 * A session that ended longer ago than this (the page was closed, or the device slept) ends quietly.
 * It is longer than a minute because hidden tabs may run their timers only once a minute.
 */
const STALE_END_MS = 120_000;
/** Fields where letters and spaces type text, so shortcuts stay off. */
const TEXT_FIELDS = 'textarea, input:not([type="checkbox"]):not([type="radio"])';
/** Controls that Space presses or toggles by itself. */
const SPACE_CONTROLS = 'button, a[href], input, summary';

const storage = createStorage();
const isDemo = new URLSearchParams(window.location.search).has('demo');
let language = normalizeLanguage(storage.load(LANGUAGE_KEY, null));
let t = createTranslator(language);
// The demo neither loads nor saves the app state, so a visitor's own sessions and tasks stay untouched.
const app = isDemo
  ? createFocusApp({ initialState: createDemoState(Date.now(), language) })
  : createFocusApp({ storage });
const chime = createChime();
const announcer = document.querySelector('#announcer');
/** True when the latest focus change came from a pointer; Space then toggles the timer everywhere. */
let pointerFocus = false;
/** The one-shot timeout armed for the end of the running session: { endsAt, id }. */
let endTimer = null;

const confirmDialog = createConfirmDialog(document.querySelector('#confirm-dialog'));
const timerActions = {
  toggle: timerAction(app.toggle),
  skip: timerAction(app.skip),
  reset: timerAction(app.reset),
  selectMode: askBeforeDiscarding(timerAction(app.selectMode)),
};
const timerView = createTimerView(document, timerActions);
const tasksView = createTasksView(document, {
  addTask: change(app.addTask),
  editTask: change(app.editTask),
  setTaskDone: change(app.setTaskDone),
  deleteTask: change(app.deleteTask),
  reinsertTask: change(app.reinsertTask),
  selectTask: change(app.selectTask),
});
const statsView = createStatsView(document);
const settingsDialog = createSettingsDialog(document.querySelector('#settings-dialog'), {
  onSave: change(app.updateSettings),
  onSoundPreview() {
    chime.unlock();
    chime.play();
  },
});

document.querySelector('#settings-button').addEventListener('click', () => {
  settingsDialog.open(app.getState().settings, t);
});
document.querySelector('#lang-button').addEventListener('click', () => setLanguage(otherLanguage(language)));
document.addEventListener('keydown', onShortcut);
document.addEventListener('pointerdown', () => { pointerFocus = true; }, true);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') pointerFocus = false;
}, true);
// Browsers allow sound only after a user gesture, so the chime is unlocked in click and key events;
// unlock itself skips the ones that are no gesture, such as a first press of Escape.
for (const type of ['click', 'keydown']) document.addEventListener(type, unlockSound, true);
document.addEventListener('visibilitychange', update);

applyLanguage();
update();
setInterval(update, TICK_MS);

/** Wraps a timer action: run it, report a session that ended just before it, redraw. */
function timerAction(action) {
  return (...args) => {
    report(action(...args));
    render();
  };
}

/**
 * Wraps the mode tabs' action: a switch that would throw away a running or paused session (it is not
 * counted) happens only after the visitor confirms it. The timer is brought up to date first, so a
 * session that has just run out is completed and counted instead of asked about. If the session asked
 * about ends while the question is open (and auto-start begins the next one), the answer no longer
 * applies, so the switch is checked again.
 */
function askBeforeDiscarding(selectMode) {
  const ask = (mode) => {
    update();
    const view = app.getView();
    if (!selectModeDiscards(view, mode)) selectMode(mode);
    else confirmDialog.ask(switchModeQuestion(view, mode, t), () => {
      update();
      const now = app.getView();
      if (now.mode === view.mode && now.cycle === view.cycle) selectMode(mode);
      else ask(mode);
    });
  };
  return ask;
}

/** Wraps a task or settings change: apply it, redraw. */
function change(action) {
  return (...args) => {
    action(...args);
    render();
  };
}

function update() {
  report(app.tick());
  render();
}

function render() {
  const view = app.getView();
  timerView.render(view, t);
  tasksView.render(view, t);
  statsView.render(view, t);
  const title = pageTitle(view, t);
  if (document.title !== title) document.title = title;
  armEndTimer(view);
}

/**
 * Hidden tabs run intervals rarely, so a one-shot timeout is set for the exact end of a running session.
 * It is replaced only when that end time moves (start, pause, skip, a new session).
 */
function armEndTimer(view) {
  const endsAt = view.status === 'running' ? Date.now() + view.remainingMs : null;
  if (endTimer && endsAt !== null && Math.abs(endTimer.endsAt - endsAt) < 1000) return;
  clearTimeout(endTimer?.id);
  endTimer = null;
  if (endsAt === null) return;
  const id = setTimeout(() => {
    endTimer = null;
    update();
  }, view.remainingMs + 20);
  endTimer = { endsAt, id };
}

/** Announces a session that has just ended, with the chime and, when the page is not in front, a notification. */
function report(ended) {
  if (!ended || Date.now() - ended.endedAt > STALE_END_MS) return;
  const { title, body } = endMessage(ended, t);
  announcer.replaceChildren(`${title}. ${body}`);
  const { settings } = app.getState();
  if (settings.sound) chime.play();
  if (settings.notifications && (document.hidden || !document.hasFocus())) showNotification(title, body);
}

function unlockSound() {
  if (app.getState().settings.sound) chime.unlock();
}

function onShortcut(event) {
  const action = shortcutAction(event, describeFocus(event.target));
  if (!action) return;
  event.preventDefault();
  timerActions[action]();
}

function describeFocus(target) {
  const element = target instanceof Element ? target : document.body;
  return {
    typing: element.isContentEditable || element.closest(TEXT_FIELDS) !== null,
    onControl: !pointerFocus && element.closest(SPACE_CONTROLS) !== null,
    dialogOpen: document.querySelector('dialog[open]') !== null,
  };
}

function setLanguage(next) {
  if (isDemo) {
    for (const { id, title } of demoTitleChanges(app.getState().tasks.items, language, next)) {
      app.editTask(id, { title });
    }
  }
  language = next;
  t = createTranslator(next);
  storage.save(LANGUAGE_KEY, next);
  applyLanguage();
  render();
}

/** Puts the current language on <html lang> and on every static string of the page. */
function applyLanguage() {
  document.documentElement.lang = language;
  applyTranslations(document, t);
}
