import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGES, MESSAGES, createTranslator, formatMinutes, normalizeLanguage, otherLanguage, translate,
} from '../src/i18n.js';

/** The {placeholders} an entry uses, over all of its plural forms. */
function placeholders(entry) {
  const texts = typeof entry === 'string' ? [entry] : Object.values(entry);
  const names = texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]));
  return [...new Set(names)].sort();
}

describe('message tables', () => {
  test('English and Turkish have the same keys with the same placeholders', () => {
    assert.deepEqual(Object.keys(MESSAGES.tr).sort(), Object.keys(MESSAGES.en).sort());
    for (const key of Object.keys(MESSAGES.en)) {
      assert.deepEqual(placeholders(MESSAGES.tr[key]), placeholders(MESSAGES.en[key]), key);
    }
  });

  test('no message is empty and every plural entry has both forms', () => {
    for (const language of LANGUAGES) {
      for (const [key, entry] of Object.entries(MESSAGES[language])) {
        const texts = typeof entry === 'string' ? [entry] : [entry.one, entry.other];
        assert.ok(texts.every((text) => typeof text === 'string' && text.trim() !== ''), `${language}.${key}`);
      }
    }
  });

  test('the language button shows the other language, and its accessible name starts with that text', () => {
    for (const language of LANGUAGES) {
      const t = createTranslator(language);
      assert.equal(t('langButton'), otherLanguage(language).toUpperCase());
      assert.ok(t('langButtonLabel').startsWith(t('langButton')), language);
    }
  });
});

describe('translate', () => {
  test('fills placeholders and leaves a placeholder without a value as it is', () => {
    assert.equal(translate('en', 'upNext', { mode: 'Short break' }), 'Up next: Short break');
    assert.equal(translate('tr', 'upNext', { mode: 'Kısa mola' }), 'Sırada: Kısa mola');
    assert.equal(translate('en', 'upNext'), 'Up next: {mode}');
  });

  test('picks the singular or plural form from count', () => {
    assert.equal(translate('en', 'sessions', { count: 1 }), '1 session');
    assert.equal(translate('en', 'sessions', { count: 0 }), '0 sessions');
    assert.equal(translate('en', 'sessions', { count: 7 }), '7 sessions');
    assert.equal(translate('tr', 'sessions', { count: 1 }), '1 oturum');
    assert.equal(translate('tr', 'sessions', { count: 7 }), '7 oturum');
  });

  test('an unknown key comes back as the key; an unknown language reads as English', () => {
    assert.equal(translate('tr', 'noSuchKey'), 'noSuchKey');
    assert.equal(translate('de', 'start'), 'Start');
    assert.equal(createTranslator('xx')('pause'), 'Pause');
  });

  test('languages normalise to a supported one, and the toggle flips between them', () => {
    assert.equal(normalizeLanguage('tr'), 'tr');
    assert.equal(normalizeLanguage('de'), 'en');
    assert.equal(normalizeLanguage(null), 'en');
    assert.equal(otherLanguage('en'), 'tr');
    assert.equal(otherLanguage('tr'), 'en');
    assert.equal(otherLanguage('unknown'), 'tr');
  });
});

test('formatMinutes writes short durations in both languages', () => {
  const en = createTranslator('en');
  assert.equal(formatMinutes(en, 0), '0 min');
  assert.equal(formatMinutes(en, 50), '50 min');
  assert.equal(formatMinutes(en, 120), '2 h');
  assert.equal(formatMinutes(en, 875), '14 h 35 min');
  assert.equal(formatMinutes(createTranslator('tr'), 875), '14 sa 35 dk');
});
