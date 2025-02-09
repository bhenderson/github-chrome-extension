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

function addControlMenu() {
    const container = /** @type {HTMLDetailsElement} */ (document.getElementById('repo-content-pjax-container') || document.getElementById('repo-content-turbo-frame'));
    if (!container) return;

    const menu = document.createElement('details-menu');
    menu.classList.add();

    const header = document.createElement('header');
    header.classList.add('SelectMenu-header');

    const headerTitle = document.createElement('span')
    headerTitle.classList.add('SelectMenu-title')
    headerTitle.innerText = 'Custom Extension Options'
    header.append(headerTitle);

    menu.append(header);

    const list = document.createElement('div')
    list.classList.add('SelectMenu-list')

    list.append(
        createMenuButton('Group By Dependency', 'groupByDependency'),
        createMenuButton('Persist Sort Asc', 'persistSortAsc'),
        createMenuButton('Filter Approved By Me', 'filterApprovedByMe'),
        createMenuButton('Filter Not Approved By Me', 'filterNotApprovedByMe'),
    )

    menu.append(list);
    container.append(menu);

    container.style.position = 'relative';
    menu.style.position = 'absolute';
    menu.style.top = '0';
    menu.style.left = '0';
    menu.style['margin-left'] = '2rem';
}
/*
<details-menu class="SelectMenu SelectMenu--hasFilter right-0" role="menu" aria-label="Sort by">
    <div class="SelectMenu-modal">
      <header class="SelectMenu-header">
        <span class="SelectMenu-title">Sort by</span>
        <button class="SelectMenu-closeButton" type="button" data-toggle-for="sort-select-menu">
          <svg aria-label="Close menu" role="img" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
        </button>
      </header>

      <div class="SelectMenu-list">
          <a class="SelectMenu-item" aria-checked="true" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Aopen+is%3Apr" data-turbo-frame="repo-content-turbo-frame">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
            <span>Newest</span>
          </a>
          <a class="SelectMenu-item" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Acreated-asc" data-turbo-frame="repo-content-turbo-frame">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
            <span>Oldest</span>
          </a>
          <a class="SelectMenu-item" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Acomments-desc" data-turbo-frame="repo-content-turbo-frame">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
            <span>Most commented</span>
          </a>
          <a class="SelectMenu-item" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Acomments-asc" data-turbo-frame="repo-content-turbo-frame">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
            <span>Least commented</span>
          </a>
          <a class="SelectMenu-item" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Aupdated-desc" data-turbo-frame="repo-content-turbo-frame">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
            <span>Recently updated</span>
          </a>
          <a class="SelectMenu-item" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Aupdated-asc" data-turbo-frame="repo-content-turbo-frame">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
            <span>Least recently updated</span>
          </a>
          <a class="SelectMenu-item" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Arelevance-desc" data-turbo-frame="repo-content-turbo-frame">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
            <span>Best match</span>
          </a>

        <a class="SelectMenu-item" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Acreated-asc#-approved-by:@me dependency:tree"><span class="SelectMenu-icon"></span><span>Dependency Tree</span></a><div class="SelectMenu-divider">Most reactions</div>
        <div class="clearfix ws-normal p-3 p-sm-2">
            <a class="reaction-sort-item width-auto m-0 px-3 py-2" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Areactions-%2B1-desc" data-turbo-frame="repo-content-turbo-frame">
              <g-emoji alias="+1" fallback-src="https://github.githubassets.com/assets/1f44d-41cb66fe1e22.png" class="emoji m-0 v-align-baseline">👍</g-emoji>
            </a>
            <a class="reaction-sort-item width-auto m-0 px-3 py-2" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Areactions--1-desc" data-turbo-frame="repo-content-turbo-frame">
              <g-emoji alias="-1" fallback-src="https://github.githubassets.com/assets/1f44e-ce91733aae25.png" class="emoji m-0 v-align-baseline">👎</g-emoji>
            </a>
            <a class="reaction-sort-item width-auto m-0 px-3 py-2" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Areactions-smile-desc" data-turbo-frame="repo-content-turbo-frame">
              <g-emoji alias="smile" fallback-src="https://github.githubassets.com/assets/1f604-7528822fb4c5.png" class="emoji m-0 v-align-baseline">😄</g-emoji>
            </a>
            <a class="reaction-sort-item width-auto m-0 px-3 py-2" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Areactions-tada-desc" data-turbo-frame="repo-content-turbo-frame">
              <g-emoji alias="tada" fallback-src="https://github.githubassets.com/assets/1f389-36899a2cb781.png" class="emoji m-0 v-align-baseline">🎉</g-emoji>
            </a>
            <a class="reaction-sort-item width-auto m-0 px-3 py-2" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Areactions-thinking_face-desc" data-turbo-frame="repo-content-turbo-frame">
              <g-emoji alias="thinking_face" fallback-src="https://github.githubassets.com/assets/1f615-4bb1369c4251.png" class="emoji m-0 v-align-baseline">😕</g-emoji>
            </a>
            <a class="reaction-sort-item width-auto m-0 px-3 py-2" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Areactions-heart-desc" data-turbo-frame="repo-content-turbo-frame">
              <g-emoji alias="heart" fallback-src="https://github.githubassets.com/assets/2764-982dc91ea48a.png" class="emoji m-0 v-align-baseline">❤️</g-emoji>
            </a>
            <a class="reaction-sort-item width-auto m-0 px-3 py-2" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Areactions-rocket-desc" data-turbo-frame="repo-content-turbo-frame">
              <g-emoji alias="rocket" fallback-src="https://github.githubassets.com/assets/1f680-d0ef47fdb515.png" class="emoji m-0 v-align-baseline">🚀</g-emoji>
            </a>
            <a class="reaction-sort-item width-auto m-0 px-3 py-2" aria-checked="false" role="menuitemradio" href="/RiparianLLC/ion/pulls?q=is%3Apr+is%3Aopen+sort%3Areactions-eyes-desc" data-turbo-frame="repo-content-turbo-frame">
              <g-emoji alias="eyes" fallback-src="https://github.githubassets.com/assets/1f440-ee44e91e92a7.png" class="emoji m-0 v-align-baseline">👀</g-emoji>
            </a>
        </div>
      </div>
    </div>
  </details-menu>
  */