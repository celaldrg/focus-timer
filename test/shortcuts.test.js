import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutAction } from '../src/shortcuts.js';

const FREE = { typing: false, onControl: false, dialogOpen: false };

test('Space starts or pauses, S skips and R resets, in either case', () => {
  assert.equal(shortcutAction({ key: ' ' }, FREE), 'toggle');
  assert.equal(shortcutAction({ key: 'Spacebar' }, FREE), 'toggle');
  assert.equal(shortcutAction({ key: 's' }, FREE), 'skip');
  assert.equal(shortcutAction({ key: 'S' }, FREE), 'skip');
  assert.equal(shortcutAction({ key: 'r' }, FREE), 'reset');
  assert.equal(shortcutAction({ key: 'R' }, FREE), 'reset');
});

test('other keys keep their normal meaning', () => {
  for (const key of ['Enter', 'Tab', 'Escape', 'a', 'ArrowUp', '1']) {
    assert.equal(shortcutAction({ key }, FREE), null, key);
  }
});

test('no shortcut fires while typing or while a dialog is open', () => {
  for (const key of [' ', 's', 'r']) {
    assert.equal(shortcutAction({ key }, { ...FREE, typing: true }), null);
    assert.equal(shortcutAction({ key }, { ...FREE, dialogOpen: true }), null);
  }
});

test('on a control reached by keyboard, Space presses that control while S and R still work', () => {
  const onControl = { ...FREE, onControl: true };
  assert.equal(shortcutAction({ key: ' ' }, onControl), null);
  assert.equal(shortcutAction({ key: 's' }, onControl), 'skip');
  assert.equal(shortcutAction({ key: 'r' }, onControl), 'reset');
});

test('held keys and browser shortcuts such as Ctrl+R are left alone', () => {
  assert.equal(shortcutAction({ key: ' ', repeat: true }, FREE), null);
  assert.equal(shortcutAction({ key: 'r', ctrlKey: true }, FREE), null);
  assert.equal(shortcutAction({ key: 'r', metaKey: true }, FREE), null);
  assert.equal(shortcutAction({ key: 's', altKey: true }, FREE), null);
});
