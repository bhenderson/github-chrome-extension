// @ts-check

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
 * @returns {Promise<{currentUser: string, pullRequests: PullRequest[]}>}
 */
async function getPullRequests() {
  const { owner, repo } = prListPage();
  const { token } = globalOptions;
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
