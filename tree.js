/**
 * @fileoverview Build a PR dependency tree from base/head ref names (matches another branch’s head).
 */

/**
 * @typedef {Object} PullRequestNode
 * @property {number} number
 * @property {string} headRefName
 * @property {string} baseRefName
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
 * @param {PullRequestNode[]} prs
 * @returns {TreeNode}
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
 * @param {PullRequestNode} pr
 * @returns {PullRequestNode}
 */
function getBaseBranch(byHead, pr) {
  const basePR = byHead[pr.baseRefName]?.pr;

  if (!basePR) return pr;

  return getBaseBranch(byHead, basePR);
}

/**
 * @param {PRHeads} byHead
 * @param {PullRequestNode} pr
 * @returns {string}
 */
function getBaseBranchColor(byHead, pr) {
  const baseBranch = getBaseBranch(byHead, pr);

  const hue = (Number(baseBranch.number) * 137.508) % 360;
  return `hsl(${hue}, 70%, 85%)`;
}
