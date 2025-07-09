// @ts-check 

/**
 * Term keys that are not allowed to be duplicated
 */
const uniqueTerms = /** @type {const} */ (['draft', 'archived', 'sort'])

class QueryHandler {
  /** @type {QueryTerm[]} */
  terms = []
  debounceId = ''

  constructor() {
    const query = new URLSearchParams(window.location.search);
    const input = query.get('q')

    /** @type {(QueryTerm)[]} */
    const terms = [];

    for (const token of input.split(' ')) {
      const { key, value, negative } = this.toTerm(token)
      // const existing = terms.find(t => t.key === key && (t.value === value || uniqueTerms.includes(t.key)));
      // ignore negative when checking for existing terms
      const existing = terms.find(t => this.serialize(t) === this.serialize({ key, value }));

      if (existing) {
        existing.negative = negative;
      } else {
        terms.push({ key, value, negative });
      }
    }

    this.terms = terms
  }

  /**
   * @returns {string}
   */
  get input() {
    return this.terms.map(this.serialize).join(' ');
  }

  /**
   * @returns {string[]}
   */
  get tokens() {
    return this.terms.map(this.serialize)
  }

  /**
   * @param {string} token
   * @returns {QueryTerm}
   */
  toTerm(token) {
    // allow strings that don't match and store them as the key with an undefined value
    const [, dash, key = token, value] = /^(-)?([^:]+):(.+)$/.exec(token) || [];
    const negative = !!dash;

    return { key, value, negative }
  }

  /**
   * @param {string} key
   * @returns {QueryTerm}
   */
  get(key) {
    return this.terms.find(term => term.key === key);
  }

  /**
   * @param {Omit<QueryTerm, 'token'> | string} term
   * @returns {string}
   */
  serialize(term) {
    if (typeof term === 'string') return term;

    const { key, value, negative } = term;
    let result = '';

    if (negative) result += '-';
    result += key;
    if (value) result += `:${value}`;

    return result;
  }

  /**
   * 
   * @param {Omit<QueryTerm, 'token'> | string} value 
   * @returns 
   */
  has(value) {
    return !!this.terms.find(term => this.serialize(term) === this.serialize(value));
  }

  get search() {
    const { terms } = this;
    const qParams = [];

    for (const term of terms) {
      qParams.push(this.serialize(term));
    }

    const newQuery = new URLSearchParams(window.location.search);
    newQuery.set('q', qParams.join(' '));

    return newQuery.toString();
  }

  /**
   * Set the new query as a string (redirects if terms are changing)
   * 
   * @param {string} terms
   */
  setQuery(terms) {
    this.set(terms.split(' ').map(token => this.toTerm(token)))
  }

  /**
   * Set the new query (redirects if terms are changing)
   * 
   * @param {QueryTerm[]} terms
   */
  set(terms) {
    const missingTerms = terms.filter(newTerm => !this.has(newTerm))
    const missingTermKeys = missingTerms.map(term => term.key)

    const newTerms = [...this.terms.filter(oldTerm => !missingTermKeys.includes(oldTerm.key)), ...missingTerms]

    const termsSame = this.compareTerms(this.terms, newTerms);

    if (termsSame) return;

    this.setFilters(newTerms)
  }

  /**
   * Set the new query search, but debounce the call to prevent infinite reload loop
   * 
   * @param {QueryTerm[]} filters
   */
  setFilters(filters) {
    this.terms = filters

    const setId = String(Math.floor(Math.random() * 10000))
    this.debounceId = setId

    setTimeout(() => {
      if (this.debounceId !== setId) return

      const query = new URLSearchParams();
      query.set('q', filters.map(filter => this.serialize(filter)).join(' '))

      window.location.search = query.toString()
    }, 500)
  }

  /**
   * Remove a query query (redirects if terms are changing)
   * 
   * @param {Pick<QueryTerm, 'key'>} [termToRemove]
   */
  remove(termToRemove) {
    const oldTerms = this.terms;

    if (!termToRemove) return

    const termExists = oldTerms.find(existingTerm => existingTerm.key === termToRemove.key)

    if (!termExists) return

    const newTerms = oldTerms.filter(existingTerm => existingTerm.key !== termToRemove.key)
    const termsSame = this.compareTerms(oldTerms, newTerms);

    if (termsSame) return;

    this.setFilters(newTerms)
  }

  /**
   * Compare to see if the terms have changed
   * 
   * @param {Omit<QueryTerm, 'token'>[]} oldTerms 
   * @param {Omit<QueryTerm, 'token'>[]} newTerms 
   * @returns {boolean}
   */
  compareTerms(oldTerms, newTerms) {
    if (oldTerms.length !== newTerms.length) return false;

    return oldTerms.every((term) => {
      return newTerms.some(newTerm => this.serialize(term) === this.serialize(newTerm));
    });
  }
}

function getFormInput() {
  const searchForm = /** @type {HTMLFormElement} */ (document.querySelector('form.subnav-search'));
  const searchInput = /** @type {HTMLInputElement} */ (searchForm?.querySelector('input[name="q"]'));

  if (!searchForm || !searchInput) return {};

  return { searchForm, searchInput };
}

const queryHandler = new QueryHandler();