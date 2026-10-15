/**
 * @fileoverview Dual DOM adapter for GitHub pulls list (legacy `#issue_*` and new ListView).
 */

/** @typedef {'legacy' | 'listview'} PullsListLayout */

/**
 * @returns {PullsListLayout | null}
 */
function detectPullsListLayout() {
  if (document.querySelector('ul[data-listview-component="items-list"]')) {
    return 'listview';
  }
  if (document.querySelector('.js-navigation-container')) {
    return 'legacy';
  }
  return null;
}

/**
 * @returns {HTMLElement | null}
 */
function getPullsListContainer() {
  const layout = detectPullsListLayout();
  if (layout === 'listview') {
    return document.querySelector('ul[data-listview-component="items-list"]');
  }
  if (layout === 'legacy') {
    return document.querySelector('.js-navigation-container');
  }
  return null;
}

/**
 * ListView row nodes — keyed off stable `data-testid`, not hashed CSS module classes.
 * @param {HTMLElement} ul
 * @returns {HTMLElement[]}
 */
function getListViewPullRows(ul) {
  /** @type {HTMLElement[]} */
  const rows = [];
  const seen = new Set();
  for (const link of ul.querySelectorAll('a[data-testid="listitem-title-link"]')) {
    const li = link.closest('li');
    if (li instanceof HTMLElement && !seen.has(li)) {
      seen.add(li);
      rows.push(li);
    }
  }
  return rows;
}

/**
 * Description/metadata block for a ListView row (reviewer + Jira injection).
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
function getListViewDescriptionContainer(el) {
  const timestamp = el.querySelector('[data-testid="timestamp-container"]');
  if (timestamp?.parentElement instanceof HTMLElement) {
    return timestamp.parentElement;
  }
  return el.querySelector('[class*="PullsListItem-module__description"]');
}

/**
 * @returns {HTMLElement[]}
 */
function getPullsListRows() {
  const layout = detectPullsListLayout();
  if (layout === 'listview') {
    const ul = document.querySelector('ul[data-listview-component="items-list"]');
    if (!ul) return [];
    return getListViewPullRows(ul);
  }
  if (layout === 'legacy') {
    const container = document.querySelector('.js-navigation-container');
    if (!container) return [];
    return /** @type {HTMLElement[]} */ (
      Array.from(container.children).filter(
        (el) => /** @type {HTMLElement} */ (el).id?.startsWith('issue_'),
      )
    );
  }
  return [];
}

/**
 * @param {HTMLElement} el
 * @returns {string | null}
 */
function getPrNumberFromRow(el) {
  const layout = detectPullsListLayout();
  if (layout === 'listview') {
    const link = el.querySelector('a[data-testid="listitem-title-link"]');
    const href = link?.getAttribute('href') ?? '';
    const match = /\/pull\/(\d+)/.exec(href);
    return match?.[1] ?? null;
  }
  if (layout === 'legacy' && el.id?.startsWith('issue_')) {
    return el.id.replace('issue_', '');
  }
  return null;
}

/**
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
function getStatusContainer(el) {
  const layout = detectPullsListLayout();
  if (layout === 'listview') {
    return getListViewDescriptionContainer(el);
  }
  const openedBySpan = el.querySelector('.opened-by');
  return openedBySpan?.parentElement ?? null;
}

/**
 * Anchor for injected "by you" / reviewer links — inline with GitHub's review label.
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
function getReviewerContainer(el) {
  const layout = detectPullsListLayout();
  if (layout === 'listview') {
    return (
      el.querySelector('[data-testid="review-decision-icon"]') ??
      getStatusContainer(el)
    );
  }
  return getStatusContainer(el);
}

/**
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
function getJiraBadgeContainer(el) {
  const layout = detectPullsListLayout();
  if (layout === 'listview') {
    return getListViewDescriptionContainer(el);
  }
  return el.querySelector('span.v-align-middle');
}
