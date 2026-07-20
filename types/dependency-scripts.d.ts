/**
 * Content script loads `tree.js` and `github-prs.js` before `content.js`; these globals are not on `__githubExtension`.
 */

declare function buildTree(
  prs: Array<{
    number: number;
    headRefName: string;
    baseRefName: string;
  }>,
  ignoreBases?: string | string[],
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
  ignoreBases?: string | string[],
): string;

declare function fetchOpenPullRequestsForRepo(
  owner: string,
  repo: string,
  token: string,
): Promise<{
  viewerLogin: string;
  pullRequests: Array<{
    number: number;
    headRefName: string;
    baseRefName: string;
    reviews: Array<{ author: string; state: string; html_url: string }>;
    reviewDecision: string | null;
  }>;
}>;
