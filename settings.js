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
 * @property {string} [token] Optional GitHub token for future use; never log or expose in UI in full.
 */

/**
 * Default settings used when storage is empty or keys are missing.
 * @type {ExtensionSettings}
 * @readonly
 */
const DEFAULT_EXTENSION_SETTINGS = Object.freeze({
  sortOldest: false,
  token: '',
});

/**
 * @param {unknown} value
 * @returns {value is ExtensionSettings}
 */
function isExtensionSettings(value) {
  if (value === null || typeof value !== 'object') return false;
  const o = /** @type {Record<string, unknown>} */ (value);
  if (typeof o.sortOldest !== 'boolean') return false;
  if (o.token !== undefined && typeof o.token !== 'string') return false;
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
    token:
      typeof partial?.token === 'string'
        ? partial.token
        : DEFAULT_EXTENSION_SETTINGS.token,
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
    const next = normalizeSettings({ ...current, ...patch });
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
