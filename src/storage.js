/**
 * Safe JSON storage on top of Web Storage. Storage may be missing, blocked (private mode, disabled
 * cookies, sandboxed frames) or full; every access is wrapped in try/catch so none of that can crash the
 * app. This is the only module that touches localStorage, and only when load or save is called.
 */

/**
 * @typedef {object} SafeStorage
 * @property {(key: string, fallback: any) => any} load  parsed value, or `fallback` when missing or unreadable
 * @property {(key: string, value: unknown) => boolean} save  true when the value was written
 */

/**
 * Creates the storage helper.
 * @param {() => (Pick<Storage, 'getItem' | 'setItem'> | null | undefined)} [getBackend]
 *   looked up on every call (never at import time); defaults to the browser's localStorage
 * @returns {SafeStorage}
 */
export function createStorage(getBackend = () => globalThis.localStorage) {
  return {
    load(key, fallback) {
      try {
        const raw = getBackend()?.getItem(key);
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    save(key, value) {
      try {
        const backend = getBackend();
        if (!backend) return false;
        backend.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}
