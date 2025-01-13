/** @ts-check */

const customCommands = /** @type {const} */ ([
    'approved-by',
    'changes-requested',
    'dependency', // dependency:tree
])

/** @typedef { keyof typeof customCommands } CustomCommand */

/**
 * @typedef {Object} QueryTerm
 * @property {string} key
 * @property {string} value
 * @property {boolean} [negative]
 */

class QueryHandler {
    static set(input) {
        return new QueryHandler(input).set();
    }

    constructor(input) {
        this._input = input;
    }

    get input() {
        if (this._input) return this._input;
        const hash = window.location.hash;
        const query = new URLSearchParams(window.location.search);
        const q = query.get('q') || '';

        return `${q} ${hash}`;
    }

    get query() {
        return this.input.split(' ').filter(Boolean);
    }

    get terms() {
        /** @type {(QueryTerm)[]} */
        const terms = [];

        for (const token of this.query) {
            // allow strings that don't match and store them as the key with an undefined value
            const [, negative, key = token, value] = /^(-)?([^:]+):(.+)$/.exec(token) || [];

            terms.push({
                key,
                value,
                negative,
            });
        }

        return terms;
    }

    /**
     * @param {string} key
     * @returns {QueryTerm}
     */
    get(key) {
        return this.terms.find(term => term.key === key);
    }

    /**
     * @param {QueryTerm} term
     * @returns {string}
     */
    serialize(term) {
        const { key, value, negative } = term;

        if (value === undefined) return key;

        return `${negative ? '-' : ''}${key}:${value}`;
    }

    has(key) {
        return !!this.get(key);
    }

    /**
     * @param {QueryTerm[]} newTerms
     */
    set(newTerms) {
        const { terms } = this;
        const qParams = [];
        const hParams = [];

        for (const term of newTerms) {
            const existing = this.get(term.key);
            if (existing) {
                existing.value = term.value;
                existing.negative = term.negative;
            } else {
                terms.push(term);
            }
        }

        console.log('termsssss', JSON.stringify(terms, null, 2));

        for (const term of this.terms) {
            if (customCommands.includes(term.key)) {
                hParams.push(this.serialize(term));
            } else {
                qParams.push(this.serialize(term));
            }
        }

        const newHash = hParams.join(' ');
        const newQuery = new URLSearchParams(window.location.search);
        newQuery.set('q', qParams.join(' '));

        const newUrl = `${window.location.pathname}?${newQuery}#${newHash}`;
        window.location.replace(newUrl);
    }
}


function setupSearchInterceptor() {
    const searchForm = /** @type {HTMLFormElement} */ (document.querySelector('form.subnav-search'));
    const searchInput = /** @type {HTMLInputElement} */ (searchForm?.querySelector('input[name="q"]'));
    if (!searchForm || !searchInput) return;

    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const inputValue = searchInput.value;
        // save the current hash as well
        const input = `${inputValue} ${window.location.hash}`;

        QueryHandler.set(input);
    });
}

globalThis.queryHandler = new QueryHandler();

Object.assign(globalThis, {
    setupSearchInterceptor,
});
