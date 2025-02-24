// @ts-check

const PullRequestReviewState = /** @type {const} */ ({
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  COMMENTED: 'COMMENTED',
  DISMISSED: 'DISMISSED',
  PENDING: 'PENDING'
});


const PullRequestReviewDecision = /** @type {const} */ ({
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  NONE: null
});

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
