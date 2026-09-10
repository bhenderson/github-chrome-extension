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
 * @returns {HTMLDivElement}
 */
function createGraphSegment() {
  const segment = document.createElement('div');
  segment.className = 'gce-graph-segment';
  const line = document.createElement('div');
  line.className = 'gce-graph-line';
  segment.append(line);
  return segment;
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
    if (stackPosition <= 1) gutter.classList.add('gce-graph-gutter--stack-start');
    if (stackPosition >= stackTotal) gutter.classList.add('gce-graph-gutter--stack-end');
    gutter.append(createGraphSegment());
  }

  const num = document.createElement('span');
  num.className = 'gce-graph-depth';
  num.textContent = String(depth);
  gutter.append(num);

  if (stackTotal > 1) {
    gutter.append(createGraphSegment());
  }

  return gutter;
}
