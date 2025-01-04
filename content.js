// @ts-check

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
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  /** @type {PullRequest[]} */
  const prs = await response.json();
  prs.sort((a, b) => (a.created_at).localeCompare(b.created_at));

  return prs;
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
 * @typedef {Object} TreeNode
 * @property {PullRequest} [pr]
 * @property {TreeNode[]} children
 * @property {Record<string, TreeNode>} [byHead]
 */

/**
 * @param {PullRequest[]} prs
 * @returns {TreeNode}
 */
function buildTree(prs) {
  /** @type {Record<string, TreeNode>} */
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
 * @param {TreeNode} tree
 * @param {PullRequest} pr
 * @returns {PullRequest}
 */
function getBaseBranch(tree, pr) {
  const basePR = tree.byHead?.[pr.base.ref]?.pr

  if (!basePR) return pr

  return getBaseBranch(tree, basePR);
}

/**
 * @param {TreeNode} tree
 * @param {PullRequest} pr
 * @returns {string}
 */
function getBaseBranchClass(tree, pr) {
  const baseBranch = getBaseBranch(tree, pr);

  // Generate pastel color based on PR number
  const hue = (Number(baseBranch.number) * 137.508) % 360; // Golden angle approximation
  return `hsl(${hue}, 70%, 85%)`; // High lightness, moderate saturation for pastel effect
}

async function reorderPRs() {

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
          depthLabel.style.backgroundColor = getBaseBranchClass(tree, pr);
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