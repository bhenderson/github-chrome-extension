/** 
 * @typedef { 
 *   | 'groupByDependency'
 *   | 'filterApprovedByMe'
 *   | 'filterNotApprovedByMe'
 *   | 'githubToken'
 *   | 'persistentSearch'
 * } Options 
 */
/**
 * @typedef {{(value: boolean): unknown}} Callback
 */

class EventEmitter extends EventTarget {
    on(event, callback) {
        this.addEventListener(event, callback);
    }

    off(event, callback) {
        this.removeEventListener(event, callback);
    }

    emit(event, value) {
        this.dispatchEvent(new CustomEvent(event, { detail: value }));
    }
}

class OptionsHandler {
    name = 'github-chrome-extension';

    constructor() {
        this.eventEmitter = new EventEmitter();
        this.options = JSON.parse(localStorage.getItem(this.name) || '{}');
    }

    /**
     * 
     * @param {Options} opt 
     * @returns 
     */
    get(opt) {
        return this.options[opt];
    }

    /**
     * 
     * @param {Options} opt 
     * @param {any} value 
     */
    set(opt, value, internal = false) {
        this.options[opt] = value;
        this.eventEmitter.emit(opt, value);
        localStorage.setItem(this.name, JSON.stringify(this.options));

        if (internal) return;

        // some options are mutually exclusive
        if (opt === 'filterApprovedByMe' && value) {
            this.set('filterNotApprovedByMe', false, true);
        }
        if (opt === 'filterNotApprovedByMe' && value) {
            this.set('filterApprovedByMe', false, true);
        }
    }

    /**
     * @template {Options} T
     * @param {T} opt 
     * @param {Callback} callback 
     * @param {boolean} [initial]
     */
    watch(opt, callback, initial) {
        if (initial) {
            callback(this.get(opt));
        }

        this.eventEmitter.on(opt, event => callback(event.detail));
    }

    get token() {
        let token = this.get('githubToken');

        if (!token) {
            token = prompt('Please enter your GitHub API token:');
            this.set('githubToken', token);
        }

        return token;
    }
}

const globalOptions = new OptionsHandler();
