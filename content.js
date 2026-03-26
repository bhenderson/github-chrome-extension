/**
 * @fileoverview Runs on github.com: merges GitHub `q` search options when Sort Oldest is enabled;
 * optional dependency-based reorder of the pulls list when Group by dependency is enabled.
 */

/// <reference path="./types/github-extension-global.d.ts" />
/// <reference path="./tree.js" />
/// <reference path="./github-prs.js" />

const _ext = /** @type {import('./types/github-extension-global').GithubExtensionGlobal | undefined} */ (
  /** @type {any} */ (globalThis).__githubExtension
);
if (!_ext) {
  throw new Error('github-extension: expected globalThis.__githubExtension (load order?)');
}
/** @type {import('./types/github-extension-global').GithubExtensionGlobal} */
const ext = _ext;

const defaultSortKey = '__gce_defaultSort';
const dependencySortKey = '__gce_dependencySort';

/** Marks extension-injected review UI for cleanup before re-render. */
const REVIEW_UI_ATTR = 'data-gce-review';

const PullRequestReviewState = /** @type {const} */ ({
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  COMMENTED: 'COMMENTED',
  DISMISSED: 'DISMISSED',
  PENDING: 'PENDING',
});

const PullRequestReviewDecision = /** @type {const} */ ({
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  NONE: null,
});

/** @type {string} */
let currentUser = '';

/**
 * @template T
 * @param {Array<T>} array
 * @param {(value: T) => boolean} predicate
 * @returns {[Array<T>, Array<T>]}
 */
function partition(array, predicate) {
  const initial = /** @type {[Array<T>, Array<T>]} */ ([[], []]);

  return array.reduce(
    ([a, b], value) => ((predicate(value) ? a : b).push(value), [a, b]),
    initial,
  );
}

/**
 * @param {Array<{ author: string; state: string; html_url: string }>} reviews
 * @returns {HTMLElement | null}
 */
function createReviewElements(reviews) {
  if (!reviews.length) return null;

  const span = document.createElement('span');
  span.classList.add('ml-1');
  span.setAttribute(REVIEW_UI_ATTR, '1');

  span.append(' by ');

  const children = reviews.flatMap((review) => {
    const statusEl = document.createElement('a');
    statusEl.href = review.html_url;
    statusEl.textContent = review.author === currentUser ? 'you' : review.author;
    return [statusEl, ', '];
  });

  children.pop();
  span.append(...children);

  return span;
}

/**
 * Appends approved / changes-requested reviewer names next to the PR meta line (see main worktree).
 * @param {Object} pr
 * @param {HTMLElement} node
 */
function showReviewers(pr, node) {
  const p = /** @type {{
    reviews?: Array<{ author: string; state: string; html_url: string }>;
    reviewDecision?: string | null;
  }} */ (pr);

  const reviews = (p.reviews ?? []).filter(
    (/** @type {{ author: string; state: string; html_url: string }} */ review) =>
      review.state === PullRequestReviewState.APPROVED ||
      review.state === PullRequestReviewState.CHANGES_REQUESTED,
  );
  if (reviews.length === 0) return;

  const [approvedReviews, changesRequestedReviews] = partition(
    reviews,
    (/** @type {{ author: string; state: string; html_url: string }} */ review) =>
      review.state === PullRequestReviewState.APPROVED,
  );
  const lastChild = node.children[node.children.length - 1];

  if (!lastChild) return;

  switch (p.reviewDecision ?? PullRequestReviewDecision.NONE) {
    case PullRequestReviewDecision.CHANGES_REQUESTED: {
      const reviewElements = createReviewElements(changesRequestedReviews);
      if (reviewElements) {
        node.append(reviewElements);
      }
      if (!approvedReviews.length) break;

      const span = document.createElement('span');
      span.classList.add('ml-1');
      span.setAttribute(REVIEW_UI_ATTR, '1');
      span.innerText = ' • Approved ';
      node.append(span);
    }
    // fall through
    case PullRequestReviewDecision.APPROVED: {
      const reviewElements = createReviewElements(approvedReviews);
      if (reviewElements) {
        node.append(reviewElements);
      }
      break;
    }
    case PullRequestReviewDecision.REVIEW_REQUIRED:
      break;
    case PullRequestReviewDecision.NONE:
      break;
    default:
      break;
  }
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isPullsListPath(pathname) {
  return ext.getListPathKind(pathname) !== null;
}

/**
 * @param {URL} url
 * @returns {boolean} True if `q` already includes the full Sort Oldest default bundle for this path.
 */
function hasSortOldestQueryBundle(url) {
  const defaults = ext.getSortOldestDefaultsForPathname(url.pathname);
  if (!defaults) return false;
  const q = url.searchParams.get('q') ?? '';
  const current = ext.deserializeQueryString(q);
  return ext.queryOptionsContainAll(current, [...defaults]);
}

/**
 * Merges pulls-list defaults (`is:pr is:open sort:created-asc`) into `q`.
 * @param {URL} url
 * @returns {boolean} True if `url` was modified.
 */
function applySortOldestQuery(url) {
  const defaults = ext.getSortOldestDefaultsForPathname(url.pathname);
  if (!defaults) return false;
  if (hasSortOldestQueryBundle(url)) return false;

  const beforeHref = url.href;
  const q = url.searchParams.get('q') ?? '';
  const current = ext.deserializeQueryString(q);
  const merged = ext.mergeQueryOptions(current, [...defaults]);
  const next = ext.serializeQueryOptions(merged).trim();
  url.searchParams.set('q', next);
  return url.href !== beforeHref;
}

/**
 * Removes the Sort Oldest default option set for this path from `q`.
 * @param {URL} url
 * @returns {boolean} True if `url` was modified.
 */
function stripSortOldestQuery(url) {
  const defaults = ext.getSortOldestDefaultsForPathname(url.pathname);
  if (!defaults) return false;

  const beforeHref = url.href;
  const q = url.searchParams.get('q') ?? '';
  const current = ext.deserializeQueryString(q);
  const nextOpts = ext.subtractQueryOptions(current, [...defaults]);
  const next = ext.serializeQueryOptions(nextOpts).trim();

  if (next === '') {
    url.searchParams.delete('q');
  } else {
    url.searchParams.set('q', next);
  }

  return url.href !== beforeHref;
}

/**
 * @typedef {Object} ApplyUrlOptions
 * @property {boolean} [fromStorageEvent] When true, turning sort off may strip params we added.
 */

/**
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 * @param {ApplyUrlOptions} [options]
 * @returns {void}
 */
function applyUrlForSettings(settings, options = {}) {
  const fromStorageEvent = options.fromStorageEvent === true;
  const url = new URL(location.href);
  if (!isPullsListPath(url.pathname)) return;

  if (settings.sortOldest) {
    if (applySortOldestQuery(url) && url.href !== location.href) {
      location.replace(url.href);
    }
    return;
  }

  if (!fromStorageEvent) return;

  if (stripSortOldestQuery(url) && url.href !== location.href) {
    location.replace(url.href);
  }
}

/**
 * @returns {{ container?: HTMLDivElement, prElements?: HTMLElement[] }}
 */
function getPRElements() {
  const container = /** @type {HTMLDivElement | null} */ (
    document.querySelector('.js-navigation-container')
  );
  if (!container) return {};

  const prElements = /** @type {HTMLElement[]} */ (
    Array.from(container.children).filter(
      (el) => /** @type {HTMLElement} */(el).id?.startsWith('issue_'),
    )
  );

  return { container, prElements };
}

function setPRDefaultSort() {
  const { prElements } = getPRElements();
  if (!prElements?.length) return;

  for (const idx in prElements) {
    const el = prElements[idx];
    el.dataset[defaultSortKey] = String(idx);
  }
}

/**
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 */
async function setDependencySort(settings) {
  const { container, prElements } = getPRElements();
  if (!container || !prElements?.length) return;

  const pathParts = window.location.pathname.split('/');
  const owner = pathParts[1];
  const repo = pathParts[2];
  if (!owner || !repo) return;

  const { viewerLogin, pullRequests } = await fetchOpenPullRequestsForRepo(
    owner,
    repo,
    settings.token ?? '',
  );
  currentUser = viewerLogin;

  const elementByPRNumber = /** @type {Record<string, HTMLElement>} */ ({});
  for (const el of prElements) {
    const prNumber = el.id.replace('issue_', '');
    elementByPRNumber[prNumber] = el;
  }

  const fallbackToDefaultOrder = () => {
    for (const el of prElements) {
      el.dataset[dependencySortKey] = el.dataset[defaultSortKey] ?? '0';
    }
  };

  if (!pullRequests.length) {
    fallbackToDefaultOrder();
    return;
  }

  const hasMatchingPRs = pullRequests.some((pr) => elementByPRNumber[String(pr.number)]);
  if (!hasMatchingPRs) {
    fallbackToDefaultOrder();
    return;
  }

  const tree = buildTree(pullRequests);
  const { byHead = {} } = tree;
  let sortIndex = 0;

  /**
   * @param {*} node
   * @param {number} depth
   */
  function traverseTree(node, depth = 0) {
    const { pr, children } = node;
    if (pr && elementByPRNumber[String(pr.number)]) {
      const el = elementByPRNumber[String(pr.number)];
      const isInChain = children.length > 0 || depth > 1;

      el.dataset[dependencySortKey] = String(sortIndex++);

      const openedBySpan = el.querySelector('.opened-by');
      const statusSpan = openedBySpan?.parentElement;

      if (statusSpan) {
        for (const el of Array.from(
          statusSpan.querySelectorAll(`[${REVIEW_UI_ATTR}]`),
        )) {
          el.remove();
        }

        for (const label of Array.from(
          statusSpan.querySelectorAll('.base-branch-label'),
        )) {
          label.remove();
        }

        if (isInChain) {
          const depthLabel = document.createElement('span');
          depthLabel.classList.add('base-branch-label');
          depthLabel.textContent = String(depth);
          Object.assign(depthLabel.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            minWidth: '1.75em',
            padding: '2px 8px',
            marginRight: '6px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            lineHeight: '1.25',
            verticalAlign: 'middle',
            backgroundColor: getBaseBranchColor(byHead, pr),
          });
          statusSpan.prepend(depthLabel, ' ');
        }

        showReviewers(pr, statusSpan);
      }
    }
    for (const child of children) {
      traverseTree(child, depth + 1);
    }
  }

  traverseTree(tree);

  let maxIdx = sortIndex;
  for (const el of prElements) {
    if (
      el.dataset[dependencySortKey] === undefined ||
      el.dataset[dependencySortKey] === ''
    ) {
      el.dataset[dependencySortKey] = String(maxIdx++);
    }
  }
}

/**
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 */
function getSortKey(settings) {
  return settings.groupByDependency ? dependencySortKey : defaultSortKey;
}

/**
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 */
function sortByKey(settings) {
  const key = getSortKey(settings);
  const { container, prElements } = getPRElements();
  if (!container || !prElements?.length) return;

  const sorted = [...prElements].sort((a, b) => {
    const aIdx = Number(a.dataset[key]);
    const bIdx = Number(b.dataset[key]);
    if (Number.isNaN(aIdx) || Number.isNaN(bIdx)) {
      return 0;
    }
    return aIdx - bIdx;
  });

  container.replaceChildren(...sorted);
}

/**
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 */
async function refreshPullsListDependencySort(settings) {
  setPRDefaultSort();
  if (!settings.groupByDependency || !settings.token) {
    sortByKey(settings);
    return;
  }
  await setDependencySort(settings);
  sortByKey(settings);
}

function initPullsListDependencyFeatures() {
  const schedule = () => {
    void ext.loadSettings().then((s) => {
      if (ext.getListPathKind(location.pathname) !== ext.GitHubListPathKind.PULLS) {
        return;
      }
      void refreshPullsListDependencySort(s);
    });
  };

  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule);
  }

  document.addEventListener('turbo:render', () => {
    setTimeout(schedule, 500);
  });
}

void ext.loadSettings().then((s) =>
  applyUrlForSettings(s, { fromStorageEvent: false }),
);

initPullsListDependencyFeatures();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[ext.StorageAreaKey.SETTINGS]) return;
  void ext.loadSettings().then((s) => {
    applyUrlForSettings(s, { fromStorageEvent: true });
    if (ext.getListPathKind(location.pathname) === ext.GitHubListPathKind.PULLS) {
      void refreshPullsListDependencySort(s);
    }
  });
});
