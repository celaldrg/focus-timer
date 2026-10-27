/**
 * Small DOM helpers for the UI modules. Text only ever goes in through textContent or attributes, never
 * as markup, and static markup is translated through data-i18n attributes.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** [selector, attribute, dataset key] of the translated attributes. */
const TRANSLATED_ATTRIBUTES = [
  ['[data-i18n-aria-label]', 'aria-label', 'i18nAriaLabel'],
  ['[data-i18n-title]', 'title', 'i18nTitle'],
  ['[data-i18n-placeholder]', 'placeholder', 'i18nPlaceholder'],
];

/**
 * Creates an HTML element.
 * @param {string} tag
 * @param {object} [options]
 * @param {string} [options.className]
 * @param {string} [options.text]  textContent
 * @param {Record<string, string | number | boolean | null | undefined>} [options.attrs]
 *   attributes; true sets an empty attribute, false, null and undefined leave it out
 * @param {Record<string, string>} [options.dataset]
 * @param {(Node | string)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, { className, text, attrs = {}, dataset = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  setAttributes(node, attrs);
  Object.assign(node.dataset, dataset);
  node.append(...children);
  return node;
}

/**
 * Creates an SVG element.
 * @param {string} tag
 * @param {Record<string, string | number | boolean | null | undefined>} [attrs]
 * @param {(Node | string)[]} [children]  strings become text nodes
 * @returns {SVGElement}
 */
export function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  setAttributes(node, attrs);
  node.append(...children);
  return node;
}

/**
 * Sets a node's text, skipping the DOM write when nothing changed (the timer redraws several times a second).
 * @param {Node} node
 * @param {string} text
 */
export function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

/**
 * Sets an attribute, skipping the DOM write when nothing changed.
 * @param {Element} node
 * @param {string} name
 * @param {string} value
 */
export function setAttr(node, name, value) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

/**
 * Translates static markup: data-i18n sets the text, data-i18n-aria-label, data-i18n-title and
 * data-i18n-placeholder set those attributes. Each value is an i18n key.
 * @param {ParentNode} root
 * @param {import('./i18n.js').Translate} t
 */
export function applyTranslations(root, t) {
  for (const node of root.querySelectorAll('[data-i18n]')) setText(node, t(node.dataset.i18n));
  for (const [selector, attribute, keyName] of TRANSLATED_ATTRIBUTES) {
    for (const node of root.querySelectorAll(selector)) setAttr(node, attribute, t(node.dataset[keyName]));
  }
}

function setAttributes(node, attrs) {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
}
