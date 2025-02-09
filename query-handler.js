/** @ts-check */

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

/**
 * @typedef {Object} QueryHandlerOptions
 */

class QueryHandler {
  /**
   * @param {QueryHandlerOptions} opts
   */
  static input(opts = {}) {
    return new QueryHandler(opts).input;
  }

  /**
   * @param {string} [input]
   */
  static set(input) {
    const qh = new QueryHandler()
    
    qh.set(input);
  }

  /**
   * @param {QueryHandlerOptions} opts
   */
  constructor(opts = {}) {
  }

  extraInput = '';

  get input() {
    return this.terms.map(this.serialize).join(' ');
  }

  get query() {
    const searchForm = /** @type {HTMLFormElement} */ (document.querySelector('form.subnav-search'));
    const searchInput = /** @type {HTMLInputElement} */ (searchForm?.querySelector('input[name="q"]'));

    if (!searchForm || !searchInput) return {};

    const query = new URLSearchParams(window.location.search);
    const q = query.get('q') || '';
    const input = [searchInput.value, q, this.extraInput]

    return input.join(' ').split(' ').filter(Boolean);
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
   * @param {QueryTerm | string} term
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
   * @param {QueryTerm | string} value 
   * @returns 
   */
  has(value) {
    return !!this.terms.find(term => this.serialize(term) === this.serialize(value));
  }

  /**
   * @param {QueryTerm[] | string} newTerms
   * @returns {string}
   */
  url(newTerms) {
    if (newTerms) {
      this.extraInput = typeof newTerms === 'string' ? newTerms : newTerms.map(this.serialize).join(' ');
    }

    const { terms } = this;
    const qParams = [];
    const hParams = [];

    for (const term of terms) {
        qParams.push(this.serialize(term));
    }

    const newQuery = new URLSearchParams(window.location.search);
    newQuery.set('q', qParams.join(' '));

    // reset
    this.extraInput = '';

    return `${window.location.pathname}?${newQuery}`;
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

const queryHandler = new QueryHandler();