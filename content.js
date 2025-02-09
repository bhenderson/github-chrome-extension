// @ts-check

// TODO
// - [ ] Add a button in the UI to toggle this feature.
// - [ ] Add a button to filter PRs by approved-by:@me which is not currently supported in the UI.

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

function setupPersistSortHandler() {
  // When the option changes, if we're setting it to true and sort is not applied, apply the default.
  globalOptions.watch('persistSortAsc', value => {
    const hasSort = queryHandler.get('sort');
    if (!value || hasSort) return;

    queryHandler.set([{ key: 'sort', value: 'created-asc', negative: false }]);
  }, true)
}

async function handlePRList() {
  // Make sure we have a token
  const { token } = globalOptions;
  if (!token) return;

  // Get the container and all PR elements
  const container = document.querySelector('.js-navigation-container');
  if (!container) return;

  setupPersistSortHandler();
  return;

  // Get all PR elements and convert to array for sorting
  const prElements = Array.from(container.children).filter(el => el.id?.startsWith('issue_'));

  const { currentUser, pullRequests } = await getPullRequests();

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
}

function prListPage() {
  const pathParts = window.location.pathname.split('/');

  const owner = pathParts[1];
  const repo = pathParts[2];
  const pulls = pathParts[3] === 'pulls';

  return { pulls, owner, repo };
}

function onLoad() {
  console.log('onLoadddddddd');
  if (!prListPage().pulls) return;

  extendFilters();
  addControlMenu();

  handlePRList();
}

window.addEventListener('load', onLoad);

// Listen for Turbo navigation events
document.addEventListener('turbo:render', () => {
  console.log('turbo:render');
  setTimeout(() => {
    onLoad()
  }, 500);
});