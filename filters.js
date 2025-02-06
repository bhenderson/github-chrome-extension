// @ts-check

function extendSortFilters() {
    const sortMenu = /** @type {HTMLDetailsElement} */ (document.querySelector('details-menu.SelectMenu'));
    const divider = /** @type {HTMLDivElement} */ (document.querySelector('div.SelectMenu-divider'));
    if (!sortMenu || !divider) return;

    const link = document.createElement('a');
    link.classList.add('SelectMenu-item');
    const check = document.createElement('span');
    check.classList.add('SelectMenu-icon');
    const span = document.createElement('span');
    span.textContent = 'Dependency Tree';
    link.append(check, span);

    link.href = globalThis.queryHandler.url([
        { key: 'dependency', value: 'tree', negative: false },
        { key: 'sort', value: 'created-asc', negative: false },
    ]);

    // Insert button before the divider (as a sibling)
    divider.parentNode?.insertBefore(link, divider);
}

function extendFilters() {
    extendSortFilters();
}

Object.assign(globalThis, {
    extendFilters,
}); 