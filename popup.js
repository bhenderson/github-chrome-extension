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
const tokenBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById('set-token')
);
const tokenHint = /** @type {HTMLParagraphElement} */ (
  document.getElementById('token-hint')
);

if (!sortCheckbox || !groupByDependencyCheckbox || !tokenBtn || !tokenHint) {
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
