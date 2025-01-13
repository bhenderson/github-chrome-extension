// @ts-check

function extendSortFilters() {
    const sortMenu = /** @type {HTMLDetailsElement} */ (document.querySelector('details-menu.SelectMenu'));
    const divider = /** @type {HTMLDivElement} */ (document.querySelector('div.SelectMenu-divider'));
    if (!sortMenu || !divider) return;

    const button = document.createElement('button');
    button.classList.add('SelectMenu-item');
    const check = document.createElement('span');
    check.classList.add('SelectMenu-icon');
    const span = document.createElement('span');
    span.textContent = 'Dependency Tree';
    button.append(check, span);

    button.onclick = () => {
        globalThis.queryHandler.set([
            { key: 'dependency', value: 'tree' },
            { key: 'sort', value: 'asc' },
        ]);
    }

    // Insert button before the divider (as a sibling)
    divider.parentNode?.insertBefore(button, divider);
}

function extendFilters() {
    extendSortFilters();
}

Object.assign(globalThis, {
    extendFilters,
}); 