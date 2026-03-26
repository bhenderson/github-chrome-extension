# GitHub Extension — architecture & style

## Architecture

- **Manifest V3** extension scoped to **`https://github.com/*`** and **`https://api.github.com/*`** via `host_permissions` (GitHub UI plus GraphQL for PR data). **`storage`** is requested for settings.
- **Popup** (`popup.html` + `popup.css` + `popup.js`) is the UI: toolbar menu reads and writes **global settings** in **`chrome.storage.local`** (see `settings.js`).
- **Content script** runs on GitHub pages (`settings.js` → `github-query-options.js` → `tree.js` → `github-prs.js` → `content.js`, `document_start`). It applies **Sort Oldest** by merging a fixed search **`q`** bundle on **repo pulls list** URLs only (`/owner/repo/pulls`). It listens to **`chrome.storage.onChanged`** so URL updates track popup toggles without a manual refresh.
- **Group by dependency** (`settings.groupByDependency`): when enabled together with a **GitHub token**, after the pulls list DOM is ready (`load` and **`turbo:render`** with a short delay), the extension calls the **GraphQL API** for open PRs (`headRefName` / `baseRefName`), builds a **dependency tree** (`tree.js`), assigns sort indices, optionally renders a small depth badge on chained PRs, and **reorders** rows under **`.js-navigation-container`** (`#issue_*`). Up to **100** open PRs are fetched per request (GitHub API limit).
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
| `github-prs.js` | GraphQL fetch of open PRs for dependency ordering |
| `content.js` | Pulls-list URL `q` merge/strip, dependency reorder + storage listener |
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
