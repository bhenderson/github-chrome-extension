/**
 * @fileoverview GitHub search `q` parameter as structured options (negate + key + optional value).
 */

/// <reference path="./types/github-extension-global.d.ts" />

/**
 * One qualifier in GitHub’s `q` string, e.g. `is:pr` or `-sort:created-asc`.
 * @typedef {Object} GitHubQueryOption
 * @property {boolean} negate When true, serializes with a leading `-` (e.g. `-sort:created-asc`).
 * @property {string} key Qualifier name (e.g. `is`, `sort`, `label`).
 * @property {string} [value] Optional value; omitted for key-only tokens if ever needed.
 */

/**
 * @param {GitHubQueryOption} a
 * @param {GitHubQueryOption} b
 * @returns {boolean}
 */
function queryOptionEquals(a, b) {
  return (
    a.negate === b.negate &&
    a.key === b.key &&
    a.value === b.value
  );
}

/**
 * @param {GitHubQueryOption[]} list
 * @param {GitHubQueryOption} opt
 * @returns {boolean}
 */
function listContainsOption(list, opt) {
  return list.some((o) => queryOptionEquals(o, opt));
}

/**
 * @param {GitHubQueryOption[]} options
 * @returns {string}
 */
function serializeQueryOptions(options) {
  return options.map(serializeOneQueryOption).join(' ');
}

/**
 * @param {GitHubQueryOption} opt
 * @returns {string}
 */
function serializeOneQueryOption(opt) {
  const body =
    opt.value !== undefined && opt.value !== ''
      ? `${opt.key}:${opt.value}`
      : opt.key;
  return opt.negate ? `-${body}` : body;
}

/**
 * Splits `q` on whitespace, respecting double-quoted segments.
 * @param {string} q
 * @returns {string[]}
 */
function splitQueryTokens(q) {
  const s = q.trim();
  if (!s) return [];
  /** @type {string[]} */
  const out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === '"') {
      const end = s.indexOf('"', i + 1);
      if (end === -1) {
        out.push(s.slice(i));
        break;
      }
      out.push(s.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < s.length && !/\s/.test(s[j])) j++;
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}

/**
 * Parses a single token like `is:pr`, `sort:created-asc`, or `-sort:created-asc`.
 * @param {string} token
 * @returns {GitHubQueryOption | null}
 */
function parseQueryToken(token) {
  const t = token.trim();
  if (!t) return null;

  let negate = false;
  let rest = t;
  if (rest.startsWith('-') && rest.length > 1) {
    negate = true;
    rest = rest.slice(1);
  }

  const colon = rest.indexOf(':');
  if (colon === -1) {
    return { negate, key: rest, value: undefined };
  }

  const key = rest.slice(0, colon);
  const value = rest.slice(colon + 1);
  return { negate, key, value: value === '' ? undefined : value };
}

/**
 * @param {string} q Raw `q` search string (decoded, not URL-encoded).
 * @returns {GitHubQueryOption[]}
 */
function deserializeQueryString(q) {
  return splitQueryTokens(q)
    .map(parseQueryToken)
    .filter((x) => x !== null);
}

/**
 * @param {GitHubQueryOption[]} base
 * @param {GitHubQueryOption[]} toAdd Options appended only if not already present.
 * @returns {GitHubQueryOption[]}
 */
function mergeQueryOptions(base, toAdd) {
  const out = [...base];
  for (const opt of toAdd) {
    if (!listContainsOption(out, opt)) out.push(opt);
  }
  return out;
}

/**
 * @param {GitHubQueryOption[]} base
 * @param {GitHubQueryOption[]} toRemove Matched options are removed (one match per removal rule).
 * @returns {GitHubQueryOption[]}
 */
function subtractQueryOptions(base, toRemove) {
  return base.filter((opt) => !toRemove.some((r) => queryOptionEquals(r, opt)));
}

/**
 * @param {GitHubQueryOption[]} haystack
 * @param {GitHubQueryOption[]} needles Every needle must appear for this to be true.
 * @returns {boolean}
 */
function queryOptionsContainAll(haystack, needles) {
  return needles.every((n) => listContainsOption(haystack, n));
}

/**
 * Repo list paths where Sort Oldest applies. `/issues` is intentionally unsupported for now.
 * @enum {string}
 * @readonly
 */
const GitHubListPathKind = Object.freeze({
  PULLS: /** @type {'pulls'} */ ('pulls'),
});

/**
 * @param {string} pathname
 * @returns {GitHubListPathKind | null}
 */
function getListPathKind(pathname) {
  if (/^\/[^/]+\/[^/]+\/pulls\/?$/.test(pathname)) {
    return GitHubListPathKind.PULLS;
  }
  return null;
}

/**
 * Full default `q` when Sort Oldest is enabled on the pulls list: `is:pr is:open sort:created-asc`.
 * @type {ReadonlyArray<GitHubQueryOption>}
 */
const SORT_OLDEST_PULLS_DEFAULT_OPTIONS = Object.freeze([
  { negate: false, key: 'is', value: 'pr' },
  { negate: false, key: 'is', value: 'open' },
  { negate: false, key: 'sort', value: 'created-asc' },
]);

/**
 * @param {string} pathname
 * @returns {ReadonlyArray<GitHubQueryOption> | null}
 */
function getSortOldestDefaultsForPathname(pathname) {
  if (getListPathKind(pathname) !== GitHubListPathKind.PULLS) return null;
  return SORT_OLDEST_PULLS_DEFAULT_OPTIONS;
}

/** Merged onto globalThis.__githubExtension (see settings.js). */
/** @type {import('./types/github-extension-global').GithubExtensionGlobal | undefined} */
const _prevGithubExtQuery = /** @type {import('./types/github-extension-global').GithubExtensionGlobal | undefined} */ (
  /** @type {any} */ (globalThis).__githubExtension
);
Object.assign(globalThis, {
  __githubExtension: /** @type {import('./types/github-extension-global').GithubExtensionGlobal} */ ({
    ...(_prevGithubExtQuery ?? {}),
    GitHubListPathKind,
    SORT_OLDEST_PULLS_DEFAULT_OPTIONS,
    getListPathKind,
    getSortOldestDefaultsForPathname,
    serializeQueryOptions,
    deserializeQueryString,
    mergeQueryOptions,
    subtractQueryOptions,
    queryOptionsContainAll,
  }),
});
