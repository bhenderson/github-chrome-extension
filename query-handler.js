/** @ts-check */

const customCommands = /** @type {const} */ ([
    'approved-by',
    'changes-requested',
    'dependency', // dependency:tree
])

/** @typedef { keyof typeof customCommands } CustomCommand */

/**
 * Term keys that are not allowed to be duplicated
 * 
 * @type {const}
 */
const uniqueTerms = ['draft', 'archived', 'sort']

/**
 * @typedef {Object} QueryTerm
 * @property {string} key
 * @property {string} value
 * @property {boolean} negative
 */

class QueryHandler {
    static get input() {
        return new QueryHandler().input;
    }

    static set(input) {
        const qh = new QueryHandler()
        
        qh.set(input);
    }

    extraInput = '';

    get input() {
        return this.terms.map(this.serialize).join(' ');
    }

    get query() {
        const { searchInput } = getFormInput();
        const hash = window.location.hash?.replace('#', '');
        const query = new URLSearchParams(window.location.search);
        const q = query.get('q') || '';
        const input = [searchInput.value, q, hash, this.extraInput].filter(Boolean).join(' ');

        return input.split(' ').filter(Boolean);
    }

    get terms() {
        /** @type {(QueryTerm)[]} */
        const terms = [];

        for (const token of this.query) {
            // allow strings that don't match and store them as the key with an undefined value
            const [, dash, key = token, value] = /^(-)?([^:]+):(.+)$/.exec(token) || [];
            const negative = !!dash;
            // const existing = terms.find(t => t.key === key && (t.value === value || uniqueTerms.includes(t.key)));
            // ignore negative when checking for existing terms
            const existing = terms.find(t => this.serialize(t) === this.serialize({ key, value }));

            if (existing) {
                existing.negative = negative;
            } else {
                terms.push({ key, value, negative });
            }
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
        let result = '';

        if (negative) result += '-';
        result += key;
        if (value) result += `:${value}`;

        return result;
    }

    has(value) {
        return !!this.terms.find(term => this.serialize(term) === value);
    }

    /**
     * @param {QueryTerm[] | string} newTerms
     * @returns {string}
     */
    url(newTerms) {
        if (newTerms) {
          this.extraInput = typeof newTerms === 'string' ? newTerms : newTerms.map(this.serialize).join(' ');
        }

        const qParams = [];
        const hParams = [];

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

        // reset
        this.extraInput = '';

        return `${window.location.pathname}?${newQuery}#${newHash}`;
    }

    /**
     * @param {QueryTerm[] | string} [newTerms]
     */
    set(newTerms = []) {
        window.location.replace(this.url(newTerms));
    }
}

function getFormInput() {
    const searchForm = /** @type {HTMLFormElement} */ (document.querySelector('form.subnav-search'));
    const searchInput = /** @type {HTMLInputElement} */ (searchForm?.querySelector('input[name="q"]'));

    if (!searchForm || !searchInput) return {};

    return { searchForm, searchInput };
}


function setupSearchInterceptor() {
    const { searchForm, searchInput } = getFormInput();
    if (!searchForm) return;

    const newValue = QueryHandler.input;
    console.log({ newValue });
    searchInput.value = newValue;
    
    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();

        QueryHandler.set();
    });
}

console.log('foooooooooooooo')
globalThis.queryHandler = new QueryHandler();

Object.assign(globalThis, {
    setupSearchInterceptor,
});
