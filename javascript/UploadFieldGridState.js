(function($) {
    $.entwine('ss', function($) {
        // Install the directory selection handler
        $('form.uploadfield-form .TreeDropdownField').entwine({
            onmatch: function() {
                this._super();

                var self = this;
                var fileList = self.closest('form').find('.ss-gridfield');

                // reset pagination
                fileList.setState('GridFieldPaginator', { currentPage: 1 });
                fileList.reload();

                this.bind('change', function() {
                    // set new parent
                    fileList.setState('ParentID', self.getValue());

                    // reset pagination
                    fileList.setState('GridFieldPaginator', { currentPage: 1 });

                    // reload
                    fileList.reload();
                });
            },
            onunmatch: function() {
                this._super();
            }
        });
    });
})(jQuery);
