/** @typedef { 'groupByDependency' | 'persistSortAsc' | 'filterApprovedByMe' | 'filterNotApprovedByMe' } Options */


class OptionsHandler {
    /**
     * 
     * @param {Options} opt 
     * @returns 
     */
    get(opt) {
        return;
    }

    /**
     * 
     * @param {Options} opt 
     * @param {any} value 
     * @returns 
     */
    set(opt, value) {
        return;
    }

    /**
     * 
     * @param {Options} opt 
     * @param {{(value: boolean): unknown}} callback 
     * @param {boolean} [initial]
     */
    watch(opt, callback, initial) {

    }

}

globalThis.globalOptions = new OptionsHandler();