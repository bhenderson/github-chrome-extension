/**
 * Content script loads `tree.js` and `github-prs.js` before `content.js`; these globals are not on `__githubExtension`.
 */

declare function buildTree(
  prs: Array<{
    number: number;
    headRefName: string;
    baseRefName: string;
  }>,
): {
  pr?: { number: number; headRefName: string; baseRefName: string };
  children: unknown[];
  byHead?: Record<
    string,
    {
      pr?: { number: number; headRefName: string; baseRefName: string };
      children: unknown[];
    }
  >;
};

declare function getBaseBranchColor(
  byHead: Record<
    string,
    { pr?: { number: number; headRefName: string; baseRefName: string } }
  >,
  pr: { number: number; headRefName: string; baseRefName: string },
): string;

declare function fetchOpenPullRequestsForRepo(
  owner: string,
  repo: string,
  token: string,
): Promise<
  Array<{ number: number; headRefName: string; baseRefName: string }>
>;
