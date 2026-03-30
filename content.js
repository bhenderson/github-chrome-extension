/**
 * @fileoverview Runs on github.com: merges GitHub `q` search options (sort oldest, drafts, author);
 * optional dependency reorder and approval-based row filtering on the pulls list (token + GraphQL when needed).
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
/** Set from GraphQL reviews when approval filters or dependency mode needs them. */
const approvedByYouKey = '__gce_approvedByYou';

/** Marks extension-injected review UI for cleanup before re-render. */
const REVIEW_UI_ATTR = 'data-gce-review';

/** Marks extension-injected Jira badges for cleanup before re-render. */
const JIRA_UI_ATTR = 'data-gce-jira';

const JiraStatusCategoryColor = /** @type {const} */ ({
  new: '6b778c',
  indeterminate: '0052cc',
  done: '36b37e',
});

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
 * Logged-in user from GitHub’s page (`meta[name="user-login"]`).
 * @returns {string}
 */
function getViewerLoginFromDom() {
  const meta = document.querySelector('meta[name="user-login"]');
  const c = meta?.getAttribute('content');
  return typeof c === 'string' && c.length > 0 ? c : '';
}

/**
 * @param {import('./types/github-extension-global').GitHubQueryOption[]} options
 * @param {string} key
 * @returns {import('./types/github-extension-global').GitHubQueryOption[]}
 */
function removeQueryOptionsWithKey(options, key) {
  return options.filter((o) => o.key !== key);
}

/**
 * @typedef {Object} ApplyUrlOptions
 * @property {boolean} [fromStorageEvent] When true, turning sort off may strip params we added.
 */

/**
 * Aligns the pulls-list `q` parameter with extension settings (sort, draft, author filters).
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 * @param {ApplyUrlOptions} [options]
 * @returns {void}
 */
function applyUrlForSettings(settings, options = {}) {
  const fromStorageEvent = options.fromStorageEvent === true;
  const url = new URL(location.href);
  if (!isPullsListPath(url.pathname)) return;

  const defaults = ext.getSortOldestDefaultsForPathname(url.pathname);
  let q = ext.deserializeQueryString(url.searchParams.get('q') ?? '');

  if (defaults) {
    if (settings.sortOldest) {
      if (!ext.queryOptionsContainAll(q, [...defaults])) {
        q = ext.mergeQueryOptions(q, [...defaults]);
      }
    } else if (fromStorageEvent) {
      q = ext.subtractQueryOptions(q, [...defaults]);
    }
  }

  if (settings.filterDraftsOut) {
    q = removeQueryOptionsWithKey(q, 'draft');
    q = ext.mergeQueryOptions(q, [{ negate: false, key: 'draft', value: 'false' }]);
  } else if (fromStorageEvent) {
    q = removeQueryOptionsWithKey(q, 'draft');
  }

  const login = getViewerLoginFromDom();
  if (login && settings.filterOnlyMyPRs) {
    q = removeQueryOptionsWithKey(q, 'author');
    q = ext.mergeQueryOptions(q, [{ negate: false, key: 'author', value: login }]);
  } else if (login && settings.filterNotMyPRs) {
    q = removeQueryOptionsWithKey(q, 'author');
    q = ext.mergeQueryOptions(q, [{ negate: true, key: 'author', value: login }]);
  } else if (fromStorageEvent) {
    q = removeQueryOptionsWithKey(q, 'author');
  }

  const pathAuthorLogin = ext.getPullsListPathAuthorLogin(url.pathname);
  if (pathAuthorLogin && !settings.filterOnlyMyPRs) {
    q = ext.mergeQueryOptions(q, [
      { negate: false, key: 'author', value: pathAuthorLogin },
    ]);
  }

  const next = ext.serializeQueryOptions(q).trim();
  if (next === '') {
    url.searchParams.delete('q');
  } else {
    url.searchParams.set('q', next);
  }

  if (url.href !== location.href) {
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
 * @param {string} viewerLogin
 * @param {Array<{
 *   number: number;
 *   headRefName: string;
 *   baseRefName: string;
 *   reviews: Array<{ author: string; state: string; html_url: string }>;
 *   reviewDecision?: string | null;
 * }>} pullRequests
 */
async function setDependencySort(settings, viewerLogin, pullRequests) {
  const { container, prElements } = getPRElements();
  if (!container || !prElements?.length) return;

  const pathParts = window.location.pathname.split('/');
  const owner = pathParts[1];
  const repo = pathParts[2];
  if (!owner || !repo) return;

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
 * @param {HTMLElement[]} prElements
 * @param {Array<{
 *   number: number;
 *   reviews: Array<{ author: string; state: string; html_url: string }>;
 * }>} pullRequests
 * @param {string} viewerLogin
 */
function applyApprovalDatasetsToRows(prElements, pullRequests, viewerLogin) {
  const byNum = new Map(pullRequests.map((pr) => [String(pr.number), pr]));
  for (const el of prElements) {
    const num = el.id.replace('issue_', '');
    const pr = byNum.get(num);
    if (pr) {
      const approved = pr.reviews.some(
        (r) =>
          r.author === viewerLogin &&
          r.state === PullRequestReviewState.APPROVED,
      );
      el.dataset[approvedByYouKey] = String(approved);
    } else {
      delete el.dataset[approvedByYouKey];
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

  const approvalFilterOn =
    !!settings.token &&
    (settings.filterApprovedByMe || settings.filterNotApprovedByMe);

  for (const el of sorted) {
    if (!approvalFilterOn) {
      el.hidden = false;
      continue;
    }
    const approvedByYou = el.dataset[approvedByYouKey] === 'true';
    const show =
      (approvedByYou && settings.filterApprovedByMe) ||
      (!approvedByYou && settings.filterNotApprovedByMe);
    el.hidden = !show;
  }

  container.replaceChildren(...sorted);
}

/**
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 */
async function refreshPullsListDependencySort(settings) {
  setPRDefaultSort();

  const needsGraph =
    !!settings.token &&
    (settings.groupByDependency ||
      settings.filterApprovedByMe ||
      settings.filterNotApprovedByMe);

  const needsJira = isJiraConfigured(settings);
  const needsFetch = needsGraph || (needsJira && !!settings.token);

  if (!needsFetch) {
    const { prElements } = getPRElements();
    if (prElements?.length) {
      for (const el of prElements) {
        delete el.dataset[approvedByYouKey];
        el.hidden = false;
      }
    }
    sortByKey(settings);
    return;
  }

  const pathParts = window.location.pathname.split('/');
  const owner = pathParts[1];
  const repo = pathParts[2];
  if (!owner || !repo) {
    sortByKey(settings);
    return;
  }

  const { viewerLogin, pullRequests } = await fetchOpenPullRequestsForRepo(
    owner,
    repo,
    settings.token ?? '',
  );

  if (settings.groupByDependency) {
    await setDependencySort(settings, viewerLogin, pullRequests);
  }

  const { prElements } = getPRElements();
  if (prElements?.length) {
    applyApprovalDatasetsToRows(prElements, pullRequests, viewerLogin);
  }

  sortByKey(settings);

  if (needsJira && pullRequests.length) {
    await renderJiraStatusBadges(settings, pullRequests);
  }
}

/**
 * @param {string} statusCategoryKey
 * @returns {string}
 */
function jiraStatusColor(statusCategoryKey) {
  return `#${JiraStatusCategoryColor[/** @type {keyof typeof JiraStatusCategoryColor} */ (statusCategoryKey)] ?? JiraStatusCategoryColor.indeterminate}`;
}

/**
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 * @returns {boolean}
 */
function isJiraConfigured(settings) {
  return !!(settings.jiraBaseUrl && settings.jiraEmail && settings.jiraApiToken);
}

/**
 * @param {string} branchName
 * @param {string} patternStr
 * @returns {string | null}
 */
function extractJiraKey(branchName, patternStr) {
  try {
    const match = new RegExp(patternStr).exec(branchName);
    return match?.[1] ?? match?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches Jira statuses and renders status badges on PR rows.
 * @param {import('./types/github-extension-global').ExtensionSettings} settings
 * @param {Array<{ number: number; headRefName: string }>} pullRequests
 */
async function renderJiraStatusBadges(settings, pullRequests) {
  const { prElements } = getPRElements();
  if (!prElements?.length) return;

  for (const el of Array.from(document.querySelectorAll(`[${JIRA_UI_ATTR}]`))) {
    el.remove();
  }

  if (!isJiraConfigured(settings)) return;

  const pattern = settings.jiraTicketPattern || '([A-Z][A-Z0-9]+-\\d+)';

  /** @type {Map<string, string>} */
  const keyByPrNumber = new Map();
  /** @type {Set<string>} */
  const allKeys = new Set();

  for (const pr of pullRequests) {
    const key = extractJiraKey(pr.headRefName, pattern);
    if (key) {
      keyByPrNumber.set(String(pr.number), key);
      allKeys.add(key);
    }
  }

  if (!allKeys.size) return;

  /** @type {{ success: boolean; data: Record<string, { statusName: string; statusCategoryKey: string; issueUrl: string }> }} */
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'JIRA_FETCH_ISSUES',
        jiraBaseUrl: settings.jiraBaseUrl,
        jiraEmail: settings.jiraEmail,
        jiraApiToken: settings.jiraApiToken,
        issueKeys: [...allKeys],
      },
      (res) => resolve(res ?? { success: false, data: {} }),
    );
  });

  if (!response.success) return;
  const statusMap = response.data;

  for (const el of prElements) {
    const prNumber = el.id.replace('issue_', '');
    const jiraKey = keyByPrNumber.get(prNumber);
    if (!jiraKey) continue;

    const issueData = statusMap[jiraKey];
    if (!issueData) continue;

    const details = el.querySelector('details');
    if (!details) continue;

    const badgeStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      marginLeft: '8px',
      marginRight: '6px',
      verticalAlign: 'middle',
      borderRadius: '3px',
      overflow: 'hidden',
      fontSize: '11px',
      fontFamily: 'Verdana,Geneva,DejaVu Sans,sans-serif',
      fontWeight: 'normal',
      lineHeight: '1',
      textDecoration: 'none',
    };

    const link = document.createElement('a');
    link.href = issueData.issueUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute(JIRA_UI_ATTR, '1');
    Object.assign(link.style, badgeStyle);

    const keySpan = document.createElement('span');
    keySpan.textContent = jiraKey;
    Object.assign(keySpan.style, {
      padding: '3px 6px',
      backgroundColor: '#555',
      color: '#fff',
    });

    const statusSpan = document.createElement('span');
    statusSpan.textContent = issueData.statusName;
    Object.assign(statusSpan.style, {
      padding: '3px 6px',
      backgroundColor: jiraStatusColor(issueData.statusCategoryKey),
      color: '#fff',
    });

    link.append(keySpan, statusSpan);
    details.insertAdjacentElement('afterend', link);
  }
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
