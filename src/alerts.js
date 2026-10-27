/**
 * Session-end alerts: a short chime made with the Web Audio API and an optional system notification.
 * Browsers only allow audio after a user gesture, so the audio context is created by `unlock`, which the
 * UI calls from click and key handlers. Not every key press is a gesture (Escape, for one), so `unlock`
 * also checks the browser's User Activation API where it exists. Notification permission is requested
 * only by an explicit call.
 */

/** @typedef {'granted' | 'denied' | 'default' | 'unsupported'} NotificationState */

const CHIME_NOTES = [
  { frequency: 880, delay: 0 },
  { frequency: 1318.5, delay: 0.16 },
  { frequency: 1760, delay: 0.32 },
];
const NOTE_PEAK = 0.22;
const NOTE_LENGTH = 1.3;

/**
 * Creates the chime. Nothing is created until `unlock` runs inside a user gesture; outside one it does
 * nothing, so the browser has no reason to warn that audio was not allowed to start.
 * @returns {{ unlock(): void, play(): void }}
 */
export function createChime() {
  let context = null;
  return {
    unlock() {
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContextClass || !insideUserGesture()) return;
      try {
        context ??= new AudioContextClass();
        if (context.state === 'suspended') context.resume().catch(() => {});
      } catch {
        context = null;
      }
    },
    play() {
      if (!context) return;
      if (context.state === 'running') ring(context);
      else context.resume().then(() => ring(context)).catch(() => {});
    },
  };
}

/**
 * The browser's notification permission, or 'unsupported'.
 * @returns {NotificationState}
 */
export function notificationState() {
  return 'Notification' in globalThis ? globalThis.Notification.permission : 'unsupported';
}

/**
 * Asks for notification permission. Call it only from a user action, such as turning the setting on.
 * @returns {Promise<NotificationState>}
 */
export async function requestNotificationPermission() {
  if (!('Notification' in globalThis)) return 'unsupported';
  try {
    return (await globalThis.Notification.requestPermission()) ?? globalThis.Notification.permission;
  } catch {
    return globalThis.Notification.permission;
  }
}

/**
 * Shows a system notification when permission was granted; clicking it brings the page back.
 * @param {string} title
 * @param {string} body
 * @returns {boolean} whether a notification was shown
 */
export function showNotification(title, body) {
  if (notificationState() !== 'granted') return false;
  try {
    const notification = new globalThis.Notification(title, { body, tag: 'focus-timer' });
    notification.addEventListener('click', () => {
      globalThis.focus();
      notification.close();
    });
    return true;
  } catch {
    return false;
  }
}

/** False only when the browser reports that no user gesture is under way; browsers without the API pass. */
function insideUserGesture() {
  return globalThis.navigator?.userActivation?.isActive ?? true;
}

function ring(context) {
  const start = context.currentTime + 0.02;
  for (const { frequency, delay } of CHIME_NOTES) playNote(context, frequency, start + delay);
}

function playNote(context, frequency, at) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(NOTE_PEAK, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_LENGTH);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + NOTE_LENGTH + 0.05);
}
