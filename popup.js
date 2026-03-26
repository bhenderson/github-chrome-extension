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

if (
  !sortCheckbox ||
  !groupByDependencyCheckbox ||
  !filterDraftsOutCheckbox ||
  !filterApprovedByMeCheckbox ||
  !filterNotApprovedByMeCheckbox ||
  !filterOnlyMyPRsCheckbox ||
  !filterNotMyPRsCheckbox ||
  !tokenBtn ||
  !tokenHint
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[StorageAreaKey.SETTINGS]) return;
  loadUi();
});

loadUi();
