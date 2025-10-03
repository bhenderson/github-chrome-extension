// @ts-check

function addCloseMenuIcon(parentElement) {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("version", "1.1");
  svg.setAttribute("width", "16");
  svg.setAttribute("data-view-component", "true");
  svg.setAttribute("class", "octicon octicon-check SelectMenu-icon SelectMenu-icon--check");

  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z");

  svg.appendChild(path);
  parentElement.appendChild(svg);
}

/**
 * 
 * @param {string} text 
 * @param {Options} option 
 * @returns 
 */
function createMenuButton(text, option) {
  const button = document.createElement('button');
  button.classList.add('SelectMenu-item');
  const check = document.createElement('span');
  check.classList.add('SelectMenu-icon');

  addCloseMenuIcon(button);

  const span = document.createElement('span');
  span.textContent = text;
  button.append(check, span);

  globalOptions.watch(option, (value) => {
    button.setAttribute('aria-checked', String(value));
  }, true)

  button.onclick = () => {
    globalOptions.set(option, !globalOptions.get(option));
  }

  return button;
}

function createSearchInput(placeholder) {
  const div = document.createElement('div');
  div.className = 'SelectMenu-filter';

  const inputField = document.createElement('input');
  inputField.type = 'text';
  inputField.className = 'SelectMenu-input form-control';
  inputField.placeholder = placeholder;
  inputField.value = globalOptions.get('persistentSearch') || '';

  inputField.onblur = () => {
    globalOptions.set('persistentSearch', inputField.value);
  }

  inputField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      inputField.blur();
    }
  });

  div.appendChild(inputField);

  return div;
}

function addControlMenu() {
  const container = /** @type {HTMLDetailsElement} */ (document.getElementById('repo-content-pjax-container') || document.getElementById('repo-content-turbo-frame'));
  if (!container) return;

  const menu = document.createElement('details-menu');
  menu.classList.add();

  const header = document.createElement('header');
  header.classList.add('SelectMenu-header');

  const headerTitle = document.createElement('span');
  headerTitle.classList.add('SelectMenu-title');
  headerTitle.innerText = 'Custom Extension Options';
  header.append(headerTitle);

  menu.append(header);

  const list = document.createElement('div');
  list.classList.add('SelectMenu-list');

  list.append(
    createMenuButton('Group By Dependency', 'groupByDependency'),
    createMenuButton('Filter Drafts Out', 'filterDraftsOut'),
    createMenuButton('Automatic Sort', 'automaticSort'),
    createMenuButton('Filter Approved By Me', 'filterApprovedByMe'),
    createMenuButton('Filter Not Approved By Me', 'filterNotApprovedByMe'),
    createMenuButton('Only My PRs', 'filterOnlyMyPRs'),
    createMenuButton('Not My PRs', 'filterNotMyPRs'),
    createMenuButton('Reset Github Token', 'githubToken'),
    createSearchInput('Persistent search field'),
  );

  menu.append(list);

  container.append(menu);

  container.classList.add('gce-container');
  menu.classList.add('gce-menu');
}