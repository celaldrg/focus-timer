/**
 * Keyboard shortcuts: Space starts or pauses, S skips, R resets. A pure mapping from a key event and the
 * place it happened to a timer action, so the rules can be tested without a browser.
 */

/** @typedef {'toggle' | 'skip' | 'reset'} ShortcutAction */

/**
 * @typedef {object} KeyContext
 * @property {boolean} typing      focus is in a text field, where keys type text
 * @property {boolean} onControl   focus is on a control reached by keyboard, where Space activates that control
 * @property {boolean} dialogOpen  a modal dialog is open
 */

const LETTER_ACTIONS = Object.freeze({ s: 'skip', r: 'reset' });

/**
 * The timer action for a keydown, or null when the key keeps its normal meaning. Held-down keys and
 * key combinations with Ctrl, Alt or Meta never trigger an action.
 * @param {{ key: string, repeat?: boolean, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean }} event
 * @param {KeyContext} context
 * @returns {ShortcutAction | null}
 */
export function shortcutAction(event, context) {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null;
  if (context.typing || context.dialogOpen) return null;
  if (event.key === ' ' || event.key === 'Spacebar') return context.onControl ? null : 'toggle';
  return LETTER_ACTIONS[String(event.key).toLowerCase()] ?? null;
}
