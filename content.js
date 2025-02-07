// @ts-check

// TODO
// - [ ] Add a button in the UI to toggle this feature.
// - [ ] Add a button to filter PRs by approved-by:@me which is not currently supported in the UI.


const PullRequestReviewState = /** @type {const} */ ({
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  COMMENTED: 'COMMENTED',
  DISMISSED: 'DISMISSED',
  PENDING: 'PENDING'
});

/** @typedef {typeof PullRequestReviewState[keyof typeof PullRequestReviewState]} PullRequestReviewState */

/**
 * @typedef {Object} Review
 * @property {string} author
 * @property {PullRequestReviewState} state
 * @property {string} html_url
 */

const PullRequestReviewDecision = /** @type {const} */ ({
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  NONE: null
});

/** @typedef {typeof PullRequestReviewDecision[keyof typeof PullRequestReviewDecision]} PullRequestReviewDecision */

/**
 * @typedef {Object} PullRequest
 * @property {number} number
 * @property {string} title
 * @property {string} url
 * @property {string} baseRefName
 * @property {string} headRefName
 * @property {string} author
 * @property {Review[]} reviews
 * @property {PullRequestReviewDecision} reviewDecision
 */

/**
 * @typedef {Object} GraphQLResponse
 * @property {Object} data
 * @property {Object} data.viewer
 * @property {string} data.viewer.login
 * @property {Object} data.repository
 * @property {Object} data.repository.pullRequests
 * @property {Array<{
 *   number: number,
 *   title: string,
 *   url: string,
 *   author: {
 *     login: string
 *   },
 *   baseRefName: string,
 *   headRefName: string,
 *   latestReviews: {
 *     nodes: Array<{
 *       author: {
 *         login: string,
 *         url: string
 *       },
 *       state: PullRequestReviewState
 *     }>
 *   },
 *   reviewDecision: PullRequestReviewDecision
 * }>} data.repository.pullRequests.nodes
 */

/**
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<{currentUser: string, pullRequests: PullRequest[]}>}
 */
async function getPullRequests(owner, repo) {
  const token = getGithubToken();
  const query = `query { 
    viewer {
      login
    }
    repository(owner: "${owner}", name: "${repo}") { 
      pullRequests(first: 100, states: [OPEN]) { 
        nodes { 
          number 
          title 
          url 
          author { 
            login 
          }
          baseRefName
          headRefName 
          latestReviews(first: 100) { 
            nodes { 
              author { 
                login
                url
              } 
              state 
            } 
          } 
          reviewDecision 
        } 
      } 
    } 
  }`;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  /** @type {GraphQLResponse} */
  const data = await response.json();

  return {
    currentUser: data.data.viewer.login,
    pullRequests: data.data.repository.pullRequests.nodes.map(pr => /** @type {PullRequest} */({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      author: pr.author.login,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      reviews: pr.latestReviews.nodes.map(review => /** @type {Review} */({
        author: review.author.login,
        state: review.state,
        html_url: review.author.url,
      })),
      reviewDecision: pr.reviewDecision,
    }))
  };
}

function getGithubToken() {
  let token = localStorage.getItem('github_token');

  if (!token) {
    token = prompt('Please enter your GitHub API token:');
    if (token) {
      localStorage.setItem('github_token', token);
    }
  }

  if (!token) {
    throw new Error('GitHub token not provided');
  }

  return token;
}

/**
 * @typedef {Record<string, TreeNode>} PRHeads
 */

/**
 * @typedef {Object} TreeNode
 * @property {PullRequest} [pr]
 * @property {TreeNode[]} children
 * @property {PRHeads} [byHead]
 */

/**
 * @param {PullRequest[]} prs
 */
function buildTree(prs) {
  /** @type {PRHeads} */
  const byHead = {};
  /** @type {TreeNode} */
  const tree = { pr: undefined, children: [], byHead };

  for (const pr of prs) {
    byHead[pr.headRefName] = { pr, children: [] };
  }

  for (const pr of prs) {
    const leaf = byHead[pr.baseRefName] || tree;

    leaf.children.push(byHead[pr.headRefName]);
  }

  return tree;
}

/**
 * @param {PRHeads} byHead
 * @param {PullRequest} pr
 */
function getBaseBranch(byHead, pr) {
  const basePR = byHead[pr.baseRefName]?.pr

  if (!basePR) return pr

  return getBaseBranch(byHead, basePR);
}

/**
 * @param {PRHeads} byHead
 * @param {PullRequest} pr
 */
function getBaseBranchColor(byHead, pr) {
  const baseBranch = getBaseBranch(byHead, pr);

  // Generate pastel color based on PR number
  const hue = (Number(baseBranch.number) * 137.508) % 360; // Golden angle approximation
  return `hsl(${hue}, 70%, 85%)`; // High lightness, moderate saturation for pastel effect
}

/**
 * @template T
 * @param {Array<T>} array
 * @param {(value: T) => boolean} predicate
 * @returns {[Array<T>, Array<T>]}
 */
function partition(array, predicate) {
  const initial = /** @type {[Array<T>, Array<T>]} */ ([[], []]);

  return array.reduce(([a, b], value) => ((predicate(value) ? a : b).push(value), [a, b]), initial);
}

/**
 * @param {Review[]} reviews
 * @param {string} currentUser
 * @returns {HTMLElement | null}
 */
function createReviewElements(reviews, currentUser) {
  if (!reviews.length) return null;

  const span = document.createElement('span');
  span.classList.add('ml-1');

  span.append(' by ');

  const children = reviews.flatMap(review => {
    const statusEl = document.createElement('a');
    statusEl.href = review.html_url;
    statusEl.textContent = review.author === currentUser ? 'you' : review.author;
    return [statusEl, ', '];
  });

  // remove last comma
  children.pop();
  span.append(...children);

  return span;
}

/**
 * Adds reviewer names to the PR description.
 * 
 * @example
 * ```
 * • Approved by user1, you, user2
 * ```
 * 
 * @param {PullRequest} pr
 * @param {string} currentUser
 * @param {HTMLElement} node
 */
function showReviewers(pr, currentUser, node) {
  const reviews = pr.reviews.filter(review => review.state === PullRequestReviewState.APPROVED || review.state === PullRequestReviewState.CHANGES_REQUESTED);
  if (reviews.length === 0) return;

  const [approvedReviews, changesRequestedReviews] = partition(reviews, review => review.state === PullRequestReviewState.APPROVED);
  const lastChild = node.children[node.children.length - 1]

  if (!lastChild) return;

  switch (pr.reviewDecision) {
    case PullRequestReviewDecision.CHANGES_REQUESTED: {
      const reviewElements = createReviewElements(changesRequestedReviews, currentUser);
      if (reviewElements) {
        node.append(reviewElements)
      }
      if (!approvedReviews.length) break;

      const span = document.createElement('span');
      span.classList.add('ml-1');
      span.innerText = ' • Approved ';
      node.append(span);
      // fall through
    }
    case PullRequestReviewDecision.APPROVED: {
      const reviewElements = createReviewElements(approvedReviews, currentUser);
      if (reviewElements) {
        node.append(reviewElements)
      }
      break;
    }
    case PullRequestReviewDecision.REVIEW_REQUIRED:
      break;
    case PullRequestReviewDecision.NONE:
      break;
  }
}

async function handlePRList() {
  try {
    const { pulls, owner, repo } = prListPage();
    if (!pulls) return;

    // Get the container and all PR elements
    const container = document.querySelector('.js-navigation-container');
    if (!container) return;

    // add class to container to prevent reordering on navigation
    if (container.classList.contains('reordered')) return;
    container.classList.add('reordered');

    // Get all PR elements and convert to array for sorting
    const prElements = Array.from(container.children).filter(el => {
      const id = el.id;
      return id && id.startsWith('issue_');
    });

    const { currentUser, pullRequests } = await getPullRequests(owner, repo);

    /** @type {Record<string, Element>} Maps PR number to their DOM element */
    const elementByPRNumber = {};

    for (const el of prElements) {
      const prNumber = el.id.replace('issue_', '');
      elementByPRNumber[prNumber] = el;
    }

    const hasMatchingPRs = pullRequests.some(pr => elementByPRNumber[pr.number]);
    if (!hasMatchingPRs) return;

    const tree = buildTree(pullRequests);
    const { byHead = {} } = tree;

    /**
     * @param {TreeNode} node
     * @param {number} depth
     */
    function traverseTree(node, depth = 0) {
      const { pr, children } = node;
      if (pr && elementByPRNumber[pr.number]) {
        const el = elementByPRNumber[pr.number];
        // is this PR part of a chain of dependencies?
        const isInChain = children.length > 0 || depth > 1;

        // re add to container in order of dependency
        container?.appendChild(el);

        const openedBySpan = el.querySelector('.opened-by');
        const statusSpan = openedBySpan?.parentElement;

        if (!statusSpan) return;

        if (isInChain) {
          const depthLabelContainer = document.createElement('div');
          const depthLabel = document.createElement('span');
          depthLabel.classList.add('base-branch-label');
          depthLabel.textContent = `${depth}`;
          depthLabel.style.backgroundColor = getBaseBranchColor(byHead, pr);
          depthLabelContainer.appendChild(depthLabel);

          statusSpan.prepend(depthLabel, ' ');
        }
        showReviewers(pr, currentUser, statusSpan);
      }
      for (const child of children) {
        traverseTree(child, depth + 1);
      }
    }

    // clear container
    container.innerHTML = '';

    traverseTree(tree);

  } catch (error) {
    console.error('Error fetching PRs:', error);
    if (error.status === 401) {
      localStorage.removeItem('github_token');
      handlePRList();
    }
  }
}

function prListPage() {
  const pathParts = window.location.pathname.split('/');

  const owner = pathParts[1];
  const repo = pathParts[2];
  const pulls = pathParts[3] === 'pulls';

  return { pulls, owner, repo };
}

function onLoad() {
  globalThis.setupSearchInterceptor();
  globalThis.extendFilters();
  handlePRList();
}

// Run immediately
onLoad();

// Listen for Turbo navigation events
document.addEventListener('turbo:render', () => {
  // Only run if we're on a PR list page
  if (prListPage().pulls) {
    onLoad();
  }
});
