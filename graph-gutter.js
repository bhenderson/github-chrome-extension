/**
 * @fileoverview Per-row gutter DOM for PR dependency graph lines in the list gutter.
 */

const GUTTER_WIDTH = 18;

/**
 * @returns {number}
 */
function computeGutterWidth() {
  return GUTTER_WIDTH;
}

/**
 * @param {GraphMeta} meta
 * @returns {HTMLElement}
 */
function buildGraphGutterElement(meta) {
  const { depth, stackPosition, stackTotal, color } = meta;

  const gutter = document.createElement('div');
  gutter.className = 'gce-graph-gutter';
  gutter.style.setProperty('--gce-graph-color', color);

  if (stackTotal > 1) {
    const upper = document.createElement('div');
    upper.className = 'gce-graph-segment gce-graph-segment--upper';
    if (stackPosition > 1) {
      const line = document.createElement('div');
      line.className = 'gce-graph-line';
      upper.append(line);
    }
    gutter.append(upper);
  }

  const num = document.createElement('span');
  num.className = 'gce-graph-depth';
  num.textContent = String(depth);
  gutter.append(num);

  if (stackTotal > 1) {
    const lower = document.createElement('div');
    lower.className = 'gce-graph-segment gce-graph-segment--lower';
    if (stackPosition < stackTotal) {
      const line = document.createElement('div');
      line.className = 'gce-graph-line';
      lower.append(line);
    }
    gutter.append(lower);
  }

  return gutter;
}
