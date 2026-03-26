/**
 * @fileoverview Runs on github.com: merges GitHub `q` search options when Sort Oldest is enabled.
 */

/// <reference path="./types/github-extension-global.d.ts" />

const _ext = /** @type {import('./types/github-extension-global').GithubExtensionGlobal | undefined} */ (
  /** @type {any} */ (globalThis).__githubExtension
);
if (!_ext) {
  throw new Error('github-extension: expected globalThis.__githubExtension (load order?)');
}
/** @type {import('./types/github-extension-global').GithubExtensionGlobal} */
const ext = _ext;

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

void ext.loadSettings().then((s) =>
  applyUrlForSettings(s, { fromStorageEvent: false }),
);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[ext.StorageAreaKey.SETTINGS]) return;
  void ext.loadSettings().then((s) =>
    applyUrlForSettings(s, { fromStorageEvent: true }),
  );
});
