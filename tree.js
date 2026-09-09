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
 * @typedef {Object} GraphContext
 * @property {number} stackTotal
 * @property {number} stackPosition
 * @property {number} rootPrNumber
 * @property {number} branchSubtreeSize
 * @property {number | null} branchIndex
 * @property {number | null} branchTotal
 * @property {boolean} isBranchStart
 */

/**
 * @typedef {Object} GraphMeta
 * @property {number} depth
 * @property {number} branchCol
 * @property {boolean[]} ancestorContinues
 * @property {boolean} isLastChild
 * @property {boolean} hasChildren
 * @property {string} color
 * @property {number} stackTotal
 * @property {number} stackPosition
 * @property {number} rootPrNumber
 * @property {number} branchSubtreeSize
 * @property {number} childCount
 * @property {number | null} branchIndex
 * @property {number | null} branchTotal
 * @property {boolean} isBranchStart
 */

/**
 * @param {TreeNode} node
 * @returns {number}
 */
function countSubtree(node) {
  let count = node.pr ? 1 : 0;
  for (const child of node.children) {
    count += countSubtree(child);
  }
  return count;
}

/**
 * @param {GraphMeta} meta
 * @returns {string}
 */
function buildGraphHoverLabel(meta) {
  const {
    rootPrNumber,
    stackTotal,
    stackPosition,
    childCount,
    branchIndex,
    branchTotal,
    branchSubtreeSize,
    isBranchStart,
  } = meta;
  const root = `root #${rootPrNumber}`;

  if (childCount > 1) {
    const prWord = stackTotal === 1 ? 'PR' : 'PRs';
    return `${childCount} branches · ${stackTotal} ${prWord} total · ${root}`;
  }
  if (
    isBranchStart &&
    branchIndex != null &&
    branchTotal != null &&
    branchIndex > 0
  ) {
    const branchNum = branchIndex + 1;
    const prWord = branchSubtreeSize === 1 ? 'PR' : 'PRs';
    return `Branch ${branchNum} of ${branchTotal} · ${branchSubtreeSize} ${prWord} in branch · ${root}`;
  }
  return `Stack of ${stackTotal} · position ${stackPosition} · ${root}`;
}

/**
 * @param {PRHeads} byHead
 * @param {PullRequestNode} pr
 * @param {string | string[] | undefined} [ignoreBases]
 * @returns {string}
 */
function getBaseBranchLineColor(byHead, pr, ignoreBases) {
  const baseBranch = getBaseBranch(byHead, pr, ignoreBases);
  const hue = (Number(baseBranch.number) * 137.508) % 360;
  return `hsl(${hue}, 80%, 50%)`;
}

/**
 * @param {TreeNode} node
 * @param {number} depth
 * @param {boolean[]} ancestorContinues
 * @param {boolean} isLastChild
 * @param {number} branchCol
 * @param {PRHeads} byHead
 * @param {string | string[] | undefined} ignoreBases
 * @param {GraphContext} graphContext
 * @returns {GraphMeta | null}
 */
function computeGraphMeta(
  node,
  depth,
  ancestorContinues,
  isLastChild,
  branchCol,
  byHead,
  ignoreBases,
  graphContext,
) {
  const { pr, children } = node;
  if (!pr) return null;

  return {
    depth,
    branchCol,
    ancestorContinues: [...ancestorContinues],
    isLastChild,
    hasChildren: children.length > 0,
    color: getBaseBranchLineColor(byHead, pr, ignoreBases),
    ...graphContext,
    childCount: children.length,
  };
}
