# GitHub Extension

A Manifest V3 Chrome extension for [github.com](https://github.com): tools for the repo **pull request list** (`/owner/repo/pulls`), including sort, optional dependency grouping, and optional filters. Settings live in the toolbar **popup** and **`chrome.storage.local`**.

## Features

- **Sort oldest** — Merges a fixed `q` bundle (`is:pr is:open sort:created-asc`) so the list loads oldest-first.
- **Group by dependency** — With a **GitHub token**, uses GraphQL to reorder rows by PR chain and show depth badges and reviewer lines.
- **Filter drafts out** — Adds `draft:false` to `q`.
- **Only my PRs / Not my PRs** — Adds `author:<you>` or `-author:<you>` using the logged-in user from the page (`meta[name="user-login"]`).
- **Filter approved by me / Filter not approved by me** — With a **token**, hides rows based on whether your latest review state is approved (uses the same GraphQL PR data as dependency mode).

Mutually exclusive pairs (approved / not approved; only mine / not mine) are enforced when saving settings.

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/bhenderson/github-chrome-extension.git
   ```

2. Open Chrome and go to `chrome://extensions/`.

3. Turn on **Developer mode** (top right).

4. Click **Load unpacked** and choose the cloned project folder.

## Setup (GitHub token)

GraphQL features (group by dependency, approval filters) need a **Personal Access Token** stored only in this browser via the popup **Set Token**.

1. **Generate a token** — In the extension popup, use **Generate token**, or open [GitHub: new classic token with `repo` scope](https://github.com/settings/tokens/new?scopes=repo) in a browser tab.

2. On GitHub, pick a name (e.g. “GitHub Extension”), confirm **`repo`** is selected, set an expiration, then create the token and copy it once (GitHub will not show it again).

3. In the popup, click **Set Token** and paste the value. The UI shows a masked hint (last four characters only).

## How it works

1. **Content script** — Injected at **`document_start`** on `https://github.com/*`. It does not intercept HTTP traffic; it runs in an isolated world alongside the page.

2. **URL `q` sync** — On pulls-list URLs, the content script aligns `q` with popup toggles (sort, drafts, author) and uses **`location.replace`** when the URL must change. Turning options off via the popup can strip extension-managed tokens.

3. **DOM + Turbo** — List work runs after **`load`** and on **`turbo:render`** (short delay) so it survives GitHub’s client-side navigation.

4. **Popup** — Reads and writes **`chrome.storage.local`**. The content script listens to **`chrome.storage.onChanged`** so changes apply without a full manual refresh when possible.

For file layout, query model, and API limits, see [`doc.md`](doc.md).

## Development

Use a current Chrome or Chromium build. After you change code:

1. Open `chrome://extensions/`.
2. Find **GitHub Extension**.
3. Click **Reload** (circular arrow) on the extension card.

## License

This project is released under the MIT License; see the `LICENSE` file at the repository root when published there.
