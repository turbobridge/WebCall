"use strict";

if (!window.webCall) window.webCall = {};

WebCall.UI = function(options) {
    this.debug = 1;
    
    if (this.debug)
        console.log("new WebCall.UI()");

    this._getConnectParams = options.getConnectParams;

    this._settingsOpen = false;
    this._optionsForm  = new Form(["autoGainControl", "noiseSuppression", "echoCancellation"], "wo_");
    this._validSources = [];
    this._settingsDiv  = options.settingsDiv || $("#pnlWebCall .pnlSettings");

    this._dialpadOpen = false;

    this._timerID  = null;
    this._timerVal = 0;

    this._muted = false;

    this._eventHandlers = {
        toggleMute : this.toggleMute,
        toggleHold : this.toggleHold
    };

    for (var i in options.eventHandlers)
        this._eventHandlers[i] = options.eventHandlers[i];

    var self = this;

    var eventHandlers = {
        connected : function(e) {
            self._setState("connected");
        },

        disconnected : function(e) {
            self._setState("disconnected");
        },

        ringing : function(e) {
            self._setState("ringing");
        },

        error : function(e) {
            var errorCode = e.code;
            
            if (e.data && e.data.message) {
                var message = e.data.message;
                if (message.data)
                    $("#pnlWebCall .connectFailureMessage").text(message.data);

                if (message.status_code && app.errors["ERR_WEBCALL_STATUS_" + message.status_code])
                    errorCode = "ERR_WEBCALL_STATUS_" + message.status_code;
            }

            self._setState("error", errorCode);
        },
    
        preconnect : function(e) {
            self._reset();
        }
    };

    this.client = new WebCall.Client({
        eventHandlers : eventHandlers
    });

    this.features = this.client.getSupportedFeatures();

    if (this.features.changeSettings) {
        this._settingsDiv.find(".unsupported").hide();
        this._settingsDiv.find(".supported").show();
    } else {
        this._settingsDiv.find(".unsupported").show();
        this._settingsDiv.find(".supported").hide();
    }

    this._setupEvents();
    this._drawLoop();

    this.form = new Form(Object.keys(app.config.params), "wp_");

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

    this.form.populate(app.config.params);

    // set initial state
    this._setState("disconnected");
};

WebCall.UI.prototype.connect = function() {
    if (this.debug)
        console.log("WebCall:UI.connect()");

    var connectData = this._getConnectParams();

    if (typeof connectData === "string") {
        this._setState("error", connectData);
        return;
    }

    this.client.connect(connectData);
};

WebCall.UI.prototype._reset = function() {
    if (this.debug)
        console.log("WebCall:UI._reset()");

    this._muted = false;
    this._setMuteHoldDisplay();
};

WebCall.UI.prototype._setState = function(state, errorCode) {
    if (this.debug)
        console.log("WebCall:UI._setState(" + state + ")");

    $("#pnlWebCall .disconnected, #pnlWebCall .connected, #pnlWebCall .error, #pnlWebCall .btnDisconnect").hide();
    $("#pnlWebCall .ringing, #pnlWebCall .timer").hide();

    if (this.client && this.client.isMicConnected()) {
        $("#pnlWebCall .micConnected").show();
        $("#pnlWebCall .micDisconnected").hide();
    } else {
        $("#pnlWebCall .micConnected").hide();
        $("#pnlWebCall .micDisconnected").show();
    }

    this.state = state;

    switch (state) {
    case "connected":
        this._startTimer();

        $("#pnlWebCall .connected, #pnlWebCall .timer").show();
        $("#pnlWebCall .btnDisconnect").show();

        this._setMuteHoldDisplay();

        break;

    case "ringing":
        $("#pnlWebCall .connected").show();
        $("#pnlWebCall .ringing").show();
        $("#pnlWebCall .btnDisconnect").show();

        break;

    case "disconnected":
        this._stopTimer();

        $("#pnlWebCall .disconnected").show();

        break;

    case "error":
        $("#pnlWebCall .msgError div").text(app.errors[errorCode]);
        $("#pnlWebCall .error").show();

        break;
    }
};

WebCall.UI.prototype.toggleMute = function() {
    if (this.debug)
        console.log("WebCall:UI.toggleMute()", this);

    if (this.client.getHold()) {
        this._muted = !this._muted;
    } else {
        var muted = this.client.getMute();
        
        this.client.setMute(!muted);
        this._muted = !muted;
    }
    
    this._setMuteHoldDisplay();
};

WebCall.UI.prototype.toggleHold = function() {
    if (this.debug)
        console.log("WebCall:UI.toggleHold()");
    
    var hold = this.client.getHold();

    if (!hold) { // not already on hold
        this.client.setMute(true);
    } else {
        this.client.setMute(this._muted);
    }

    this.client.setHold(!hold);

    this._setMuteHoldDisplay();
};

WebCall.UI.prototype._setMuteHoldDisplay = function() {
    if (this.debug)
        console.log("WebCall:UI._setMuteHoldDisplay()");

    var hold  = this.client.getHold();
    var muted = this._muted;

    // set button states

    if (hold) {
        $("#pnlWebCall .btnHold").addClass("ui-state-error");
    } else {
        $("#pnlWebCall .btnHold").removeClass("ui-state-error");
    }

    if (muted) {
        $("#pnlWebCall .btnMute").addClass("ui-state-error");
    } else {
        $("#pnlWebCall .btnMute").removeClass("ui-state-error");
    }

    // set meter and label states

    $("#pnlWebCall .muted, #pnlWebCall .hold").hide();
    if (hold || muted)
        $("#pnlWebCall .divInputMeter").hide();
    else
        $("#pnlWebCall .divInputMeter").show();

    if (hold) {
        $("#pnlWebCall .hold").show();
    } else if (muted) {
        $("#pnlWebCall .muted").show();
    }
};

WebCall.UI.prototype._drawLoop = function(time) {
    var self = this;

    var volume = this.client.getInputVolume();
    var width = $("#pnlWebCall .ctlInputMeter").width();
    var newWidth;

    if (this.state == "ringing" || this.state == "connected")
        newWidth = Math.floor(volume * width * 1.4);
    else
        newWidth = 0;

    $("#pnlWebCall .ctlInputMeter div.meter").css({
        "width" : newWidth + "px"
    });

    this.rafID = window.requestAnimationFrame(function(time) { self._drawLoop(time) });
};

WebCall.UI.prototype.openSettings = function() {
    var self = this;

    if (this.features.changeSettings) {
        this.client.getSources(function(sources) { self.getSourcesSuccess(sources); });
    } else {
        this._openSettings();
    }
};

WebCall.UI.prototype._openSettings = function() {
    this._settingsOpen = true;

    $("#pnlWebCall .connected").hide();
    $("#pnlWebCall .pnlSettings").show();
};

WebCall.UI.prototype.closeSettings = function() {
    if (this.features.changeSettings) {
        var data = this._optionsForm.getData();
        console.log(data);
        var sourceId = null;
               
        if (this._validSources.length) {
            var radio = this._settingsDiv.find(".sources input:checked");
            if (radio.length)
                sourceId = radio.data("sourceId");
        }

        this.client.setAudioOptions(data);
        this.client.setAudioSourceId(sourceId);
        this.client.getUserMedia();
    }
    
    this._closeSettings();
};

WebCall.UI.prototype._closeSettings = function() {
    this._settingsOpen = false;

    $("#pnlWebCall .pnlSettings").hide();
    $("#pnlWebCall .connected").show();
};

WebCall.UI.prototype.getSourcesSuccess = function(sources) {
    this._validSources = [];

    for (var i = 0; i < sources.length; i++) {
        var cur = sources[i];

        if (cur.kind == "audio" && cur.label.length > 0)
            this._validSources.push(cur);
    }

    var currentSourceId = this.client.getAudioSourceId();

    this._settingsDiv.find(".dynamic").remove();

    for (var i = 0; i < this._validSources.length; i++) {
        var cur = this._validSources[i];

        this._settingsDiv.find(".insertMarker").append(
            $("<div>")
                .addClass("dynamic")
                .append([
                    $("<input>")
                        .attr("id"       , "rb_" + i + cur.id)
                        .attr("type"     , "radio")
                        .attr("name"     , "micSource")
                        .attr("checked"  , cur.id == currentSourceId)
                        .data("sourceId" , cur.id),
                    $("<label>")
                        .text(cur.label)
                        .attr("for"      , "rb_" + i + cur.id)
                ])
        );
    }

    if (!this._validSources.length)
        this._settingsDiv.find(".sources").hide();

    this._optionsForm.populate(this.client.getAudioOptions());

    this._openSettings();
};

WebCall.UI.prototype._startTimer = function() {
    this._timerVal = 0;
    this._updateTimer();

    var self = this;

    this._timerID = setInterval(function() {
        self._timerVal++;
        self._updateTimer();
    }, 1000);
};

WebCall.UI.prototype._stopTimer = function() {
    $("#pnlWebCall .timer").text("");

    if (this._timerID)
        clearInterval(this._timerID);

    this._timerID = null;
    this._timerVal = 0;
};

WebCall.UI.prototype.toggleDialpad = function() {
    if (this._dialpadOpen) {
        this.closeDialpad();
    } else {
        this.openDialpad();
    }
};

WebCall.UI.prototype.openDialpad = function() {
    this._dialpadOpen = true;
    
    $("#pnlWebCall .btnOpenDialpad").addClass("ui-state-error");
    $("#pnlWebCall .divDialpad").slideDown();
};

WebCall.UI.prototype.closeDialpad = function() {
    this._dialpadOpen = false;
    
    $("#pnlWebCall .btnOpenDialpad").removeClass("ui-state-error");
    $("#pnlWebCall .divDialpad").slideUp();
};

WebCall.UI.prototype._updateTimer = function() {
    $("#pnlWebCall .timer").text(this._formatDuration(this._timerVal, true));
};

WebCall.UI.prototype._formatDuration = function(secs, displaySeconds) {
    var hours = Math.floor(secs / 3600);
    var mins = Math.floor(secs / 60) - hours * 60;
    var seconds = secs - (hours * 3600 + mins * 60);

    if (hours < 10)
        hours = "0" + hours;

    if (mins < 10)
        mins = "0" + mins;

    if (seconds < 10)
        seconds = "0" + seconds;

    if (displaySeconds)
        return hours + ":" + mins + ":" + seconds;
    else
        return hours + ":" + mins;
};

WebCall.UI.prototype._setupEvents = function() {
    // initialize UI elements
    $("#pnlWebCall .button").button();

    $("#pnlWebCall .ctlInputMeter").append(
        $("<div>")
            .addClass("meter")
            .css("height", $("#pnlWebCall .ctlInputMeter").height())
    );

    // setup events

    var self = this;

    $("#pnlWebCall .btnConnect").click(function(event) {
        $(this).blur();
        
        self.connect();
    });

    $("#pnlWebCall .btnDisconnect").click(function(event) {
        $(this).blur();

        if (self.state == "connected" || self.state == "ringing")
            self.client.endCall();
    });

    $("#pnlWebCall .error .btnClose").click(function(event) {
        $(this).blur();
        
        self._setState("disconnected");
    });

    $("#pnlWebCall .pnlSettings .btnClose").click(function(event) {
        $(this).blur();

        if (self.state == "connected" && self._settingsOpen)
            self.closeSettings();
    });

    $("#pnlWebCall .btnMute").click(function(event) {
        self._emitEvent("toggleMute");
    });

    $("#pnlWebCall .btnHold").click(function(event) {
        self._emitEvent("toggleHold");
    });

    $("#pnlWebCall .button.dtmf").click(this.client, function(event) {
        var digit;
        var elem = $("#pnlWebCall .audDtmf").get(0);

        elem.pause();
        elem.currentTime = 0;
        elem.play();

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

        event.data.sendDTMF(digit);
    });

    $("#pnlWebCall .btnTestSound").click(function(event) {
        event.preventDefault();
        
        $(".audTestSound").get(0).play();
    });

    $("#pnlWebCall .btnSettings").click(this, function(event) {
        event.data.openSettings();
    });

    window.onbeforeunload = function() {
        if (self.state == "ringing" || self.state == "connected")
            return app.errors.ERR_WEBCALL_NAVIGATE_AWAY;

        return;
    };
};

/* event stuff */

WebCall.UI.prototype._emitEvent = function(eventName, event) {
    if (this.debug)
        console.log("WebCall:UI._emitEvent(" + eventName + ")", this);

    if (this._eventHandlers[eventName])
        this._eventHandlers[eventName].call(this, event);
};
