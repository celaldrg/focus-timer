/**
 * The settings dialog: session lengths, the long-break interval and the switches for auto-start, the chime
 * and notifications. Notification permission is requested only when the visitor turns that switch on, and
 * turning the sound on plays the chime once as a preview.
 */
import { SETTING_LIMITS } from './settings.js';
import { notificationState, requestNotificationPermission } from './alerts.js';
import { setText } from './dom.js';

/** @typedef {import('./settings.js').Settings} Settings */
/** @typedef {import('./i18n.js').Translate} Translate */

const NUMBER_FIELDS = Object.keys(SETTING_LIMITS);
const SWITCH_FIELDS = ['autoStartBreaks', 'autoStartFocus', 'sound', 'notifications'];
const NOTIFICATION_HINTS = { denied: 'notifyBlocked', unsupported: 'notifyUnsupported' };

/**
 * Connects the settings dialog.
 * @param {HTMLDialogElement} dialog
 * @param {object} handlers
 * @param {(changes: Partial<Record<keyof Settings, string | boolean>>) => void} handlers.onSave
 *   receives the form values; empty number fields are left out so they keep their current value
 * @param {() => void} handlers.onSoundPreview
 * @returns {{ open(settings: Settings, t: Translate): void }}
 */
export function createSettingsDialog(dialog, { onSave, onSoundPreview }) {
  const form = dialog.querySelector('form');
  const field = (name) => form.elements.namedItem(name);
  const hint = dialog.querySelector('#notify-hint');
  let t = null;

  /** Shows why notifications cannot be used for this permission state; null hides the hint. */
  const showHint = (state) => {
    const key = NOTIFICATION_HINTS[state];
    hint.hidden = !key;
    setText(hint, key ? t(key) : '');
  };

  for (const name of NUMBER_FIELDS) Object.assign(field(name), SETTING_LIMITS[name]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onSave(readForm(field));
    dialog.close();
  });
  form.querySelector('[data-role="cancel"]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  field('sound').addEventListener('change', (event) => {
    if (event.target.checked) onSoundPreview();
  });
  field('notifications').addEventListener('change', async (event) => {
    const toggle = event.target;
    if (!toggle.checked) {
      showHint(null);
      return;
    }
    const state = notificationState() === 'default' ? await requestNotificationPermission() : notificationState();
    toggle.checked = state === 'granted';
    showHint(state);
  });

  return {
    open(settings, translator) {
      t = translator;
      const state = notificationState();
      for (const name of NUMBER_FIELDS) field(name).value = String(settings[name]);
      for (const name of SWITCH_FIELDS) field(name).checked = settings[name];
      // The switch shows whether notifications can really appear, so a permission taken back in the
      // browser shows as off (with the reason) instead of a switch that is on but silent.
      field('notifications').disabled = state === 'unsupported';
      field('notifications').checked = settings.notifications && state === 'granted';
      showHint(settings.notifications || state === 'unsupported' ? state : null);
      if (!dialog.open) dialog.showModal();
    },
  };
}

function readForm(field) {
  const changes = {};
  for (const name of NUMBER_FIELDS) {
    const { value } = field(name);
    if (value.trim() !== '' && Number.isFinite(Number(value))) changes[name] = value;
  }
  for (const name of SWITCH_FIELDS) changes[name] = field(name).checked;
  return changes;
}
