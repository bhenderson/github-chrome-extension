/**
 * @fileoverview GraphQL fetch of open pull requests for dependency ordering (base/head refs).
 */

/// <reference path="./types/github-extension-global.d.ts" />
/// <reference path="./tree.js" />

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<import('./tree.js').PullRequestNode[]>}
 */
async function fetchOpenPullRequestsForRepo(owner, repo, token) {
  if (!token) {
    return [];
  }

  const query = `query OpenPullRequests($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 100, states: [OPEN]) {
        nodes {
          number
          headRefName
          baseRefName
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
    return [];
  }

  if (!response.ok) {
    console.error(
      'github-extension: GraphQL request failed',
      response.status,
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? /** @type {{ message?: string }} */ (payload).message
        : '',
    );
    return [];
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload) ||
    /** @type {{ data?: unknown }} */ (payload).data === undefined
  ) {
    console.error('github-extension: unexpected GraphQL response shape');
    return [];
  }

  const data = /** @type {{ data?: { repository?: { pullRequests?: { nodes?: unknown[] } } } } } */ (
    payload
  ).data;

  const nodes = data?.repository?.pullRequests?.nodes;
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes
    .map((n) => {
      if (typeof n !== 'object' || n === null) return null;
      const o = /** @type {Record<string, unknown>} */ (n);
      const number = o.number;
      const headRefName = o.headRefName;
      const baseRefName = o.baseRefName;
      if (
        typeof number !== 'number' ||
        typeof headRefName !== 'string' ||
        typeof baseRefName !== 'string'
      ) {
        return null;
      }
      return /** @type {import('./tree.js').PullRequestNode} */ ({
        number,
        headRefName,
        baseRefName,
      });
    })
    .filter((x) => x !== null);
}
