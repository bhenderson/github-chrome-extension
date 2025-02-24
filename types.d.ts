interface GlobalOptions {
  token: string;
}

interface PrListPage {
  owner: string;
  repo: string;
}

interface PullRequest {
  number: number;
  title: string;
  url: string;
  baseRefName: string;
  headRefName: string;
  author: string;
  reviews: Review[];
  reviewDecision: PullRequestReviewDecision;
}

interface Review {
  author: string;
  state: PullRequestReviewState;
  html_url: string;
}

type PullRequestReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
type PullRequestReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

type PRHeads = Record<string, TreeNode>;

interface TreeNode {
  pr?: PullRequest;
  children: TreeNode[];
  byHead?: PRHeads;
}

interface GraphQLResponse {
  data: {
    viewer: {
      login: string;
    };
    repository: {
      pullRequests: {
        nodes: Array<{
          number: number;
          title: string;
          url: string;
          author: {
            login: string;
          };
          baseRefName: string;
          headRefName: string;
          latestReviews: {
            nodes: Array<{
              author: {
                login: string;
                url: string;
              };
              state: PullRequestReviewState;
            }>;
          };
          reviewDecision: PullRequestReviewDecision | null;
        }>;
      };
    };
  };
}

type Options =
  | 'groupByDependency'
  | 'filterApprovedByMe'
  | 'filterNotApprovedByMe'
  | 'githubToken'
  | 'persistentSearch';

type Callback = (value: boolean | string) => unknown;

interface QueryTerm {
  key: string;
  value: string;
  token: string // The raw string value
  negative?: boolean; // Optionally set to true to negate the term
}

interface QueryHandlerOptions {
}