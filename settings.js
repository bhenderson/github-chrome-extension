/**
 * @fileoverview Shared extension settings (storage keys, defaults, read/write).
 * Loaded by the popup and content scripts.
 */

/// <reference path="./types/github-extension-global.d.ts" />

/**
 * Storage area key for the serialized {@link ExtensionSettings} object.
 * @enum {string}
 * @readonly
 */
const StorageAreaKey = Object.freeze({
  SETTINGS: /** @type {'githubExt.settings'} */ ('githubExt.settings'),
});

/**
 * @typedef {Object} ExtensionSettings
 * @property {boolean} sortOldest When true, repo pulls list URLs gain oldest-first `q` defaults.
 * @property {boolean} groupByDependency When true, open PRs on the pulls list are reordered by dependency chain (requires token).
 * @property {string} [token] Optional GitHub token for GraphQL; never log or expose in UI in full.
 * @property {boolean} filterDraftsOut Adds `draft:false` to the pulls `q` string.
 * @property {boolean} filterApprovedByMe Hides PR rows the viewer has not approved (requires token + API data).
 * @property {boolean} filterNotApprovedByMe Hides PR rows the viewer has approved (requires token + API data).
 * @property {boolean} filterOnlyMyPRs Adds `author:viewer` to `q` (uses page login when available).
 * @property {boolean} filterNotMyPRs Adds `-author:viewer` to `q`.
 */

/**
 * Default settings used when storage is empty or keys are missing.
 * @type {ExtensionSettings}
 * @readonly
 */
const DEFAULT_EXTENSION_SETTINGS = Object.freeze({
  sortOldest: false,
  groupByDependency: false,
  token: '',
  filterDraftsOut: false,
  filterApprovedByMe: false,
  filterNotApprovedByMe: false,
  filterOnlyMyPRs: false,
  filterNotMyPRs: false,
});

/**
 * @param {unknown} value
 * @returns {value is ExtensionSettings}
 */
function isExtensionSettings(value) {
  if (value === null || typeof value !== 'object') return false;
  const o = /** @type {Record<string, unknown>} */ (value);
  if (typeof o.sortOldest !== 'boolean') return false;
  if (
    o.groupByDependency !== undefined &&
    typeof o.groupByDependency !== 'boolean'
  ) {
    return false;
  }
  if (o.token !== undefined && typeof o.token !== 'string') return false;
  const boolKeys = [
    'filterDraftsOut',
    'filterApprovedByMe',
    'filterNotApprovedByMe',
    'filterOnlyMyPRs',
    'filterNotMyPRs',
  ];
  for (const k of boolKeys) {
    if (o[k] !== undefined && typeof o[k] !== 'boolean') return false;
  }
  return true;
}

/**
 * Merge stored settings with defaults so new fields get sane values.
 * @param {Partial<ExtensionSettings> | undefined} partial
 * @returns {ExtensionSettings}
 */
function normalizeSettings(partial) {
  return {
    sortOldest:
      typeof partial?.sortOldest === 'boolean'
        ? partial.sortOldest
        : DEFAULT_EXTENSION_SETTINGS.sortOldest,
    groupByDependency:
      typeof partial?.groupByDependency === 'boolean'
        ? partial.groupByDependency
        : DEFAULT_EXTENSION_SETTINGS.groupByDependency,
    token:
      typeof partial?.token === 'string'
        ? partial.token
        : DEFAULT_EXTENSION_SETTINGS.token,
    filterDraftsOut:
      typeof partial?.filterDraftsOut === 'boolean'
        ? partial.filterDraftsOut
        : DEFAULT_EXTENSION_SETTINGS.filterDraftsOut,
    filterApprovedByMe:
      typeof partial?.filterApprovedByMe === 'boolean'
        ? partial.filterApprovedByMe
        : DEFAULT_EXTENSION_SETTINGS.filterApprovedByMe,
    filterNotApprovedByMe:
      typeof partial?.filterNotApprovedByMe === 'boolean'
        ? partial.filterNotApprovedByMe
        : DEFAULT_EXTENSION_SETTINGS.filterNotApprovedByMe,
    filterOnlyMyPRs:
      typeof partial?.filterOnlyMyPRs === 'boolean'
        ? partial.filterOnlyMyPRs
        : DEFAULT_EXTENSION_SETTINGS.filterOnlyMyPRs,
    filterNotMyPRs:
      typeof partial?.filterNotMyPRs === 'boolean'
        ? partial.filterNotMyPRs
        : DEFAULT_EXTENSION_SETTINGS.filterNotMyPRs,
  };
}

/**
 * @returns {Promise<ExtensionSettings>}
 */
function loadSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([StorageAreaKey.SETTINGS], (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const raw = result[StorageAreaKey.SETTINGS];
      if (raw !== undefined && !isExtensionSettings(raw)) {
        resolve({ ...DEFAULT_EXTENSION_SETTINGS });
        return;
      }
      resolve(normalizeSettings(isExtensionSettings(raw) ? raw : undefined));
    });
  });
}

/**
 * @param {Partial<ExtensionSettings>} patch
 * @returns {Promise<void>}
 */
function saveSettingsPatch(patch) {
  return loadSettings().then((current) => {
    /** @type {Partial<ExtensionSettings>} */
    const p = { ...patch };
    if (p.filterApprovedByMe === true) p.filterNotApprovedByMe = false;
    if (p.filterNotApprovedByMe === true) p.filterApprovedByMe = false;
    if (p.filterOnlyMyPRs === true) p.filterNotMyPRs = false;
    if (p.filterNotMyPRs === true) p.filterOnlyMyPRs = false;
    const next = normalizeSettings({ ...current, ...p });
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [StorageAreaKey.SETTINGS]: next }, () => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve();
      });
    });
  });
}

/**
 * Namespace for content scripts: separate injected files may not share lexical scope.
 * Merged with github-query-options.js via spread on the same object.
 */
/** @type {Partial<import('./types/github-extension-global').GithubExtensionGlobal> | undefined} */
const _prevGithubExt = /** @type {import('./types/github-extension-global').GithubExtensionGlobal | undefined} */ (
  /** @type {any} */ (globalThis).__githubExtension
);
Object.assign(globalThis, {
  __githubExtension: /** @type {Partial<import('./types/github-extension-global').GithubExtensionGlobal> & Record<string, unknown>} */ ({
    ...(_prevGithubExt ?? {}),
    StorageAreaKey,
    loadSettings,
    saveSettingsPatch,
  }),
});
