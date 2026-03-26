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

  const pullRequests = await fetchOpenPullRequestsForRepo(
    owner,
    repo,
    settings.token ?? '',
  );

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
