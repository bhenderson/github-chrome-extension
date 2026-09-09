/**
 * @fileoverview Per-row SVG data URLs for PR dependency graph lines in the list gutter.
 */

const STROKE_W = 2;
const GUTTER_WIDTH = 18;
const ROW_VIEW_H = 100;
const TEXT_GAP = 10;
const FONT_SIZE = 14;

/**
 * @returns {number}
 */
function computeGutterWidth() {
  return GUTTER_WIDTH;
}

/**
 * @param {GraphMeta} meta
 * @param {number} gutterWidthPx
 * @returns {string}
 */
function buildRowGraphSvg(meta, gutterWidthPx) {
  const { depth, stackPosition, stackTotal, color } = meta;
  const cx = gutterWidthPx / 2;
  const midY = ROW_VIEW_H / 2;
  const paths = [];

  if (stackPosition > 1) {
    paths.push(
      `<line x1="${cx}" y1="0" x2="${cx}" y2="${midY - TEXT_GAP}" stroke="${color}" stroke-width="${STROKE_W}"/>`,
    );
  }

  paths.push(
    `<text x="${cx}" y="${midY}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="${FONT_SIZE}" font-weight="500" fill="${color}">${depth}</text>`,
  );

  if (stackPosition < stackTotal) {
    paths.push(
      `<line x1="${cx}" y1="${midY + TEXT_GAP}" x2="${cx}" y2="${ROW_VIEW_H}" stroke="${color}" stroke-width="${STROKE_W}"/>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gutterWidthPx} ${ROW_VIEW_H}" preserveAspectRatio="none">${paths.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
