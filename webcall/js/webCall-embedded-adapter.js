"use strict";

if (!window.WebCall) window.WebCall = {};

WebCall.initEmbedded = function(iframeLocation, targetWindow, onUnsupported, getConnectParams, onConfUpdate, onReady) {
    var debug = 1;
    function listener(event) {
        if (debug)
            console.log("WebCall:EmbeddedAdapter.listener()", event);

        if (iframeLocation.indexOf(event.origin) !== 0)
            return;

        if (!event.data || !event.data.type)
            return;

        if (debug)
            console.log("WebCall:EmbeddedAdapter.listener event " + event.data.type);

        if (event.data.type == "init") {
            if (event.data.params.supported)
                WebCall.adapter = new WebCall.EmbeddedAdapter(targetWindow[0].contentWindow, event.data.params, getConnectParams, onConfUpdate, onReady);
            else
                onUnsupported();
            
            return;
        }

        if (WebCall.adapter)
            WebCall.adapter._listener(event);
    }
    
    window.addEventListener("message", listener, false);

    targetWindow.attr("src", iframeLocation);
};

WebCall.EmbeddedAdapter = function(targetWindow, features, getConnectParams, onConfUpdate, onReady) {
    if (this.debug)
        console.log("new WebCall.EmbeddedAdapter()");

    var self = this;

    this._targetWindow = targetWindow;
    this._state        = "disconnected";
    
    this._form         = new Form(Object.keys(app.config.params), "wp_");
    this._optionsForm  = new Form(["autoGainControl", "noiseSuppression", "echoCancellation"], "wo_");
    
    this._settingsDiv = $("#dlgWebCallSettings");

    this._setSupportedFeatures(features);

    this.getConnectParams = getConnectParams;
    this.onConfUpdate     = onConfUpdate;

    $("#dlgWebCallError").dialog({
        autoOpen      : false,
        closeOnEscape : false,
        modal         : true,
        resizable     : false,
        title         : app.localeStrings.lblError,
        width         : 300,
        buttons       : [
            {
                text  : app.localeStrings.lblOK,
                click : function() {
                    $(this).dialog("close");
                }
            }
        ]
    });

    $("#pnlWebCall .button.dtmf")
        .button()
        .click(function(event) {
            var digit;

            var classes = $(this).attr("class").split(/\s+/);
            for (var i in classes) {
                var test = classes[i].match(/^dtmf_(.*)+$/);
                if (test != null)
                    digit = test[1];
            }

            if (digit == "star")
                digit = "*";
            else if (digit == "pound")
                digit = "#";

            self._dtmf(digit);
        });

    $("#dlgWebCallDialpad").dialog({
        autoOpen      : false,
        closeOnEscape : false,
        modal         : true,
        resizable     : false,
        title         : app.localeStrings.lblDtmfKeypad,
        width         : 190,
        buttons       : [
            {
                text  : app.localeStrings.lblClose,
                click : function() {
                    self._sendCommand("closeDialpad", null);
                }
            }
        ]
    });

    $("#dlgWebCallSettings").dialog({
        autoOpen      : false,
        closeOnEscape : false,
        modal         : true,
        resizable     : false,
        title         : app.localeStrings.lblSettings,
        width         : 300,
        buttons       : [
            {
                text  : app.localeStrings.lblOK,
                click : function() {
                    self._sendCommand("saveSettings", {
                        settings : self._getNewSettings(),
                        sourceId : self._getNewSourceId()
                    });
                }
            },
            {
                text  : app.localeStrings.lblCancel,
                click : function() {
                    self._sendCommand("closeSettings", null);
                }
            }
        ]
    });

    $("#pnlWebCall .btnTestSound").click(function(event) {
        event.preventDefault();

        self._sendCommand("playTestSound", null);
    });

    window.onbeforeunload = function () {
        return self._onbeforeunload();
    };

    var saveFieldsCookie = app.cookie.read(app.config.WEBCALL_SAVE_FIELDS_COOKIE_NAME);
    if (saveFieldsCookie) {
        try {
            var saveFieldsObj = $.parseJSON(saveFieldsCookie);
            for (var i in saveFieldsObj) {
                if (app.config.params[i] !== undefined)
                    app.config.params[i] = saveFieldsObj[i];
            }
        } catch (e) {
        }
    }

    this._form.populate(app.config.params);

    onReady(this);
};

WebCall.EmbeddedAdapter.prototype.debug = 1;

WebCall.EmbeddedAdapter.prototype._onbeforeunload = function() {
    if (this._state == "ringing" || this._state == "connected")
        return app.errors.ERR_WEBCALL_NAVIGATE_AWAY;
    
    return;
};

WebCall.EmbeddedAdapter.prototype._sendCommand = function(type, params) {
    this._targetWindow.postMessage({
        type : type,
        params : params
    }, "*");
};

WebCall.EmbeddedAdapter.prototype.connect = function() {
    this._sendCommand("connect", this._getConnectParams());
};

WebCall.EmbeddedAdapter.prototype._getConnectParams = function() {
    return this.getConnectParams.call(this);
};

WebCall.EmbeddedAdapter.prototype._dtmf = function(digit) {
    this._sendCommand("dtmf", { digit : digit} );
};

WebCall.EmbeddedAdapter.prototype._setSupportedFeatures = function(features) {
    if (features.changeSettings) {
        this._settingsDiv.find(".unsupported").hide();
        this._settingsDiv.find(".supported").show();
    } else {
        this._settingsDiv.find(".unsupported").show();
        this._settingsDiv.find(".supported").hide();
    }
};

WebCall.EmbeddedAdapter.prototype._confUpdate = function(data) {
    return this.onConfUpdate.call(this, data);
};

WebCall.EmbeddedAdapter.prototype.displayError = function(errorCode) {
    $("#pnlWebCall iframe").hide();
    $("#pnlWebCall .disconnected").show();
        
    $("#dlgWebCallError .msgError").text(app.errors[errorCode]);
    $("#dlgWebCallError").dialog("open");
}

WebCall.EmbeddedAdapter.prototype.populateSettingsForm = function(settings) {
    this._settingsDiv.find(".dynamic").remove();

    for (var i = 0; i < settings.sources.length; i++) {
        var cur = settings.sources[i];

        this._settingsDiv.find(".insertMarker").append(
            $("<div>")
                .addClass("dynamic")
                .append([
                    $("<input>")
                        .attr("id"       , "rb_" + i + cur.id)
                        .attr("type"     , "radio")
                        .attr("name"     , "micSource")
                        .attr("checked"  , cur.id == settings.currentSourceId)
                        .data("sourceId" , cur.id),
                    $("<label>")
                        .text(cur.label)
                        .attr("for"      , "rb_" + i + cur.id)
                ])
        );
    }

    if (!settings.sources.length)
        this._settingsDiv.find(".sources").hide();

    this._optionsForm.populate(settings.audioOptions);
};

WebCall.EmbeddedAdapter.prototype._getNewSettings = function() {
    return this._optionsForm.getData();    
};

WebCall.EmbeddedAdapter.prototype._getNewSourceId = function() {
    var sourceId =null;
               
    var radio = this._settingsDiv.find(".sources input:checked");
    if (radio.length)
        sourceId = radio.data("sourceId");

    return sourceId;
};

WebCall.EmbeddedAdapter.prototype._listener = function(event) {
    switch (event.data.type) {
    case "ringing":
    case "connected":
        this._state = event.data.type;
        
        $("#pnlWebCall .disconnected").hide();
        $("#pnlWebCall iframe").show();
        break;
        
    case "disconnected":
        this._state = event.data.type;
        
        this._sendCommand("closeDialpad", null);
        
        $("#pnlWebCall iframe").hide();
        $("#pnlWebCall .disconnected").show();
        break;

    case "openDialpad":
        $("#dlgWebCallDialpad").dialog("open");
        break;

    case "closeDialpad":
        $("#dlgWebCallDialpad").dialog("close");
        break;

    case "openSettings":
        $("#dlgWebCallSettings").dialog("open");
        break;

    case "closeSettings":
        $("#dlgWebCallSettings").dialog("close");
        break;

    case "populateSettingsForm":
        this.populateSettingsForm(event.data.params);
        break;

    case "confUpdate":
        this._confUpdate(event.data);
        
        break;

    case "displayError":
        this._state = "disconnected";
        
        this.displayError(event.data.params.errorCode);
        break;
    }
};
