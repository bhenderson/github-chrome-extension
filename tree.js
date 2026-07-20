/**
 * @fileoverview Build a PR dependency tree from base/head ref names (matches another branch’s head).
 */

/**
 * @typedef {Object} PullRequestNode
 * @property {number} number
 * @property {string} headRefName
 * @property {string} baseRefName
 * @property {Array<{ author: string; state: string; html_url: string }>} [reviews]
 * @property {string | null} [reviewDecision]
 */

/**
 * @typedef {Object} TreeNode
 * @property {PullRequestNode | undefined} pr
 * @property {TreeNode[]} children
 * @property {Record<string, TreeNode>} [byHead]
 */

/**
 * @typedef {Record<string, TreeNode>} PRHeads
 */

/**
 * @param {string | string[] | undefined} ignoreBases
 * @returns {Set<string>}
 */
function toIgnoreBaseSet(ignoreBases) {
  const list = Array.isArray(ignoreBases)
    ? ignoreBases
    : typeof ignoreBases === 'string'
      ? ignoreBases.split(',')
      : [];
  return new Set(list.map((s) => s.trim()).filter(Boolean));
}

/**
 * @param {PullRequestNode[]} prs
 * @param {string | string[] | undefined} [ignoreBases] Base refs that never resolve to another open PR as parent.
 * @returns {TreeNode}
 */
function buildTree(prs, ignoreBases) {
  /** @type {PRHeads} */
  const byHead = {};
  /** @type {TreeNode} */
  const tree = { pr: undefined, children: [], byHead };
  const ignore = toIgnoreBaseSet(ignoreBases);

  for (const pr of prs) {
    byHead[pr.headRefName] = { pr, children: [] };
  }

  for (const pr of prs) {
    const leaf =
      ignore.has(pr.baseRefName) || !byHead[pr.baseRefName]
        ? tree
        : byHead[pr.baseRefName];

    leaf.children.push(byHead[pr.headRefName]);
  }

  return tree;
}

/**
 * @param {PRHeads} byHead
 * @param {PullRequestNode} pr
 * @param {string | string[] | undefined} [ignoreBases]
 * @returns {PullRequestNode}
 */
function getBaseBranch(byHead, pr, ignoreBases) {
  const ignore = toIgnoreBaseSet(ignoreBases);
  if (ignore.has(pr.baseRefName)) return pr;

  const basePR = byHead[pr.baseRefName]?.pr;

  if (!basePR) return pr;

  return getBaseBranch(byHead, basePR, ignoreBases);
}

/**
 * @param {PRHeads} byHead
 * @param {PullRequestNode} pr
 * @param {string | string[] | undefined} [ignoreBases]
 * @returns {string}
 */
function getBaseBranchColor(byHead, pr, ignoreBases) {
  const baseBranch = getBaseBranch(byHead, pr, ignoreBases);

  const hue = (Number(baseBranch.number) * 137.508) % 360;
  return `hsl(${hue}, 70%, 85%)`;
}
