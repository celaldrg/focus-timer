import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/storage.js';

function memoryBackend() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

test('values survive a save and load round trip as JSON', () => {
  const backend = memoryBackend();
  const storage = createStorage(() => backend);
  assert.equal(storage.save('state', { a: 1, list: [true, null] }), true);
  assert.equal(backend.data.get('state'), '{"a":1,"list":[true,null]}');
  assert.deepEqual(storage.load('state', null), { a: 1, list: [true, null] });
});

test('missing keys and unreadable JSON give the fallback', () => {
  const backend = memoryBackend();
  const storage = createStorage(() => backend);
  assert.equal(storage.load('nothing', 'fallback'), 'fallback');
  backend.data.set('broken', '{not json');
  assert.equal(storage.load('broken', 'fallback'), 'fallback');
});

test('missing or blocked storage never throws (private mode, disabled cookies, full quota)', () => {
  const missing = createStorage(() => undefined);
  assert.equal(missing.load('key', 7), 7);
  assert.equal(missing.save('key', 1), false);

  const blocked = createStorage(() => { throw new Error('SecurityError'); });
  assert.equal(blocked.load('key', 7), 7);
  assert.equal(blocked.save('key', 1), false);

  const full = createStorage(() => ({
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
  }));
  assert.equal(full.load('key', 7), 7);
  assert.equal(full.save('key', 1), false);
});

test('the backend is looked up lazily, never when the helper is created', () => {
  let lookups = 0;
  const storage = createStorage(() => {
    lookups += 1;
    return memoryBackend();
  });
  assert.equal(lookups, 0);
  storage.load('key', null);
  assert.equal(lookups, 1);
});
