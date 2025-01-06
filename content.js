// @ts-check

/**
 * TODO
 * - [ ] Add a button in the UI to toggle this feature.
 * - [ ] Add a button to filter PRs by approved-by:@me which is not currently supported in the UI.
 */

/**
 * @typedef {Object} PullRequest
 * @property {string} number
 * @property {string} created_at
 * @property {Object} base
 * @property {string} base.ref
 * @property {Object} head
 * @property {string} head.ref
 */

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<PullRequest[]>}
 */
async function getPullRequests(owner, repo, token) {
  const query = new URLSearchParams({
    state: 'open',
    per_page: '100',
    sort: 'created',
    direction: 'asc'
  });

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?${query}`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  return response.json();
}

/**
 * @returns {string}
 */
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
 * @returns {TreeNode}
 */
function buildTree(prs) {
  /** @type {PRHeads} */
  const byHead = {};
  /** @type {TreeNode} */
  const tree = { pr: undefined, children: [], byHead };

  for (const pr of prs) {
    byHead[pr.head.ref] = { pr, children: [] };
  }

  for (const pr of prs) {
    const leaf = byHead[pr.base.ref] || tree;

    leaf.children.push(byHead[pr.head.ref]);
  }

  return tree;
}

/**
 * @param {PRHeads} byHead
 * @param {PullRequest} pr
 * @returns {PullRequest}
 */
function getBaseBranch(byHead, pr) {
  const basePR = byHead[pr.base.ref]?.pr

  if (!basePR) return pr

  return getBaseBranch(byHead, basePR);
}

/**
 * @param {PRHeads} byHead
 * @param {PullRequest} pr
 * @returns {string}
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
  const qParam = searchParams.get('q') || '';

  // Check if sort:created-asc is already in the q parameter
  if (!qParam.includes('sort:created-asc')) {
    // Add sort:created-asc to the q parameter
    const newQParam = qParam ? `${qParam} sort:created-asc` : 'sort:created-asc';
    searchParams.set('q', newQParam);

    // Update the URL and reload the page
    window.location.href = url.toString();
  }
}

async function reorderPRs() {
  updateSortParameter();

  try {
    const token = getGithubToken();

    const pathParts = window.location.pathname.split('/');
    const owner = pathParts[1];
    const repo = pathParts[2];

    // Get the container and all PR elements
    const container = document.querySelector('.js-navigation-container');
    if (!container) return;

    // add class to container to prevent reordering on navigation
    if (container.classList.contains('reordered')) return;

    console.log('reordering PRs');
    container.classList.add('reordered');

    const prs = await getPullRequests(owner, repo, token);
    const prDataMap = new Map(prs.map(pr => [pr.number.toString(), pr]));

    // Build dependency tree
    const dependencyMap = new Map();
    const rootPRs = new Set();

    prs.forEach(pr => {
      const prNumber = pr.number.toString();
      const baseBranch = pr.base.ref;

      const parentPR = prs.find(otherPR => otherPR.head.ref === baseBranch);

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

    // Get all PR elements and convert to array for sorting
    const prElements = Array.from(container.children).filter(el => {
      const id = el.id;
      return id && id.startsWith('issue_');
    });

    const elementByPRNumber = {};

    for (const el of prElements) {
      const prNumber = el.id.replace('issue_', '');
      elementByPRNumber[prNumber] = el;
    }

    // clear container
    container.innerHTML = '';

    const tree = buildTree(prs);
    const { byHead = {} } = tree;

    /**
     * @param {TreeNode} node
     * @param {number} depth
     */
    function traverseTree(node, depth = 0) {
      const { pr, children } = node;
      if (pr && elementByPRNumber[pr.number]) {
        const el = elementByPRNumber[pr.number];
        container.appendChild(el);

        if (children.length > 0 || depth > 1) {
          const depthLabel = document.createElement('span');
          depthLabel.classList.add('base-branch-label');
          depthLabel.textContent = `${depth}`;
          depthLabel.style.backgroundColor = getBaseBranchColor(byHead, pr);
          const openedBySpan = el.querySelector('.opened-by');
          if (openedBySpan) {
            openedBySpan.parentNode.insertBefore(depthLabel, openedBySpan);
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