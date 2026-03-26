/**
 * Shared API published on `globalThis.__githubExtension` for content scripts.
 * Property names are intentionally nested so they do not merge with global `function` names in .js files.
 */

export interface ExtensionSettings {
  sortOldest: boolean;
  groupByDependency: boolean;
  token?: string;
  filterDraftsOut: boolean;
  filterApprovedByMe: boolean;
  filterNotApprovedByMe: boolean;
  filterOnlyMyPRs: boolean;
  filterNotMyPRs: boolean;
}

export interface GitHubQueryOption {
  negate: boolean;
  key: string;
  value?: string;
}

/** Shape of globalThis.__githubExtension after settings + github-query-options run. */
export interface GithubExtensionGlobal {
  StorageAreaKey: { readonly SETTINGS: string };
  loadSettings: () => Promise<ExtensionSettings>;
  saveSettingsPatch: (patch: Partial<ExtensionSettings>) => Promise<void>;
  GitHubListPathKind: { readonly PULLS: 'pulls' };
  SORT_OLDEST_PULLS_DEFAULT_OPTIONS: ReadonlyArray<GitHubQueryOption>;
  getListPathKind: (pathname: string) => 'pulls' | null;
  getSortOldestDefaultsForPathname: (
    pathname: string,
  ) => ReadonlyArray<GitHubQueryOption> | null;
  serializeQueryOptions: (options: GitHubQueryOption[]) => string;
  deserializeQueryString: (q: string) => GitHubQueryOption[];
  mergeQueryOptions: (
    base: GitHubQueryOption[],
    toAdd: GitHubQueryOption[],
  ) => GitHubQueryOption[];
  subtractQueryOptions: (
    base: GitHubQueryOption[],
    toRemove: GitHubQueryOption[],
  ) => GitHubQueryOption[];
  queryOptionsContainAll: (
    haystack: GitHubQueryOption[],
    needles: GitHubQueryOption[],
  ) => boolean;
}

declare global {
  interface GlobalThis {
    /** Merged in two steps (settings.js then github-query-options.js). */
    __githubExtension?: GithubExtensionGlobal;
  }
}

export {};
