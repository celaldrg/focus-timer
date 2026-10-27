import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createChime } from '../src/alerts.js';

/** Node has no Web Audio, so a fake AudioContext records what the chime does with it. */
let contexts = [];

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.resumeCalls = 0;
    contexts.push(this);
  }

  resume() {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }
}

const nodeNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

/** Stands in for the browser's navigator.userActivation; undefined plays a browser without that API. */
function setUserActivation(userActivation) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userActivation } });
}

beforeEach(() => {
  contexts = [];
  globalThis.AudioContext = FakeAudioContext;
});

afterEach(() => {
  delete globalThis.AudioContext;
  if (nodeNavigator) Object.defineProperty(globalThis, 'navigator', nodeNavigator);
  else delete globalThis.navigator;
});

test('unlock starts no audio outside a user gesture, such as a first press of Escape', () => {
  setUserActivation({ isActive: false, hasBeenActive: false });
  createChime().unlock();
  assert.equal(contexts.length, 0);
});

test('unlock creates the audio context once inside a user gesture and resumes it only while suspended', () => {
  setUserActivation({ isActive: true, hasBeenActive: true });
  const chime = createChime();
  chime.unlock();
  chime.unlock();
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumeCalls, 1);
  assert.equal(contexts[0].state, 'running');
});

test('browsers without the User Activation API still unlock from click and key handlers', () => {
  setUserActivation(undefined);
  createChime().unlock();
  assert.equal(contexts.length, 1);
});
