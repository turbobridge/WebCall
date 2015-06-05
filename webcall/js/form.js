// TODO : document
// postPopulateCallback, postResetCallback - mainly for setting up the display correctly

function Form(fields, idPrefix, defaults) {
    this.fields   = [];
    this.idPrefix = '';
    this.defaults = {};
    this.locked   = false;
    this.jQuery   = jQuery;

    if (fields !== undefined)
        this.fields = fields;

    if (idPrefix !== undefined)
        this.idPrefix = idPrefix;

    if (defaults !== undefined)
        this.defaults = defaults;
}

Form.prototype.setFields = function(fieldObject) {
    this.fields = [];

    for (var i in fieldObject) {
        this.fields.push(i);

        if (typeof fieldObject[i] == "object" && fieldObject[i] !== null) {
            this.defaults[i] = fieldObject[i]["default"];
        } else {
            this.defaults[i] = fieldObject[i];
        }
    }
};

Form.prototype.setFieldIDPrefix = function(prefix) {
    this.idPrefix = prefix;
};

Form.prototype.typeOf = function(obj) {
    type = typeof obj;

    return type === "object" && !obj ? "null" : type;
};

Form.prototype.reset = function() {
    var $        = this.jQuery;
    var defaults = this.defaults;

    for (var i in this.fields) {
        var cur   = this.fields[i];
        var field = $("#" + this.idPrefix + cur);
        var type = field.attr('type');
        var val;

        if (defaults[cur] !== undefined) {
            val = defaults[cur];
        } else {
            val = '';
        }

        // convert val to boolean for 'checked' attr
        if (type == 'checkbox') {
            if (val)
                val = true;
            else
                val = false;
        }

        if (type == 'checkbox')
            field[0].checked = !!val;
        else
            field.val(val);
    }

    if (this.postResetCallback !== undefined)
        this.postResetCallback();
};

Form.prototype.populate = function(data) {
    if (this.prePopulateCallback)
        this.prePopulateCallback(data);

    for (var i in this.fields) {
        var cur   = this.fields[i];

        this.setDataField(cur, data[cur]);
    }

    if (this.postPopulateCallback !== undefined)
        this.postPopulateCallback(data);
};

Form.prototype.setDataField = function(fieldName, val) {
    var $     = this.jQuery;

    var field = $("#" + this.idPrefix + fieldName);

    if (field[0] === undefined)
        return;

    if (field.data("appDropdown")) {
        field.val(val);
        field.dropdown("refresh");
        return;
    }

    if (field[0].tagName == "SPAN") {
        field.text(val);
    } else {
        if (field.attr("type") == "checkbox") {
            field[0].checked = !!val;
        } else {
            field.val(val);
        }
    }
};

Form.prototype.getData = function() {
    var data = {};

    for (var i in this.fields) {
        var cur   = this.fields[i];
        var val   = this.getDataField(cur);

        if (val !== undefined)
            data[cur] = val;
    }

    return data;
};

Form.prototype.getDataField = function(fieldName) {
    var $     = this.jQuery;
    var field = $("#" + this.idPrefix + fieldName);
    var type = field.attr('type');
    var ret;
    
    if (type == 'checkbox') {
        ret = field[0].checked;
    } else {
        ret = field.val();
    }

    return ret;
};

Form.prototype.lock = function() {
    for (var i in this.fields) {
        var cur   = this.fields[i];

        this.disableField(cur);
    }

    this.locked = true;

    if (this.postLockCallback !== undefined)
        this.postLockCallback();
};

Form.prototype.unlock = function() {
    for (var i in this.fields) {
        var cur   = this.fields[i];

        this.enableField(cur);
    }

    this.locked = false;

    if (this.postUnlockCallback !== undefined)
        this.postUnlockCallback();
};

Form.prototype.disableField = function(fieldName) {
    var $ = this.jQuery;

    this.disableInput($("#" + this.idPrefix + fieldName));
};

Form.prototype.enableField = function(fieldName) {
    var $ = this.jQuery;

    this.enableInput($("#" + this.idPrefix + fieldName));
};

Form.prototype.disableInput = function(obj) {
    var type;
    if (obj[0] === undefined)
        type = 'undefined';
    else
        type = obj[0].type;

    var addClass = type != 'button' && type != 'radio' && type != 'checkbox' && type != 'select-one' && type != 'undefined' && type != 'hidden';
    
    if (obj.data("appDropdown")) {
        obj.dropdown("disable");
        return;
    }

    obj.attr('disabled', true);

    if (addClass)
        obj.addClass('disabledField');

    if (obj.hasClass('hasDatepicker'))
        obj.datepicker('disable');

    if (obj.hasClass('ui-button'))
        obj.button('option', 'disabled', true);
};

Form.prototype.enableInput = function(obj) {
    if (!obj.hasClass('disabledPermanently')) {
        if (obj.data("appDropdown")) {
            obj.dropdown("enable");
            return;
        }

        obj.attr('disabled', false).removeClass('disabledField');

        if (obj.hasClass('hasDatepicker'))
            obj.datepicker('enable');
    }

    if (obj.hasClass('ui-button'))
        obj.button('option', 'disabled', false);
};
