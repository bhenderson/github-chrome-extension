# GitHub Extension — architecture & style

## Architecture

- **Manifest V3** extension scoped to **`https://github.com/*`** and **`https://api.github.com/*`** via `host_permissions` (GitHub UI plus GraphQL for PR data). **`storage`** is requested for settings.
- **Popup** (`popup.html` + `popup.css` + `popup.js`) is the UI: toolbar menu reads and writes **global settings** in **`chrome.storage.local`** (see `settings.js`). Options include **Sort oldest**, **Group by dependency**, **Filter drafts out**, **Only my PRs** / **Not my PRs**, and **Filter approved by me** / **Filter not approved by me** (the last two pairs are mutually exclusive in `saveSettingsPatch`). **Set Token** stores the PAT; **Generate token** opens GitHub’s [new classic token page](https://github.com/settings/tokens/new?scopes=repo) with the **`repo`** scope selected.
- **Content script** runs on GitHub pages (`settings.js` → `github-query-options.js` → `tree.js` → `github-prs.js` → `content.js`, `document_start`). On **repo pulls list** URLs only (`/owner/repo/pulls`), it keeps **`q`** aligned with settings: **Sort oldest** merges the default bundle (`is:pr is:open sort:created-asc`); **Filter drafts out** adds **`draft:false`**; **Only my PRs / Not my PRs** add **`author:<login>`** or **`-author:<login>`** using **`meta[name="user-login"]`**. It listens to **`chrome.storage.onChanged`** so URL updates track popup toggles; when a toggle is turned off, extension-managed **`draft`** / **`author`** tokens may be stripped (`fromStorageEvent`). It does not strip user-authored `q` tokens on first load when those options are off.
- **Group by dependency** (`settings.groupByDependency`): when enabled together with a **GitHub token**, after the pulls list DOM is ready (`load` and **`turbo:render`** with a short delay), the extension calls the **GraphQL API** for open PRs: **`viewer.login`**, **refs** (`headRefName` / `baseRefName`), **`reviewDecision`**, and **`latestReviews`** (author `login`/`url`, `state`). It builds a **dependency tree** (`tree.js`), assigns sort indices, optionally renders a small depth badge on chained PRs, **appends reviewer lines** (approved / changes requested — same pattern as the main worktree) and **reorders** rows under **`.js-navigation-container`** (`#issue_*`). Injected review markup is tagged with **`data-gce-review`** so it can be cleared before re-render. Up to **100** open PRs and **100** latest reviews per PR are fetched per request (GitHub API limits).
- **Approval row filters** (`settings.filterApprovedByMe` / `settings.filterNotApprovedByMe`): require a **token**. The same GraphQL fetch used for dependency mode (or fetch-only when only approval filters are on) sets a per-row **`dataset.__gce_approvedByYou`** flag from **`latestReviews`** (whether the viewer has an approved review). **`sortByKey`** then sets **`hidden`** on rows that do not match the active filter. Without a token, these filters do not hide rows.
- **Shared settings** (`settings.js`) define the storage key, defaults, `loadSettings` / `saveSettingsPatch`, and expose APIs for both popup and content.
- **Query model** (`github-query-options.js`) implements GitHub-style **`q`** tokens as structured options (`negate`, `key`, optional `value`) with serialize/deserialize helpers and the pulls default bundle (`is:pr is:open sort:created-asc`).

Content scripts do not share a normal multi-file global scope reliably, so **`globalThis.__githubExtension`** is built in two steps (settings, then query helpers) and **`content.js`** reads everything from that object. **`tree.js`** and **`github-prs.js`** expose plain top-level functions used by **`content.js`** (see `types/dependency-scripts.d.ts` for editor typing). The popup loads `settings.js` in a normal extension page context and uses top-level functions/constants directly.

## Project structure

| Path | Role |
|------|------|
| `manifest.json` | MV3 entry: action popup, icons, content_scripts, host permissions |
| `settings.js` | Storage keys, `ExtensionSettings`, load/save |
| `github-query-options.js` | `GitHubQueryOption` helpers + pulls defaults |
| `tree.js` | PR dependency tree from base/head refs (`buildTree`, `getBaseBranchColor`) |
| `github-prs.js` | GraphQL: `viewer` + open PRs with refs, reviews, `reviewDecision` |
| `content.js` | Pulls-list URL `q` merge/strip (sort, draft, author), dependency reorder, approval row visibility, reviewer UI, storage listener |
| `popup.html` / `popup.css` / `popup.js` | Extension action menu |
| `icons/` | Toolbar icons (PNG) |
| `types/chrome.d.ts` | Minimal `chrome.*` typings (no npm `@types/chrome`) |
| `types/github-extension-global.d.ts` | Shape of `globalThis.__githubExtension` |
| `types/dependency-scripts.d.ts` | Ambient typings for `tree.js` / `github-prs.js` globals |
| `jsconfig.json` | `checkJs` + lib for editor/CI hints |

No bundler, no runtime npm dependencies.

## Code style

- **Plain JavaScript** with **`/// <reference`** and **JSDoc** (`@fileoverview`, `@typedef`, `@param`, `@returns`, `@type`) so the codebase stays **typed in the editor** without compiling to TypeScript.
- Prefer **frozen enum-like objects** (e.g. `StorageAreaKey`, `GitHubListPathKind`) and **typedefs** for settings and query options.
- **Small, named functions**; avoid logging secrets (token is stored only; UI shows a masked hint).
- **`types/*.d.ts`** only declares ambient/chrome/global shapes; implementation stays in `.js`.

When extending the extension, keep new host behavior behind **`manifest.json` matches/permissions**, reuse **`settings.js`** for persisted state, and extend **`github-query-options.js`** if **`q`** token rules change.
