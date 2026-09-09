/**
 * @fileoverview Runs on github.com: merges GitHub `q` search options (sort oldest, drafts, author);
 * optional dependency reorder and approval-based row filtering on the pulls list (token + GraphQL when needed).
 */

/// <reference path="./types/github-extension-global.d.ts" />
/// <reference path="./tree.js" />
/// <reference path="./github-prs.js" />
/// <reference path="./pulls-list-dom.js" />
/// <reference path="./graph-svg.js" />

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

/** Marks extension-injected dependency graph gutter on a row. */
const GRAPH_ATTR = 'data-gce-graph';

const GRAPH_GUTTER_CLASS = 'gce-graph-gutter';
const DEP_LIST_CLASS = 'gce-dep-list';

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
 * Appends approved / changes-requested reviewer names next to the PR review label.
 * @param {Object} pr
 * @param {HTMLElement} rowEl
 */
function showReviewers(pr, rowEl) {
  const node = getReviewerContainer(rowEl);
  if (!node) return;

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

  switch (p.reviewDecision ?? PullRequestReviewDecision.NONE) {
    case PullRequestReviewDecision.CHANGES_REQUESTED: {
      const crElements = createReviewElements(changesRequestedReviews);
      if (crElements) {
        node.append(crElements);
      }
      if (approvedReviews.length) {
        const span = document.createElement('span');
        span.classList.add('ml-1');
        span.setAttribute(REVIEW_UI_ATTR, '1');
        span.innerText = ' • Approved';
        node.append(span);
        const approvedElements = createReviewElements(approvedReviews);
        if (approvedElements) {
          node.append(approvedElements);
        }
      }
      break;
    }
    case PullRequestReviewDecision.APPROVED: {
      const approvedElements = createReviewElements(approvedReviews);
      if (approvedElements) {
        node.append(approvedElements);
      }
      if (changesRequestedReviews.length) {
        const span = document.createElement('span');
        span.classList.add('ml-1');
        span.setAttribute(REVIEW_UI_ATTR, '1');
        span.innerText = ' • Changes requested';
        node.append(span);
        const crElements = createReviewElements(changesRequestedReviews);
        if (crElements) {
          node.append(crElements);
        }
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
 * @returns {{ container?: HTMLElement, prElements?: HTMLElement[] }}
 */
function getPRElements() {
  const container = getPullsListContainer();
  if (!container) return {};

  const prElements = getPullsListRows();
  if (!prElements.length) return {};

  return { container, prElements };
}

/**
 * @param {HTMLElement} el
 */
function clearGraphFromRow(el) {
  el.classList.remove('gce-dep-chain');
  el.removeAttribute(GRAPH_ATTR);
  el.removeAttribute('data-gce-layout');
}

/**
 * @param {HTMLElement} container
 */
function clearGraphGutters(container) {
  for (const gutter of container.querySelectorAll(`.${GRAPH_GUTTER_CLASS}`)) {
    gutter.remove();
  }
}

/**
 * @param {HTMLElement[]} prElements
 * @param {HTMLElement} [container]
 */
function clearGraphFromRows(prElements, container) {
  for (const el of prElements) {
    clearGraphFromRow(el);
  }
  if (container) {
    clearGraphGutters(container);
    clearGraphListGutter(container);
  }
}

/**
 * @param {HTMLElement} container
 */
function clearGraphListGutter(container) {
  container.classList.remove(DEP_LIST_CLASS);
  container.style.removeProperty('--gce-list-gutter');
}

/**
 * @param {HTMLElement} container
 * @param {'legacy' | 'listview'} layout
 * @param {number} gutterWidthPx
 */
function applyGraphListGutter(container, layout, gutterWidthPx) {
  const gap = layout === 'listview' ? 6 : 4;
  container.classList.add(DEP_LIST_CLASS);
  container.style.setProperty('--gce-list-gutter', `${gutterWidthPx + gap}px`);
}

/**
 * @typedef {Object} PendingGraphState
 * @property {HTMLElement} container
 * @property {'legacy' | 'listview'} layout
 * @property {number} gutterWidthPx
 * @property {Map<string, GraphMeta>} graphMetaByPr
 * @property {Record<string, HTMLElement>} elementByPRNumber
 */

/**
 * Gutter is a child of the list container at left:0 (inside ul padding), not inside the row,
 * so ancestor overflow on ListView rows does not clip it.
 * @param {HTMLElement} container
 * @param {HTMLElement} row
 * @param {GraphMeta} graphMeta
 * @param {'legacy' | 'listview'} layout
 * @param {number} gutterWidthPx
 */
function applyGraphToRow(container, row, graphMeta, layout, gutterWidthPx) {
  const label = buildGraphHoverLabel(graphMeta);
  const gutter = document.createElement('img');
  gutter.className = GRAPH_GUTTER_CLASS;
  gutter.setAttribute(GRAPH_ATTR, '1');
  gutter.setAttribute('aria-label', label);
  gutter.title = label;
  gutter.alt = '';
  gutter.src = buildRowGraphSvg(graphMeta, gutterWidthPx);
  gutter.style.width = `${gutterWidthPx}px`;
  gutter.style.top = `${row.offsetTop}px`;
  gutter.style.height = `${row.offsetHeight}px`;
  container.append(gutter);

  row.setAttribute(GRAPH_ATTR, '1');
  row.classList.add('gce-dep-chain');
  row.setAttribute('data-gce-layout', layout);
}

/**
 * @param {PendingGraphState} state
 */
function applyGraphsToList(state) {
  const { container, layout, gutterWidthPx, graphMetaByPr, elementByPRNumber } =
    state;
  if (!gutterWidthPx || graphMetaByPr.size === 0) return;

  applyGraphListGutter(container, layout, gutterWidthPx);
  for (const [prNumber, graphMeta] of graphMetaByPr) {
    const row = elementByPRNumber[prNumber];
    if (row) {
      applyGraphToRow(container, row, graphMeta, layout, gutterWidthPx);
    }
  }
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
 * @returns {Promise<PendingGraphState | null>}
 */
async function setDependencySort(settings, viewerLogin, pullRequests) {
  const { container, prElements } = getPRElements();
  if (!container || !prElements?.length) return null;

  const pathParts = window.location.pathname.split('/');
  const owner = pathParts[1];
  const repo = pathParts[2];
  if (!owner || !repo) return null;

  currentUser = viewerLogin;
  const layout = detectPullsListLayout();
  if (!layout) return null;

  clearGraphFromRows(prElements, container);

  const elementByPRNumber = /** @type {Record<string, HTMLElement>} */ ({});
  for (const el of prElements) {
    const prNumber = getPrNumberFromRow(el);
    if (prNumber) {
      elementByPRNumber[prNumber] = el;
    }
  }

  const fallbackToDefaultOrder = () => {
    for (const el of prElements) {
      el.dataset[dependencySortKey] = el.dataset[defaultSortKey] ?? '0';
    }
  };

  if (!pullRequests.length) {
    fallbackToDefaultOrder();
    return null;
  }

  const hasMatchingPRs = pullRequests.some((pr) => elementByPRNumber[String(pr.number)]);
  if (!hasMatchingPRs) {
    fallbackToDefaultOrder();
    return null;
  }

  const ignoreBases = settings.ignoreDependencyBases;
  const tree = buildTree(pullRequests, ignoreBases);
  const { byHead = {} } = tree;
  let sortIndex = 0;
  /** @type {Map<number, number>} */
  const stackTotalByRootPr = new Map();
  /** @type {Map<number, number>} */
  const stackPositionByRootPr = new Map();
  /** @type {Map<string, GraphMeta>} */
  const graphMetaByPr = new Map();

  /**
   * @param {*} node
   * @param {number} depth
   */
  function indexChainRoots(node, depth = 0) {
    if (depth === 1 && node.pr) {
      stackTotalByRootPr.set(node.pr.number, countSubtree(node));
    }
    for (const child of node.children) {
      indexChainRoots(child, depth + 1);
    }
  }
  indexChainRoots(tree);

  /**
   * @param {*} node
   * @param {number} depth
   * @param {number} parentChildCount
   * @param {number} siblingIndex
   */
  function traverseTree(node, depth = 0, parentChildCount = 0, siblingIndex = 0) {
    const { pr, children } = node;
    if (pr && elementByPRNumber[String(pr.number)]) {
      const el = elementByPRNumber[String(pr.number)];
      const isInChain = children.length > 0 || depth > 1;

      el.dataset[dependencySortKey] = String(sortIndex++);

      for (const child of Array.from(el.querySelectorAll(`[${REVIEW_UI_ATTR}]`))) {
        child.remove();
      }

      if (isInChain) {
        const rootPr = getBaseBranch(byHead, pr, ignoreBases);
        const rootPrNumber = rootPr.number;
        const stackTotal = stackTotalByRootPr.get(rootPrNumber) ?? countSubtree(node);
        const stackPosition = (stackPositionByRootPr.get(rootPrNumber) ?? 0) + 1;
        stackPositionByRootPr.set(rootPrNumber, stackPosition);

        const branchIndex =
          depth > 1 && parentChildCount > 1 ? siblingIndex : null;
        const branchTotal =
          depth > 1 && parentChildCount > 1 ? parentChildCount : null;
        const isBranchStart = depth > 1 && siblingIndex > 0;

        const graphMeta = computeGraphMeta(node, depth, byHead, ignoreBases, {
          stackTotal,
          stackPosition,
          rootPrNumber,
          branchSubtreeSize: countSubtree(node),
          branchIndex,
          branchTotal,
          isBranchStart,
        });
        if (graphMeta) {
          graphMetaByPr.set(String(pr.number), graphMeta);
        }
      }

      showReviewers(pr, el);
    }

    for (let i = 0; i < children.length; i++) {
      traverseTree(children[i], depth + 1, children.length, i);
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

  if (graphMetaByPr.size === 0) return null;

  return {
    container,
    layout,
    gutterWidthPx: computeGutterWidth(),
    graphMetaByPr,
    elementByPRNumber,
  };
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
    const num = getPrNumberFromRow(el);
    if (!num) continue;
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
    const { container, prElements } = getPRElements();
    if (prElements?.length) {
      clearGraphFromRows(prElements, container);
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

  /** @type {PendingGraphState | null} */
  let graphState = null;
  if (settings.groupByDependency) {
    graphState = await setDependencySort(settings, viewerLogin, pullRequests);
  } else {
    const { container, prElements } = getPRElements();
    if (prElements?.length) {
      clearGraphFromRows(prElements, container);
    }
  }

  const { prElements } = getPRElements();
  if (prElements?.length) {
    applyApprovalDatasetsToRows(prElements, pullRequests, viewerLogin);
  }

  sortByKey(settings);

  if (graphState) {
    const { container } = getPRElements();
    if (container) {
      clearGraphGutters(container);
      applyGraphsToList({ ...graphState, container });
    }
  }

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

  const layout = detectPullsListLayout();

  for (const el of prElements) {
    const prNumber = getPrNumberFromRow(el);
    if (!prNumber) continue;

    const jiraKey = keyByPrNumber.get(prNumber);
    if (!jiraKey) continue;

    const issueData = statusMap[jiraKey];
    if (!issueData) continue;

    const container = getJiraBadgeContainer(el);
    if (!container) continue;

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

    if (layout === 'listview') {
      const sep = document.createElement('span');
      sep.setAttribute(JIRA_UI_ATTR, '1');
      sep.textContent = ' · ';
      container.append(sep, link);
    } else {
      container.append(link);
    }
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
