(function($){

    var gridField;

    $.entwine('ss', function($) {
        $('.ss-gridfield').entwine({
            onmatch: function() {
                // make gridfield accessible to functions outside of entwine scope.
                gridField = $(this);

                // only add extra logic if sessionStorage is supported by browser
                if(typeof(Storage) !== "undefined") {
                    this.filterState = 'hidden';
                    var savedState = getSavedState();
                    var configKey = getConfigKey();

                    // try applying previously saved gridstate to gridview
                    try {
                        if(savedState && configKey && typeof savedState[configKey] !== 'undefined') {
                            Object.keys(savedState[configKey]).forEach(function(key) {
                                // toggle filter to show if key === GridFieldFilterHeader (user is filtering)
                                if(
                                    key === 'GridFieldFilterHeader' &&
                                    Object.keys(savedState[configKey][key]).length > 0
                                ) {
                                    this.filterState = 'show';
                                }

                                $(this).setState(key, savedState[configKey][key]);
                            }, this);

                            $(this).reload({
                                data: [{ filter: this.filterState }]
                            });
                        }
                    } catch(err) {
                        // console.log(err);
                    }
                }
            },

            reload: function(ajaxOpts, successCallback) {
                // only add extra logic if sessionStorage is supported by browser
                if(typeof(Storage) !== "undefined") {
                    successCallback = function() {
                        var savedState = getSavedState();

                        // add pagination hook
                        updateGridStatePagination(savedState);

                        // add sortorder hook
                        updateGridStateSorting(savedState);
                    };
                }

                // init parent reload-hook with optionally overloaded successCallback function.
                this._super(ajaxOpts, successCallback);
            }
        });

        // when changing sort: reset pagination to page 1.
        $('.ss-gridfield .sortable-header .action.ss-gridfield-sort').entwine({
            onclick: function(e) {
                // only add extra logic if sessionStorage is supported by browser
                if(typeof(Storage) !== "undefined") {
                    resetGridStatePagination();
                }

                this._super(e);
            }
        });

        // onkeydown trigger for "enter" (user is filtering results): remember filter @ GridState
        $('.ss-gridfield .filter-header :input').entwine({
            onkeydown: function(e) {
                // only add extra logic if sessionStorage is supported by browser
                if(typeof(Storage) !== "undefined") {
                    if(e.keyCode == '13') {
                        updateGridStateFiltering();
                    }
                }

                // execute parent/original actions
                this._super(e);
            }
        });

        // filter reset trigger hook: clear filter in gridstate on reset.
        $('.ss-gridfield .filter-header button.ss-gridfield-button-reset,' +
            '.ss-gridfield .filter-header button.ss-gridfield-button-close').entwine({
            onclick: function(e) {
                // only add extra logic if sessionStorage is supported by browser
                if(typeof(Storage) !== "undefined") {
                    resetGridStateFiltering();
                }

                // any parent actions?
                this._super(e);
            }
        });
    });

    var resetGridStateFiltering = function() {
        // make sure all filter inputs are empty
        $('.ss-gridfield .filter-header :input').each(function(index){
            $(this).val('');
        });

        // empty grid state: GridFieldFilterHeader
        updateGridState('GridFieldFilterHeader', {}, overwrite = true);

        // reset pagination @ gridstate
        resetGridStatePagination();
    };

    // GridState Logic: Filtering
    var updateGridStateFiltering = function() {
        var gridFilter = { Columns: {} };

        // add input for all possible filtercolumns
        $('.ss-gridfield .filter-header :input').each(function(index){
            if($(this).val()) {
                var filterKey = $(this).attr('id').split('_');
                filterKey = filterKey[filterKey.length - 1];

                gridFilter.Columns[filterKey] = $(this).val();
            }
        });

        updateGridState('GridFieldFilterHeader', gridFilter);

        // reset pagination @ gridstate
        resetGridStatePagination();
    };

    // GridState Logic: Pagination
    var updateGridStatePagination = function() {
        try {
            var pageNumber = parseInt($('.ss-gridfield .pagination-page-number input').val(), 10);

            if (pageNumber && typeof pageNumber !== undefined) {
                updateGridState('GridFieldPaginator', { currentPage: pageNumber });
            }
        } catch (err) {
            // console.log(err);
        }
    };

    // GridState Logic: Sorting
    var updateGridStateSorting = function() {
        try {
            $sortOrder = $('.ss-gridfield .sortable-header .ss-gridfield-sorted');

            if ($sortOrder.length) {
                var sortColumn = $sortOrder.attr('id').replace('action_SetOrder', '');
                var sortDirection = 'asc';
                if ($sortOrder.hasClass('ss-gridfield-sorted-desc')) {
                    sortDirection = 'desc';
                }

                // update the gridstate
                updateGridState('GridFieldSortableHeader', {
                    SortColumn: sortColumn,
                    SortDirection: sortDirection
                });
            }
        } catch (err) {
            // console.log(err);
        }
    };

    // helper method: grid pagination reset logic
    var resetGridStatePagination = function() {
        updateGridState('GridFieldPaginator', { currentPage: 1 });

        if(typeof gridField !== 'undefined') {
            gridField.setState('GridFieldPaginator', { currentPage: 1 });
        }
    };

    // helper method to update the gridstate according to configKey & configType
    var updateGridState = function(configType, configValue, overwrite) {
        var configKey = getConfigKey();
        var savedState = getSavedState();

        if(configKey && savedState) {
            // check / set the correct object/array config @ savedState
            if (typeof savedState[configKey] == 'undefined') {
                savedState[configKey] = {};
            }
            if (typeof savedState[configKey][configType] == 'undefined') {
                savedState[configKey][configType] = {};
            }

            // overwrite the entire node?
            if(typeof overwrite !== 'undefined') {
                savedState[configKey][configType] = configValue;
            } else {
                // merge existing config with new value(s)
                savedState[configKey][configType] = extend(savedState[configKey][configType], configValue);
            }

            // save config to sessionStorage
            sessionStorage.GridState = JSON.stringify(savedState);
        }
    };

    var getConfigKey = function() {
        $gridField = $('.ss-gridfield');
        if($gridField.length && $gridField.attr('data-url')) {
            var configPath = $gridField.attr('data-url').split('?');
            return configPath[0];
        }
    };

    // Get saved grid state (object). If error/empty: return new & empty object.
    var getSavedState = function() {
        try {
            var savedState = JSON.parse(sessionStorage.GridState);
            moduleHistoryTracker(savedState, getConfigKey());
        } catch (err) {
            var savedState = {};
        }

        return savedState;
    };

    // method used to track whether the user has left the module (in the same tab)
    // and whether we sould reset the gridState
    var moduleHistoryTracker = function(savedState, configKey) {
        if(typeof savedState !== 'undefined' && typeof configKey !== 'undefined') {
            // trim "/" from window.location (left and right)
            var windowPath =  window.location.pathname.replace(/^[\/,]+|[\/,]+$/g, '').split('/');

            if(typeof window.previousGridStateConfigKey !== 'undefined') {
                var configPath = window.previousGridStateConfigKey.split('/');

                if(configPath.length > 1 && windowPath.length > 1 && configPath[1] != windowPath[1]) {
                    // oki, module name changed: reset gridState.
                    sessionStorage.GridState = JSON.stringify({});
                }
            }

            window.previousGridStateConfigKey = configKey;
        }
    };

    // helper function to merge objects, could use jQuery.extend() as well though...
    var extend = function(obj, src) {
        Object.keys(src).forEach(function(key) { obj[key] = src[key]; });
        return obj;
    };

}(jQuery));



// Object.keys polyfill
// See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
if (!Object.keys) {
    Object.keys = (function() {
        'use strict';
        var hasOwnProperty = Object.prototype.hasOwnProperty,
            hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
            dontEnums = [
                'toString',
                'toLocaleString',
                'valueOf',
                'hasOwnProperty',
                'isPrototypeOf',
                'propertyIsEnumerable',
                'constructor'
            ],
            dontEnumsLength = dontEnums.length;

        return function(obj) {
            if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
                throw new TypeError('Object.keys called on non-object');
            }

            var result = [], prop, i;

            for (prop in obj) {
                if (hasOwnProperty.call(obj, prop)) {
                    result.push(prop);
                }
            }

            if (hasDontEnumBug) {
                for (i = 0; i < dontEnumsLength; i++) {
                    if (hasOwnProperty.call(obj, dontEnums[i])) {
                        result.push(dontEnums[i]);
                    }
                }
            }
            return result;
        };
    }());
}