/**
 * @fileoverview GraphQL fetch of open pull requests (refs + reviews) for dependency ordering and UI.
 */

/// <reference path="./types/github-extension-global.d.ts" />
/// <reference path="./tree.js" />

/**
 * @typedef {Object} PullRequestReview
 * @property {string} author
 * @property {string} state
 * @property {string} html_url
 */

/**
 * @typedef {Object} PullRequestWithReviews
 * @property {number} number
 * @property {string} headRefName
 * @property {string} baseRefName
 * @property {PullRequestReview[]} reviews
 * @property {string | null} reviewDecision
 */

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<{ viewerLogin: string; pullRequests: PullRequestWithReviews[] }>}
 */
async function fetchOpenPullRequestsForRepo(owner, repo, token) {
  if (!token) {
    return { viewerLogin: '', pullRequests: [] };
  }

  const query = `query OpenPullRequests($owner: String!, $name: String!) {
    viewer {
      login
    }
    repository(owner: $owner, name: $name) {
      pullRequests(first: 100, states: [OPEN]) {
        nodes {
          number
          headRefName
          baseRefName
          reviewDecision
          latestReviews(first: 100) {
            nodes {
              state
              author {
                login
                url
              }
            }
          }
        }
      }
    }
  }`;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { owner, name: repo },
    }),
  });

  /** @type {unknown} */
  const payload = await response.json();

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'errors' in payload &&
    Array.isArray(/** @type {{ errors?: unknown }} */ (payload).errors) &&
    /** @type {{ errors?: unknown[] }} */ (payload).errors?.length
  ) {
    console.error(
      'github-extension: GraphQL errors',
      /** @type {{ errors: unknown[] }} */ (payload).errors,
    );
    return { viewerLogin: '', pullRequests: [] };
  }

  if (!response.ok) {
    console.error(
      'github-extension: GraphQL request failed',
      response.status,
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? /** @type {{ message?: string }} */ (payload).message
        : '',
    );
    return { viewerLogin: '', pullRequests: [] };
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload) ||
    /** @type {{ data?: unknown }} */ (payload).data === undefined
  ) {
    console.error('github-extension: unexpected GraphQL response shape');
    return { viewerLogin: '', pullRequests: [] };
  }

  const data = /** @type {{
    data?: {
      viewer?: { login?: string };
      repository?: { pullRequests?: { nodes?: unknown[] } } | null;
    };
  }} */ (payload).data;

  const viewerLogin =
    typeof data?.viewer?.login === 'string' ? data.viewer.login : '';

  const nodes = data?.repository?.pullRequests?.nodes;
  if (!Array.isArray(nodes)) {
    return { viewerLogin, pullRequests: [] };
  }

  const pullRequests = nodes
    .map((n) => {
      if (typeof n !== 'object' || n === null) return null;
      const o = /** @type {Record<string, unknown>} */ (n);
      const number = o.number;
      const headRefName = o.headRefName;
      const baseRefName = o.baseRefName;
      const reviewDecision =
        o.reviewDecision === null || o.reviewDecision === undefined
          ? null
          : String(o.reviewDecision);

      if (
        typeof number !== 'number' ||
        typeof headRefName !== 'string' ||
        typeof baseRefName !== 'string'
      ) {
        return null;
      }

      const lr = o.latestReviews;
      const reviewNodes =
        typeof lr === 'object' &&
        lr !== null &&
        'nodes' in lr &&
        Array.isArray(/** @type {{ nodes?: unknown }} */ (lr).nodes)
          ? /** @type {{ nodes: unknown[] }} */ (lr).nodes
          : [];

      /** @type {PullRequestReview[]} */
      const reviews = [];

      for (const rn of reviewNodes) {
        if (typeof rn !== 'object' || rn === null) continue;
        const r = /** @type {Record<string, unknown>} */ (rn);
        const state = r.state;
        const author = r.author;
        const login =
          typeof author === 'object' &&
          author !== null &&
          'login' in author &&
          typeof /** @type {{ login?: unknown }} */ (author).login === 'string'
            ? /** @type {{ login: string }} */ (author).login
            : '';
        const url =
          typeof author === 'object' &&
          author !== null &&
          'url' in author &&
          typeof /** @type {{ url?: unknown }} */ (author).url === 'string'
            ? /** @type {{ url: string }} */ (author).url
            : '';
        if (typeof state !== 'string' || !login) continue;
        reviews.push({ author: login, state, html_url: url || '#' });
      }

      return /** @type {PullRequestWithReviews} */ ({
        number,
        headRefName,
        baseRefName,
        reviews,
        reviewDecision,
      });
    })
    .filter((x) => x !== null);

  return { viewerLogin, pullRequests };
}
