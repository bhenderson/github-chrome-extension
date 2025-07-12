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
  const { owner, repo } = getLocationInfo();
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


  if (!token) {
    console.info(`Github Chrome Extension: Token was not provided. Exiting...`)

    return
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  /** @type {GraphQLResponse | GraphQLError} */
  const data = await response.json();

  if ('status' in data && data.status !== '200') {
    if (data.status === '401') {
      console.error(`Github Chrome Extension Error: Authorization Error. Is your Github token valid? (Check "github-chrome-extension.githubToken" in localstorage)`)
    } else {
      throw new Error(`Github Chrome Extension Error: ${data.message}`)
    }
    
    throw new Error(JSON.stringify(data))
  } 

  /** @ts-expect-error @type {GraphQLResponse} - Type guard does not work well here... Should be a success type */
  const responseData = data
  
  return {
    currentUser: responseData.data.viewer.login,
    pullRequests: responseData.data.repository.pullRequests.nodes.map(pr => /** @type {PullRequest} */({
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
