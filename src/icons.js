/**
 * Line icons for elements built at runtime (the static icons are inline in index.html).
 */
import { svgEl } from './dom.js';

const PATHS = Object.freeze({
  edit: ['M4 20h4L18.6 9.4a2.1 2.1 0 0 0-3-3L5 17v3', 'M13.6 8.4l3 3'],
  trash: ['M4.5 7h15', 'M9.5 7V4.5h5V7', 'M6.5 7l1 12.5h9l1-12.5', 'M10.2 11v5.5', 'M13.8 11v5.5'],
});

/**
 * A decorative 24 × 24 line icon; the button around it carries the accessible name.
 * @param {keyof typeof PATHS} name
 * @returns {SVGElement}
 */
export function icon(name) {
  const paths = PATHS[name].map((d) => svgEl('path', { d }));
  return svgEl('svg', { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, paths);
}
