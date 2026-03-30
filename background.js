/**
 * @fileoverview Service worker: proxies Jira Cloud REST API requests for content scripts
 * (content scripts cannot make cross-origin fetches to arbitrary hosts in MV3).
 */

/// <reference path="./types/chrome.d.ts" />

/**
 * @typedef {Object} JiraFetchRequest
 * @property {'JIRA_FETCH_ISSUES'} type
 * @property {string} jiraBaseUrl
 * @property {string} jiraEmail
 * @property {string} jiraApiToken
 * @property {string[]} issueKeys
 */

/**
 * @typedef {Object} JiraIssueStatus
 * @property {string} statusName
 * @property {string} statusCategoryKey
 * @property {string} issueUrl
 */

const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/**
 * @param {string} jiraBaseUrl
 * @param {string} jiraEmail
 * @param {string} jiraApiToken
 * @param {string[]} issueKeys
 * @returns {Promise<Record<string, JiraIssueStatus>>}
 */
async function fetchJiraIssues(jiraBaseUrl, jiraEmail, jiraApiToken, issueKeys) {
  const safeKeys = issueKeys.filter((k) => JIRA_KEY_RE.test(k));
  if (!safeKeys.length) return {};

  const base = jiraBaseUrl.replace(/\/+$/, '');
  const jql = `key in (${safeKeys.join(',')})`;
  const url = `${base}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=status`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`${jiraEmail}:${jiraApiToken}`)}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('github-extension: Jira API request failed', response.status);
    return {};
  }

  /** @type {unknown} */
  const payload = await response.json();
  if (typeof payload !== 'object' || payload === null || !('issues' in payload)) {
    console.error('github-extension: unexpected Jira response shape');
    return {};
  }

  const issues = /** @type {{ issues?: unknown[] }} */ (payload).issues;
  if (!Array.isArray(issues)) return {};

  /** @type {Record<string, JiraIssueStatus>} */
  const result = {};

  for (const issue of issues) {
    if (typeof issue !== 'object' || issue === null) continue;
    const o = /** @type {Record<string, unknown>} */ (issue);
    const key = typeof o.key === 'string' ? o.key : '';
    if (!key) continue;

    const fields = typeof o.fields === 'object' && o.fields !== null
      ? /** @type {Record<string, unknown>} */ (o.fields)
      : {};
    const status = typeof fields.status === 'object' && fields.status !== null
      ? /** @type {Record<string, unknown>} */ (fields.status)
      : {};
    const statusName = typeof status.name === 'string' ? status.name : '';
    const statusCategory = typeof status.statusCategory === 'object' && status.statusCategory !== null
      ? /** @type {Record<string, unknown>} */ (status.statusCategory)
      : {};
    const statusCategoryKey = typeof statusCategory.key === 'string' ? statusCategory.key : 'indeterminate';

    result[key] = {
      statusName,
      statusCategoryKey,
      issueUrl: `${base}/browse/${key}`,
    };
  }

  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null || message.type !== 'JIRA_FETCH_ISSUES') {
    return false;
  }

  const req = /** @type {JiraFetchRequest} */ (message);
  fetchJiraIssues(req.jiraBaseUrl, req.jiraEmail, req.jiraApiToken, req.issueKeys)
    .then((data) => sendResponse({ success: true, data }))
    .catch((err) => {
      console.error('github-extension: Jira fetch error', err);
      sendResponse({ success: false, data: {} });
    });

  return true;
});
