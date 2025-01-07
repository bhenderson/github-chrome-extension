// @ts-check

/**
 * TODO
 * - [ ] Add a button in the UI to toggle this feature.
 * - [ ] Add a button to filter PRs by approved-by:@me which is not currently supported in the UI.
 */

/**
 * @typedef {Object} Review
 * @property {string} author
 * @property {Date} submittedAt
 * @property {'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'} state
 * @property {string} html_url
 */

/**
 * @typedef {Object} PullRequest
 * @property {number} number
 * @property {string} title
 * @property {string} url
 * @property {Date} createdAt
 * @property {string} baseRefName
 * @property {string} headRefName
 * @property {string} author
 * @property {Review[]} reviews
 * @property {'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null} reviewDecision
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
 *   createdAt: string,
 *   author: {
 *     login: string
 *   },
 *   baseRefName: string,
 *   headRefName: string,
 *   reviews: {
 *     nodes: Array<{
 *       author: {
 *         login: string,
 *         url: string
 *       },
 *       submittedAt: string,
 *       state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
 *     }>
 *   },
 *   reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
 * }>} data.repository.pullRequests.nodes
 */

/**
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<{currentUser: string, pullRequests: PullRequest[]}>}
 */
async function getPullRequests(token, owner, repo) {
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
          createdAt 
          author { 
            login 
          }
          baseRefName
          headRefName 
          reviews(first: 100, states: [APPROVED]) { 
            nodes { 
              author { 
                login
                url
              } 
              submittedAt 
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
      createdAt: new Date(pr.createdAt),
      author: pr.author.login,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      reviews: pr.reviews.nodes.map(review => /** @type {Review} */({
        author: review.author.login,
        submittedAt: new Date(review.submittedAt),
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

function updateSortParameter() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  // when the UI loads, this is the default, but it isn't in the URL. without it, if we set the q param, it clears out the defaults.
  const defaultQuery = 'is:open is:pr';
  const qParam = searchParams.get('q') || defaultQuery;
  let newQParam = qParam

  // Make sure that PRs are sorted by creation time so help aid in viewing the tree.
  if (!qParam.includes('sort:created-asc')) {
    newQParam += ' sort:created-asc';
  }

  newQParam = newQParam.trim();

  if (qParam !== newQParam) {
    searchParams.set('q', newQParam);
    // Update the URL and reload the page
    window.location.href = url.toString();
  }
}

/**
 * @param {PullRequest} pr
 * @param {string} currentUser
 */
function getApprovalSpan(pr, currentUser) {
  if (pr.reviews.length === 0) return;

  const approved = pr.reviewDecision === 'APPROVED';
  const dot = ' • ';
  const span = document.createElement('span');
  span.classList.add('ml-1');

  span.append(approved ? ' by ' : dot + '(Approved by ');

  const children = pr.reviews.flatMap(review => {
    const statusEl = document.createElement('a');
    statusEl.href = review.html_url;
    statusEl.textContent = review.author === currentUser ? 'you' : review.author;
    return [statusEl, ', '];
  });

  // remove last comma
  children.pop();
  span.append(...children);

  if (!approved) {
    span.append(')')
  }

  return span;
}

async function reorderPRs() {
  try {
    const pathParts = window.location.pathname.split('/');

    if (!pathParts.includes('pulls')) return;

    const owner = pathParts[1];
    const repo = pathParts[2];

    updateSortParameter();
    const token = getGithubToken();


    // Get the container and all PR elements
    const container = document.querySelector('.js-navigation-container');
    if (!container) return;

    // add class to container to prevent reordering on navigation
    if (container.classList.contains('reordered')) return;

    console.log('reordering PRs');
    container.classList.add('reordered');

    // Get all PR elements and convert to array for sorting
    const prElements = Array.from(container.children).filter(el => {
      const id = el.id;
      return id && id.startsWith('issue_');
    });

    const { currentUser, pullRequests } = await getPullRequests(token, owner, repo);

    // Build dependency tree
    const dependencyMap = new Map();
    const rootPRs = new Set();

    pullRequests.forEach(pr => {
      const prNumber = pr.number.toString();
      const baseBranch = pr.baseRefName;

      const parentPR = pullRequests.find(otherPR => otherPR.headRefName === baseBranch);

      if (parentPR) {
        const parentNumber = parentPR.number.toString();
        if (!dependencyMap.has(parentNumber)) {
          dependencyMap.set(parentNumber, new Set());
        }
        dependencyMap.get(parentNumber).add(prNumber);
      } else {
        rootPRs.add(prNumber);
      }
    });

    /** @type {Record<string, Element>} Maps PR number to their DOM element */
    const elementByPRNumber = {};

    for (const el of prElements) {
      const prNumber = el.id.replace('issue_', '');
      elementByPRNumber[prNumber] = el;
    }

    // clear container
    container.innerHTML = '';

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

        container?.appendChild(el);

        if (children.length > 0 || depth > 1) {
          const depthLabel = document.createElement('span');
          depthLabel.classList.add('base-branch-label');
          depthLabel.textContent = `${depth}`;
          depthLabel.style.backgroundColor = getBaseBranchColor(byHead, pr);
          const openedBySpan = el.querySelector('.opened-by');
          const statusSpan = openedBySpan?.parentNode;

          statusSpan?.prepend(depthLabel, ' ');

          const approvalSpan = getApprovalSpan(pr, currentUser);
          if (approvalSpan) {
            statusSpan?.append(approvalSpan);
          }
        }
      }
      for (const child of children) {
        traverseTree(child, depth + 1);
      }
    }

    traverseTree(tree);

  } catch (error) {
    console.error('Error fetching PRs:', error);
    if (error.status === 401) {
      localStorage.removeItem('github_token');
      reorderPRs();
    }
  }
}

// Run immediately
reorderPRs();

// Listen for Turbo navigation events
document.addEventListener('turbo:render', () => {
  // Only run if we're on a PR list page
  if (window.location.pathname.endsWith('/pulls')) {
    reorderPRs();
  }
});