/**
 * @fileoverview Extension popup: menu for global settings stored in chrome.storage.local.
 */

/// <reference path="./settings.js" />

const sortCheckbox = /** @type {HTMLInputElement} */ (
  document.getElementById('sort-oldest')
);
const groupByDependencyCheckbox = /** @type {HTMLInputElement} */ (
  document.getElementById('group-by-dependency')
);
const filterDraftsOutCheckbox = /** @type {HTMLInputElement} */ (
  document.getElementById('filter-drafts-out')
);
const filterApprovedByMeCheckbox = /** @type {HTMLInputElement} */ (
  document.getElementById('filter-approved-by-me')
);
const filterNotApprovedByMeCheckbox = /** @type {HTMLInputElement} */ (
  document.getElementById('filter-not-approved-by-me')
);
const filterOnlyMyPRsCheckbox = /** @type {HTMLInputElement} */ (
  document.getElementById('filter-only-my-prs')
);
const filterNotMyPRsCheckbox = /** @type {HTMLInputElement} */ (
  document.getElementById('filter-not-my-prs')
);
const tokenBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById('set-token')
);
const tokenHint = /** @type {HTMLParagraphElement} */ (
  document.getElementById('token-hint')
);
const jiraBaseUrlInput = /** @type {HTMLInputElement} */ (
  document.getElementById('jira-base-url')
);
const jiraEmailInput = /** @type {HTMLInputElement} */ (
  document.getElementById('jira-email')
);
const jiraApiTokenInput = /** @type {HTMLInputElement} */ (
  document.getElementById('jira-api-token')
);
const jiraTicketPatternInput = /** @type {HTMLInputElement} */ (
  document.getElementById('jira-ticket-pattern')
);
const saveJiraBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById('save-jira')
);
const jiraHint = /** @type {HTMLParagraphElement} */ (
  document.getElementById('jira-hint')
);

if (
  !sortCheckbox ||
  !groupByDependencyCheckbox ||
  !filterDraftsOutCheckbox ||
  !filterApprovedByMeCheckbox ||
  !filterNotApprovedByMeCheckbox ||
  !filterOnlyMyPRsCheckbox ||
  !filterNotMyPRsCheckbox ||
  !tokenBtn ||
  !tokenHint ||
  !jiraBaseUrlInput ||
  !jiraEmailInput ||
  !jiraApiTokenInput ||
  !jiraTicketPatternInput ||
  !saveJiraBtn ||
  !jiraHint
) {
  throw new Error('popup DOM missing required elements');
}

/**
 * @param {ExtensionSettings} settings
 */
function refreshTokenHint(settings) {
  const t = settings.token ?? '';
  if (!t) {
    tokenHint.textContent = 'No token set.';
    return;
  }
  const tail = t.length <= 4 ? '••••' : `••••${t.slice(-4)}`;
  tokenHint.textContent = `Token: ${tail}`;
}

/**
 * @param {ExtensionSettings} settings
 */
function refreshJiraHint(settings) {
  const t = settings.jiraApiToken ?? '';
  const base = settings.jiraBaseUrl ?? '';
  if (!base && !t) {
    jiraHint.textContent = 'Jira not configured.';
    return;
  }
  if (!base) {
    jiraHint.textContent = 'Missing Jira base URL.';
    return;
  }
  if (!t) {
    jiraHint.textContent = 'Missing Jira API token.';
    return;
  }
  const tail = t.length <= 4 ? '••••' : `••••${t.slice(-4)}`;
  jiraHint.textContent = `Jira token: ${tail}`;
}

function loadUi() {
  void loadSettings().then((s) => {
    sortCheckbox.checked = s.sortOldest;
    groupByDependencyCheckbox.checked = s.groupByDependency;
    filterDraftsOutCheckbox.checked = s.filterDraftsOut;
    filterApprovedByMeCheckbox.checked = s.filterApprovedByMe;
    filterNotApprovedByMeCheckbox.checked = s.filterNotApprovedByMe;
    filterOnlyMyPRsCheckbox.checked = s.filterOnlyMyPRs;
    filterNotMyPRsCheckbox.checked = s.filterNotMyPRs;
    refreshTokenHint(s);
    jiraBaseUrlInput.value = s.jiraBaseUrl ?? '';
    jiraEmailInput.value = s.jiraEmail ?? '';
    jiraApiTokenInput.value = s.jiraApiToken ?? '';
    jiraTicketPatternInput.value = s.jiraTicketPattern ?? '([A-Z][A-Z0-9]+-\\d+)';
    refreshJiraHint(s);
  });
}

sortCheckbox.addEventListener('change', () => {
  void saveSettingsPatch({ sortOldest: sortCheckbox.checked });
});

groupByDependencyCheckbox.addEventListener('change', () => {
  void saveSettingsPatch({
    groupByDependency: groupByDependencyCheckbox.checked,
  });
});

filterDraftsOutCheckbox.addEventListener('change', () => {
  void saveSettingsPatch({ filterDraftsOut: filterDraftsOutCheckbox.checked });
});

filterApprovedByMeCheckbox.addEventListener('change', () => {
  void saveSettingsPatch({
    filterApprovedByMe: filterApprovedByMeCheckbox.checked,
  });
});

filterNotApprovedByMeCheckbox.addEventListener('change', () => {
  void saveSettingsPatch({
    filterNotApprovedByMe: filterNotApprovedByMeCheckbox.checked,
  });
});

filterOnlyMyPRsCheckbox.addEventListener('change', () => {
  void saveSettingsPatch({
    filterOnlyMyPRs: filterOnlyMyPRsCheckbox.checked,
  });
});

filterNotMyPRsCheckbox.addEventListener('change', () => {
  void saveSettingsPatch({ filterNotMyPRs: filterNotMyPRsCheckbox.checked });
});

tokenBtn.addEventListener('click', () => {
  void loadSettings().then((s) => {
    const entered = prompt(
      'GitHub token (stored locally in this browser only):',
      s.token ?? '',
    );
    if (entered === null) return;
    void saveSettingsPatch({ token: entered }).then(loadUi);
  });
});

saveJiraBtn.addEventListener('click', () => {
  const baseUrl = jiraBaseUrlInput.value.trim().replace(/\/+$/, '');
  const email = jiraEmailInput.value.trim();
  const apiToken = jiraApiTokenInput.value;
  const pattern = jiraTicketPatternInput.value.trim();

  if (baseUrl && !email) {
    jiraHint.textContent = 'Email is required for Jira Cloud auth.';
    return;
  }
  if (baseUrl && !apiToken) {
    jiraHint.textContent = 'API token is required for Jira Cloud auth.';
    return;
  }

  /** @type {() => void} */
  const save = () => {
    void saveSettingsPatch({
      jiraBaseUrl: baseUrl,
      jiraEmail: email,
      jiraApiToken: apiToken,
      jiraTicketPattern: pattern || '([A-Z][A-Z0-9]+-\\d+)',
    }).then(loadUi);
  };

  if (!baseUrl) {
    save();
    return;
  }

  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    jiraHint.textContent = 'Invalid Jira URL.';
    return;
  }

  chrome.permissions.request({ origins: [`${origin}/*`] }, (granted) => {
    if (granted) {
      save();
    } else {
      jiraHint.textContent = 'Host permission denied — cannot reach Jira.';
    }
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[StorageAreaKey.SETTINGS]) return;
  loadUi();
});

loadUi();
