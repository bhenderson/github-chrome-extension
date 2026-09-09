/**
 * Content script loads these scripts before `content.js`; globals are not on `__githubExtension`.
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

interface GraphContext {
  stackTotal: number;
  stackPosition: number;
  rootPrNumber: number;
  branchSubtreeSize: number;
  branchIndex: number | null;
  branchTotal: number | null;
  isBranchStart: boolean;
}

interface GraphMeta {
  depth: number;
  branchCol: number;
  ancestorContinues: boolean[];
  isLastChild: boolean;
  hasChildren: boolean;
  color: string;
  stackTotal: number;
  stackPosition: number;
  rootPrNumber: number;
  branchSubtreeSize: number;
  childCount: number;
  branchIndex: number | null;
  branchTotal: number | null;
  isBranchStart: boolean;
}

declare function countSubtree(node: {
  pr?: { number: number; headRefName: string; baseRefName: string };
  children: unknown[];
}): number;

declare function buildGraphHoverLabel(meta: GraphMeta): string;

declare function getBaseBranch(
  byHead: Record<
    string,
    { pr?: { number: number; headRefName: string; baseRefName: string } }
  >,
  pr: { number: number; headRefName: string; baseRefName: string },
  ignoreBases?: string | string[],
): { number: number; headRefName: string; baseRefName: string };

declare function getBaseBranchLineColor(
  byHead: Record<
    string,
    { pr?: { number: number; headRefName: string; baseRefName: string } }
  >,
  pr: { number: number; headRefName: string; baseRefName: string },
  ignoreBases?: string | string[],
): string;

declare function computeGraphMeta(
  node: {
    pr?: { number: number; headRefName: string; baseRefName: string };
    children: unknown[];
  },
  depth: number,
  ancestorContinues: boolean[],
  isLastChild: boolean,
  branchCol: number,
  byHead: Record<
    string,
    { pr?: { number: number; headRefName: string; baseRefName: string } }
  >,
  ignoreBases?: string | string[],
  graphContext?: GraphContext,
): GraphMeta | null;

declare function detectPullsListLayout(): 'legacy' | 'listview' | null;

declare function getPullsListContainer(): HTMLElement | null;

declare function getPullsListRows(): HTMLElement[];

declare function getPrNumberFromRow(el: HTMLElement): string | null;

declare function getStatusContainer(el: HTMLElement): HTMLElement | null;

declare function getReviewerContainer(el: HTMLElement): HTMLElement | null;

declare function getJiraBadgeContainer(el: HTMLElement): HTMLElement | null;

declare function computeGutterWidth(): number;

declare function buildRowGraphSvg(meta: GraphMeta, gutterWidthPx: number): string;

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
