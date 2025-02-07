// @ts-check

function createLink(text, href) {
    const link = document.createElement('a');
    link.classList.add('SelectMenu-item');
    const check = document.createElement('span');
    check.classList.add('SelectMenu-icon');
    const span = document.createElement('span');
    span.textContent = text;
    link.append(check, span);

    link.href = href;

    return link;
}

function extendSortFilters() {
    const sortMenu = /** @type {HTMLDetailsElement} */ (document.getElementById('sort-select-menu'));
    const divider = /** @type {HTMLDivElement} */ (sortMenu?.querySelector('div.SelectMenu-divider'));
    if (!sortMenu || !divider) return;

    const link = createLink('Dependency Tree', globalThis.queryHandler.url([
        { key: 'dependency', value: 'tree', negative: false },
        { key: 'sort', value: 'created-asc', negative: false },
    ]));

    // Insert button before the divider (as a sibling)
    divider.parentNode?.insertBefore(link, divider);
}

function extendReviewersFilters() {
    const reviewersMenu = /** @type {HTMLDetailsElement} */ (document.getElementById('reviews-select-menu'));
    const list = /** @type {HTMLUListElement} */ (reviewersMenu?.querySelector('.SelectMenu-list'));
    if (!reviewersMenu || !list) return;

    const approvedByMeLink = createLink('Approved by me', globalThis.queryHandler.url([
        { key: 'approved-by', value: '@me', negative: false },
    ]));

    const notApprovedByMeLink = createLink('Not approved by me', globalThis.queryHandler.url([
        { key: 'approved-by', value: '@me', negative: true },
    ]));

    list.append(approvedByMeLink, notApprovedByMeLink);
}

function extendFilters() {
    extendSortFilters();
    extendReviewersFilters();
}

Object.assign(globalThis, {
    extendFilters,
}); 