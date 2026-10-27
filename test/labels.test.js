import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeTask, cycleDots, endMessage, pageTitle, primaryActionKey, statusKey, switchModeQuestion,
} from '../src/labels.js';
import { MESSAGES, createTranslator } from '../src/i18n.js';

const en = createTranslator('en');
const MIN = 60_000;

/** A view as createFocusApp().getView() returns it, with only the fields these helpers read. */
function view(overrides = {}) {
  return {
    mode: 'focus',
    status: 'idle',
    cycle: 0,
    remainingMs: 25 * MIN,
    nextMode: 'short',
    settings: { longBreakInterval: 4 },
    tasks: [],
    activeTaskId: null,
    ...overrides,
  };
}

describe('button and status keys', () => {
  test('the main button follows the timer status and names the session that comes next', () => {
    assert.equal(primaryActionKey(view({ status: 'idle' })), 'start');
    assert.equal(primaryActionKey(view({ status: 'running' })), 'pause');
    assert.equal(primaryActionKey(view({ status: 'paused' })), 'resume');
    assert.equal(primaryActionKey(view({ status: 'finished', nextMode: 'short' })), 'startBreak');
    assert.equal(primaryActionKey(view({ status: 'finished', nextMode: 'long' })), 'startBreak');
    assert.equal(primaryActionKey(view({ mode: 'short', status: 'finished', nextMode: 'focus' })), 'startFocus');
  });

  test('the ring names the mode while running, otherwise the state', () => {
    assert.equal(statusKey(view({ status: 'running', mode: 'long' })), 'modeLong');
    assert.equal(statusKey(view({ status: 'idle' })), 'statusReady');
    assert.equal(statusKey(view({ status: 'paused' })), 'statusPaused');
    assert.equal(statusKey(view({ status: 'finished' })), 'statusFinished');
  });

  test('every key these helpers return exists in both languages', () => {
    for (const status of ['idle', 'running', 'paused', 'finished']) {
      for (const mode of ['focus', 'short', 'long']) {
        for (const nextMode of ['focus', 'short', 'long']) {
          const current = view({ status, mode, nextMode });
          for (const key of [primaryActionKey(current), statusKey(current)]) {
            assert.ok(key in MESSAGES.en && key in MESSAGES.tr, `${status}/${mode}/${nextMode}: ${key}`);
          }
        }
      }
    }
  });
});

describe('cycle dots', () => {
  test('one dot per focus session before the long break; the session under way is current', () => {
    assert.deepEqual(cycleDots(view({ status: 'running', cycle: 2 })), ['done', 'done', 'current', 'todo']);
    assert.deepEqual(cycleDots(view({ cycle: 0 })), ['current', 'todo', 'todo', 'todo']);
  });

  test('breaks and finished sessions have no current dot', () => {
    assert.deepEqual(cycleDots(view({ mode: 'short', cycle: 1 })), ['done', 'todo', 'todo', 'todo']);
    assert.deepEqual(cycleDots(view({ status: 'finished', cycle: 3 })), ['done', 'done', 'done', 'todo']);
  });

  test('a cycle past the interval (the interval was lowered) shows every dot done', () => {
    assert.deepEqual(cycleDots(view({ cycle: 6, settings: { longBreakInterval: 2 } })), ['done', 'done']);
  });
});

describe('texts', () => {
  test('the page title shows the time left, the status and the app name', () => {
    assert.equal(pageTitle(view({ status: 'running', remainingMs: 9 * MIN + 59_500 }), en), '10:00 · Focus – Focus Timer');
    assert.equal(
      pageTitle(view({ status: 'paused', remainingMs: 61_000 }), createTranslator('tr')),
      '01:01 · Duraklatıldı – Odak Zamanlayıcısı',
    );
  });

  test('the end message says what ended and what comes next', () => {
    assert.deepEqual(endMessage({ mode: 'focus', nextMode: 'short', endedAt: 0 }, en), {
      title: 'Focus session complete',
      body: 'Time for a short break.',
    });
    assert.equal(endMessage({ mode: 'focus', nextMode: 'long', endedAt: 0 }, en).body, 'Time for a long break.');
    assert.deepEqual(endMessage({ mode: 'long', nextMode: 'focus', endedAt: 0 }, en), {
      title: 'Break is over',
      body: 'Ready to focus again?',
    });
  });

  test('the mode-switch question names the new mode and says what is lost', () => {
    assert.deepEqual(switchModeQuestion(view({ status: 'running' }), 'short', en), {
      title: 'Switch to Short break?',
      body: 'The focus session in progress ends here and its time is not counted.',
      confirm: 'Switch',
    });
    assert.deepEqual(switchModeQuestion(view({ mode: 'long', status: 'paused' }), 'focus', createTranslator('tr')), {
      title: 'Odak oturumuna geçilsin mi?',
      body: 'Süren mola burada biter.',
      confirm: 'Geçiş yap',
    });
  });

  test('activeTask finds the active task, or gives null', () => {
    const tasks = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }];
    assert.equal(activeTask(view({ tasks, activeTaskId: 2 })).title, 'B');
    assert.equal(activeTask(view({ tasks, activeTaskId: null })), null);
  });
});
