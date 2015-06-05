$.widget("app.dropdown", $.ui.selectmenu, {
    options : {
        label : null,
        corners : null,
        disableBorders : null
    },

	_create : function() {
        this._super();
        //this.button.removeClass("ui-corner-all");

        if (this.options.corners && this.options.corners instanceof Array) {
            for (var i in this.options.corners)
                this.button.addClass("ui-corner-" + this.options.corners[i]);
        }

        if (this.options.disableBorders && this.options.disableBorders instanceof Array) {
            for (var i in this.options.disableBorders)
                this.button.css("border-" + this.options.disableBorders[i], 0);
        }
    },

	_toggleAttr: function() {
		this.button
		    .toggleClass( "ui-corner-top", this.isOpen )
			.toggleClass( "ui-corner-all", !this.isOpen )
			.attr( "aria-expanded", this.isOpen );

        if (this.options.corners) {
            for (var i in this.options.corners) {
                var cur = this.options.corners[i];
                if (cur.indexOf("b") == 0) {
                    if (this.isOpen)
                        this.button.removeClass("ui-corner-" + cur);
                    else
                        this.button.addClass("ui-corner-" + cur);
                }
            }
        }

		this.menuWrap.toggleClass( "ui-selectmenu-open", this.isOpen );
		this.menu.attr( "aria-hidden", !this.isOpen );
	},

    _setText : function(element, value) {
        if (!element.hasClass("ui-selectmenu-text")) {
            this._super(element, value);
            return;
        }

        if (!this.options.label) {
            this._super(element, value);
            return;
        }

        if (!this.labelInit) {
            element.empty();
            element.append([
                $("<span>")
                    .addClass("spnDropdownLabel")
                    .text(this.options.label + ": "),
                $("<span>")
                    .addClass("spnDropdownValue")
            ]);
                    
            this.labelInit = true;
        }

        element.find(".spnDropdownValue").text(value);

        // TODO delete
        //console.log("setText", element, value, element[0].innerHTML);
    },

	_position: function() {
        var position = $.extend( { of: this.button }, this.options.position );

        var left = "+0";

        if (this.options.disableBorders) {
            if (this.options.disableBorders.indexOf("left") >= 0)
                left = "-1";
        }

        position.my = "left" + left + " top";

		this.menuWrap.position(position);
	},

	_resizeMenu: function() {
        var width = Math.max(
			this.button.outerWidth(),

			// support: IE10
			// IE10 wraps long text (possibly a rounding bug)
			// so we add 1px to avoid the wrapping
			this.menu.width( "" ).outerWidth() + 1
		);

        if (this.options.disableBorders) {
            if (this.options.disableBorders.indexOf("left") >= 0)
                width++;

            if (this.options.disableBorders.indexOf("right") >= 0)
                width++;
        }

		this.menu.outerWidth(width);
	}
});
