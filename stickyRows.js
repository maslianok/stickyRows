(function($) {
    var uuid = 0;

    //http://chris-spittles.co.uk/jquery-calculate-scrollbar-width/
    function scrollbarWidth() {
        var $inner = $('<div style="width: 100%; height:200px;">test</div>'),
            $outer = $('<div style="width:200px;height:150px; position: absolute; top: 0; left: 0; visibility: hidden; overflow:hidden;"></div>').append($inner),
            inner = $inner[0],
            outer = $outer[0];
        $('body').append(outer);
        var w1 = inner.offsetWidth;
        $outer.css('overflow', 'scroll');
        var w2 = outer.clientWidth;
        $outer.remove();
        return (w1 - w2);
    }


    $.fn.stickyRows = function(options) {
        var val = [];
        var args = Array.prototype.slice.call(arguments, 1);

        if (typeof options === 'string') {
            this.each(function () {
                var instance = $.data(this, 'stickyRows');
                if (typeof instance !== 'undefined' && $.isFunction(instance[options])) {
                    var methodVal = instance[options].apply(instance, args);
                    if (methodVal !== undefined && methodVal !== instance) val.push(methodVal);
                }
                else return $.error('No such method "' + options + '" for stickyRows');
            });
        }
        else {
            this.each(function () {
                if (!$(this).is('.sticky-table-for-shifting, .sticky-table')) {
                    if (!$.data(this, 'stickyRows')) {
                        $.data(this, 'stickyRows', StickyRows(this, options));
                    } else {
                        $.data(this, 'stickyRows').setRowSets().calculateDimensions().redraw('init');
                    }
                }
            });
        }

        if (val.length === 0) return this;
        else if (val.length === 1) return val[0];
        else return val;

    };


    // Initialization
    function StickyRows(el, options) {
        return new StickyRows.prototype.init(el, options);
    }


    $.StickyRows = StickyRows;
    $.StickyRows.opts = {
        container: 'body',
        rows: 'thead',
        scrollWidth: 'auto',
        containersToSynchronize: false,
        performanceDebugging: false
    };


    // Functionality
    StickyRows.fn = $.StickyRows.prototype = {

        //initialize
        init: function(el, options) {
            this.document = document;
            this.window = window;
            this.uuid = uuid++;

            this.table = {$element: $(el)};

            // current settings
            this.opts = $.extend(
                {},
                $.StickyRows.opts,
                this.table.$element.data(),
                options
            );

            if (this.opts.performanceDebugging) console.time("initialize stickyRows");

            //calculate scrollBar width
            this.opts.scrollWidth = this.opts.scrollWidth == 'auto' ? scrollbarWidth() : this.opts.scrollWidth;

            this.container = {$element: this.table.$element.closest(this.opts.container)};
            this.scroll = {'vertical': false, 'horizontal': false, mode: 'scrolling', shiftToRow: -1};

            this.setRowSets();
            this.setContainersToSynchronize();
            this.calculateDimensions();

            if (this.opts.performanceDebugging) console.timeEnd("initialize stickyRows");

            //onScroll functionality
            if (this.container.$element.is('body')) {
                $(document).off('.stickyRows').on('scroll.stickyRows', $.proxy(this.redraw, this));
            } else {
                this.container.$element.off('.stickyRows').on('scroll.stickyRows', $.proxy(this.redraw, this));
            }


            //onResize window
            $(this.window).off('.stickyRows').on('resize.stickyRows', $.proxy(this.calculateDimensions, this));

            if (typeof ResizeSensor != 'undefined' && !this.container.$element.is('body')) {
                //onResize container
                new ResizeSensor(this.container.$element, $.proxy(this.calculateDimensions, this));
            }

            //onScroll elements to synchronize
            if (this.containersToSynchronize) {
                this.containersToSynchronize.off('.stickyRows').on('scroll.stickyRows', $.proxy(this.calculateDimensions, this));
            }

            this.redraw('init');

            return this;

        },

        redraw: function(mode) {
            var isForceRedraw =  mode && mode == 'init';

            if (this.blocked) return this;
            if (this.opts.performanceDebugging) console.time("stickyRows redraw");

            this.blocked = true;

            //current container scroll
            var containerScrollTop = this.container.$element.scrollTop();
            var scrollContainerLeft = this.container.$element.scrollLeft();

            this.scroll.vertical = false;
            this.scroll.horizontal = false;

            //is vertical scrolling
            if (containerScrollTop != this.container.scroll.top || isForceRedraw) {
                this.scroll.vertical = containerScrollTop > this.container.scroll.top ? 'down' : 'up';

                this.container.scroll.top = containerScrollTop;

                this.searchCurrentStickyRows();
                this.renderStickyRows();

            }

            //is horizontal scrolling
            if (scrollContainerLeft != this.container.scroll.left || isForceRedraw) {
                this.scroll.horizontal = scrollContainerLeft > this.container.scroll.left ? 'right' : 'left';
                this.container.scroll.left = scrollContainerLeft;

                this.setHorizontalOffset();
            }

            this.blocked = false;

            if (this.opts.performanceDebugging) console.timeEnd("stickyRows redraw");

            return this;
        },

        //collect all sticky rows
        setRowSets: function() {
            var self = this;
            var rows = self.opts.rows;
            self.rowSets = [];
            self.stickyNow = [];

            if ($.isFunction(rows)) {
                $.each(rows(), function(i, rowSet) {
                    self.rowSets.push($.map(rowSet.get().reverse(), function(row) {
                        return {$row: $(row)}
                    }));
                });
            } else if (rows instanceof jQuery) {
                self.rowSets.push($.map(rows.get().reverse(), function(row) {
                    return {$row: $(row)}
                }));
            } else if (typeof rows === 'string') {
                self.rowSets.push($.map(self.table.$element.children(rows).get().reverse(), function(row) {
                    return {$row: $(row)}
                }));
            } else if ($.isArray(rows)) {
                $.each(rows, function(i, selector) {
                    self.rowSets.push($.map(self.table.$element.children(selector).get().reverse(), function(row) {
                        return {$row: $(row)}
                    }));
                });
            } else {
                $.error('stickyRows.rows has incorrect format.');
            }

            return this;
        },

        //when this containers will scroll - sticky header will redraw
        setContainersToSynchronize: function() {
            var self = this;

            if (self.opts.containersToSynchronize) {
                var containersToSynchronize = self.opts.containersToSynchronize;
                self.containersToSynchronize = [];
                if ($.isFunction(containersToSynchronize)) {
                    self.containersToSynchronize = containersToSynchronize();
                } else if (containersToSynchronize instanceof jQuery) {
                    self.containersToSynchronize = containersToSynchronize;
                } else if (typeof containersToSynchronize === 'string') {
                    self.containersToSynchronize = $(containersToSynchronize);
                } else if ($.isArray(containersToSynchronize)) {
                    self.containersToSynchronize = $(containersToSynchronize.join(','));
                } else {
                    $.error('stickyRows.containersToSynchronize has incorrect format.');
                }
            }

            return this;
        },

        //calculate width & offset of elements
        calculateDimensions: function() {
            var self = this;
            var offset;

            if (this.blocked) return this;
            if (this.opts.performanceDebugging) console.time("stickyRows: calculate dimensions");

            this.blocked = true;

            //scrollable container
            this.container.offset = this.container.$element.offset();
            this.container.width = this.container.$element.outerWidth() - this.opts.scrollWidth;
            this.container.scroll = {top: this.container.$element.scrollTop(), left: this.container.$element.scrollLeft()};

            //table
            this.table.width = this.table.$element.outerWidth();
            this.table.offset = this.table.$element.offset();

            //sticky rows
            $.each(self.rowSets, function(i, rowSet) {
                $.each(rowSet, function(j, rowObj) {
                    offset = rowObj.$row.offset();
                    rowObj.offset = {top: offset.top + self.container.scroll.top - self.container.offset.top, left: offset.left - self.container.offset.left};
                    rowObj.height = rowObj.$row.outerHeight();
                });
            });

            //insert sticky wrapper into DOM
            if (!this.stickyHead) {
                var $element = $('<div/>').addClass('sticky-header hidden').css({'top': this.container.offset.top, 'left': this.table.offset.left - this.container.scroll.left, 'width': this.container.width}).insertBefore(this.table.$element);
                var $table = $('<table/>').addClass('sticky-table').addClass(this.table.$element.attr('class')).css({'width': this.table.width}).appendTo($element);
                var $tableForShifting = $table.clone().addClass('sticky-table-for-shifting hidden').appendTo($element);
                this.stickyHead = {$element: $element, $table: $table, $tableForShifting: $tableForShifting, height: 0, changed: false};
            } else {
                this.stickyHead.$element.css({'top': this.container.offset.top, 'left': this.table.offset.left + this.container.scroll.left, 'width': this.container.width});
                this.stickyHead.$table.css({'width': this.table.width});
                this.stickyHead.$tableForShifting.css({'width': this.table.width});
            }
            this.blocked = false;

            if (this.opts.performanceDebugging) console.timeEnd("stickyRows: calculate dimensions");

            return this;
        },



        //set
        // this.stickyNow - rows, that currently sticky
        // this.scroll.mode - scrolling/shifting
        // this.stickyHead.changed - is stickyNow changed in compare with previous data
        searchCurrentStickyRows: function() {
            var self = this;
            var upperBoundToScrolling = self.container.scroll.top;
            var upperBoundToShifting = self.container.scroll.top + self.stickyHead.height;
            var cnt;
            var stickyNow = [];

            if (self.scroll.vertical == 'up') {
                self.scroll.mode = 'scrolling';
                self.scroll.shiftToRow = -1;
            }

            $.each(this.rowSets, function(i, rowSet) {

                cnt = i;
                while (cnt--) {
                    if (stickyNow[cnt]) {
                        upperBoundToScrolling += stickyNow[cnt].height;
                    }
                }

                $.each(rowSet, function(j, rowObj) {

                    if (rowObj.offset.top < upperBoundToScrolling) {
                        stickyNow.push(rowObj);

                        if (!self.stickyNow[i] || self.stickyNow[i].$row != rowObj.$row) {
                            self.stickyHead.changed = true;
                            self.scroll.mode = 'scrolling';
                            self.scroll.shiftToRow = -1;
                        }
                        return false;
                    } else if (self.scroll.vertical == 'down' && self.scroll.mode == 'scrolling' && rowObj.offset.top <= upperBoundToShifting) {
                        if (self.stickyNow[i] && self.stickyNow[i].$row != rowObj.$row) {
                            self.stickyNow.push(rowObj);
                            self.scroll.mode = 'shifting';
                            self.scroll.shiftToRow = i;
                        }
                        return false;
                    }
                });
            });

            if (self.stickyHead.changed || self.stickyNow.length != stickyNow.length) {
                if (self.scroll.mode == 'scrolling') {
                    self.stickyNow = stickyNow;
                }

                self.stickyHead.changed = true;
            }
        },

        //redraw sticky header
        renderStickyRows: function() {
            var self = this;
            var $el;

            //if something changed
            if (this.stickyHead.changed) {

                //if 'scrolling' mode
                if (self.scroll.mode == 'scrolling') {
                    var stickyHeadHeight = 0;

                    this.stickyHead.$table.css({'margin-top': 0 }).empty();
                    self.stickyHead.$tableForShifting.empty().addClass('hidden');

                    if (this.stickyNow.length) {

                        this.stickyHead.$element.removeClass('hidden');

                        $.each(this.stickyNow, function(i, el) {
                            stickyHeadHeight += el.height;
                            self.stickyHead.$table.append(self.getCloneOfRow(el));
                        });

                    } else {
                        this.stickyHead.$element.addClass('hidden');
                        this.stickyHead.$table.empty();
                    }

                    this.stickyHead.height = stickyHeadHeight;

                } else {
                    //if 'shifting' mode
                    $el = this.stickyNow[this.stickyNow.length - 1];
                    self.stickyHead.$table.append(self.getCloneOfRow($el));

                    //fill and show 'tableForShifting'
                    if (self.scroll.shiftToRow) {
                        self.stickyHead.$tableForShifting.empty().removeClass('hidden');
                        self.stickyHead.$table.children(':lt(' + self.scroll.shiftToRow + ')').clone().appendTo(self.stickyHead.$tableForShifting);
                    }
                }

                this.stickyHead.changed = false;
            }

            //set margin-top of main table in 'shifting' mode
            if (self.scroll.mode == 'shifting') {
                $el = $el || this.stickyNow[this.stickyNow.length - 1];
                self.stickyHead.$table.css({'margin-top': ($el.offset.top - self.container.scroll.top) - this.stickyHead.height })
            }

        },

        setHorizontalOffset: function() {
            this.stickyHead.$table.css({'margin-left': -this.container.scroll.left});
            this.stickyHead.$tableForShifting.css({'margin-left': -this.container.scroll.left});
        },

        getRowCells: function($row) {
            //FIXME something wrong here
            return $row.is('thead, tbody') ? $row.children().children() : $row.children();
        },

        //lazy implementation of $clone row
        getCloneOfRow: function(rowObj) {
            var $rowCloneTd;

            if (!rowObj.$clone) {
                rowObj.$clone = rowObj.$row.clone();
                $rowCloneTd = this.getRowCells(rowObj.$clone);

                $.each(this.getRowCells(rowObj.$row), function(i, cell) {
                    $rowCloneTd.eq(i).css('width', $(cell).width());
                });
            }
            return rowObj.$clone;
        }
    };


    StickyRows.prototype.init.prototype = StickyRows.prototype;


})(jQuery);
