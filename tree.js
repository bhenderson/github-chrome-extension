// @ts-check

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
