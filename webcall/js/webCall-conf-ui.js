"use strict";

if (!window.WebCall) window.WebCall = {};

WebCall.ConfUI = function(options) {
    this.debug = 1;
    
    if (this.debug)
        console.log("new WebCall.ConfUI()");

    this._getConnectParams = options.getConnectParams;
    
    if (options.setMuteLockedDisplay)
        this.setMuteLockedDisplay = options.setMuteLockedDisplay;
    if (options.setHostDisplay)
        this.setHostDisplay = options.setHostDisplay;
    if (options.setConfModeDisplay)
        this.setConfModeDisplay = options.setConfModeDisplay;

    this.statusMap = {
        "pending" : app.localeStrings.lblPending,
        "running" : app.localeStrings.lblActive
    };

    this._confModeMap = {
        "qa"           : app.localeStrings.lblQuestionAnswer,
        "conversation" : app.localeStrings.lblConversation,
        "presentation" : app.localeStrings.lblPresenation,
        "hostsOnly"    : app.localeStrings.lblHostsOnly
    };

    this._inputDialogOpen     = false;
    this._host                = false;
    this._muteLocked          = false;
    this._status              = "pending";
    this._ctlOutputGainActive = false;
    this._confStartMode       = "instant";

    this._callStatus          = null;
    
    this._commands = {
        changeRole : {
            desc : "changeRole (pin)",
            host : false
        },
        setInGain : {
            desc : "setInGain (default: 0)",
            host : false
        },
        setOutGain : {
            desc : "setOutGain (default: 0)",
            host : false
        },
        adjustInGain : {
            desc : "adjustInGain (positive value to increase, negative to decrease)",
            host : false
        },
        adjustOutGain : {
            desc : "adjustOutGain (positive value to increase, negative to decrease)",
            host : false
        },
        moh : {
            desc : "moh (default: toggle)",
            host : true
        },
        mute : {
            desc : "mute (default: toggle)",
            host : false
        },
        raiseHand : {
            desc : "raiseHand (default: toggle)",
            host : false
        },
        lock : {
            desc : "lock (default: toggle)",
            host : true
        },
        callRecording : {
            desc : "callRecording (values: 0 - stop, 1 - start, 2 - pause; default: toggle)",
            host : true
        },
        confMode : {
            desc : "confMode (prev, presentation, conversation, qa, hostsOnly)",
            host : true
        },
        enterMode : {
            desc : "enterMode (chime, name, none, default)",
            host : true
        },
        exitMode : {
            desc : "exitMode (chime, name, none, default)",
            host : true
        },
        enterExitMode : {
            desc : "enterExitMode (chime, name, none, default)",
            host : true
        },
        help : {
            desc : "help (no value)",
            host : false
        },
        hostConfirm : {
            desc : "hostConfirm (no value)",
            host : true
        },
        startConference : {
            desc : "startConference (no value)",
            host : true
        },
        endConference : {
            desc : "endConference (no value)",
            host : true
        },
        noop : {
            desc : "noop (no value)",
            host : false
        },
        rollCall : {
            desc : "rollCall (no value)",
            host : false
        }
    };

    var self = this;

    var uiOptions = {
        getConnectParams : this._getConnectParams,
        eventHandlers : {
            toggleMute : function() { self.toggleMute(); },
            toggleHold : function() { self.toggleHold(); }
        }
    };

    if (options.settingsDiv)
        uiOptions.settingsDiv = options.settingsDiv;
    
    this.ui = new WebCall.UI(uiOptions);

    this.ui.client.on("preconnect", function(e) { self._reset() });

    this.confLib = new WebCall.ConfLib({
        client : this.ui.client,
        eventHandlers : {
            update       : function(event) { self._update(event); },
            disconnected : function(event) { self._disconnected(event); }
        }
    });

    this._setupEvents();
    this._setupTooltips();

    this._reset();
};

WebCall.ConfUI.prototype._setupEvents = function() {
    var self = this;

    $("#pnlWebCall .ctlOutputGain")
        .slider({
            min  : app.config.WEBCALL_MIN_GAIN,
            max  : app.config.WEBCALL_MAX_GAIN,
            step : 1,
            slide : function(event, ui) {
                if (event.originalEvent) // don't trigger event if the slider value was changed programatically
                    self._outGainChanged(ui.value);
            },
            start : function(event, ui) {
                self._ctlOutputGainActive = true;
            },
            stop : function(event, ui) {
                self._ctlOutputGainActive = false;
            }
        })
        .removeClass("ui-corner-all");

    $("#pnlWebCall .btnHand").click(function(event) {
        self.toggleHandRaised();
    });

    $("#pnlWebCall .btnMusic").click(function(event) {
        self.toggleMusicOnHold();
    });

    $("#pnlWebCall .btnLock").click(function(event) {
        self.toggleLocked();
    });

    $("#pnlWebCall .btnStartConference").click(function(event) {
        self.confLib.startConference();
    });

    $("#pnlWebCall .btnRecordName").click(function(event) {
        self.ui.client.sendDTMF("#");
    });
    
    $("#pnlWebCall .btnRecording").click(function(event) {
        self.toggleRecording();
    });

    if ($("#pnlWebCall .confMode").length)
        $("#pnlWebCall .confMode").dropdown({
            select         : function(event, ui) {
                if (!event.currentTarget)
                    return;
                
                self._confModeChanged(ui.item.value);
            }
        });

    $("#pnlWebCall .btnSendCommand").click(function(event) {
        var command = $("#pnlWebCall .sendCommand .commandName").val();
        var value   = $("#pnlWebCall .sendCommand .commandValue").val();
        
        self.confLib._sendCommand(command, value);
    });

    $("#pnlWebCall .btnOpenDialpad").click(function(event) {
        self.ui.toggleDialpad();
    });

    $("#pnlWebCall .btnChangeRole").click(function(event) {
        if (self._host)
            self._openInputDialog("endConference");
        else
            self._openInputDialog("changeRole");
    });

    $("#pnlWebCall .pnlInputDialog input").keypress(function(event) {
        if (event.which == 13) {
            $("#pnlWebCall .btnInputSubmit").click();
        }
    });

    $("#pnlWebCall .btnInputSubmit").click(function(event) {
        if (self._inputDialogType == "changeRole") {
            self.confLib.changeRole($("#pnlWebCall .txtPin").val());
        } else {
            self.confLib.endConference();
        }
        self._closeInputDialog();
    });

    $("#pnlWebCall .btnInputCancel").click(function(event) {
        self._closeInputDialog();
    });
};

WebCall.ConfUI.prototype._setupTooltips = function() {
    // no tooltips for mobile browsers
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
        return;

    $(document).tooltip({
        items    : "#pnlWebCall .button, #pnlWebCall .btnImg",
        show     : {
            delay : 800
        },
        content : function() {
            if ($(this).hasClass("ui-state-error") && $(this).find(".tooltipOn").length)
                return $(this).find(".tooltipOn").text();

            return $(this).find(".tooltip").text();
        }
    });
};

WebCall.ConfUI.prototype.toggleMute = function() {
    if (this.debug)
        console.log("WebCall:ConfUI.toggleMute()");

    if (this.ui.client.getHold())
        this.ui.toggleMute();
    else
        this.confLib.toggleMute();
};

WebCall.ConfUI.prototype.toggleHold = function() {
    if (this.debug)
        console.log("WebCall:ConfUI.toggleHold()");

    this.ui.toggleHold();

    if (this.ui._muted) {
        this.confLib.setMute(true);
    }
    
    this._update();
};

WebCall.ConfUI.prototype.toggleHandRaised = function() {
    if (this.debug)
        console.log("WebCall:ConfUI.toggleHandRaised()");

    this.confLib.toggleHandRaised();
};

WebCall.ConfUI.prototype.toggleMusicOnHold = function() {
    if (this.debug)
        console.log("WebCall:ConfUI.toggleMusicOnHold()");

    this.confLib.toggleMusicOnHold();
};

WebCall.ConfUI.prototype.toggleLocked = function() {
    if (this.debug)
        console.log("WebCall:ConfUI.toggleLocked()");

    this.confLib.toggleLocked();
};

WebCall.ConfUI.prototype.toggleRecording = function() {
    if (this.debug)
        console.log("WebCall:ConfUI.toggleRecording()");

    this.confLib.toggleRecording();
};

WebCall.ConfUI.prototype._hashChange = function() {
    if (this.debug)
        console.log("WebCall:ConfUI._hashChange()");

    this._parseHash();

    this.ui.form.populate(app.config.params);
        
    if (app.config.params.debug) {
        $("#pnlWebCall .frmDebug").show();
        
        this._updateDebug();
    }
};

WebCall.ConfUI.prototype._outGainChanged = function(value) {
    if (this.debug)
        console.log("WebCall:ConfUI._outGainChanged()", value);

    this.confLib.setOutGain(value);
};

WebCall.ConfUI.prototype._confModeChanged = function(value) {
    if (this.debug)
        console.log("WebCall:ConfUI._confModeChanged()", value);

    this.confLib.setConfMode(value);
};

WebCall.ConfUI.prototype._disconnected = function() {
    $("#pnlWebCall .debug").hide();
    this._clear();
    this._closeInputDialog();
};

WebCall.ConfUI.prototype._openInputDialog = function(type) {
    if (this.debug)
        console.log("WebCall:ConfUI._openInputDialog()");

    this._inputDialogOpen = true;
    this._inputDialogType = type;

    if (type == "changeRole") {
        $("#pnlWebCall .divPin").show();
        $("#pnlWebCall .divEndConference").hide();
    } else {
        $("#pnlWebCall .divPin").hide();
        $("#pnlWebCall .divEndConference").show();        
    }

    $("#pnlWebCall .txtPin").val("");
    $("#pnlWebCall .connected").hide();
    $("#pnlWebCall .pnlInputDialog").show();
    $("#pnlWebCall .pnlInputDialog input").focus();
};

WebCall.ConfUI.prototype._closeInputDialog = function() {
    if (this.debug)
        console.log("WebCall:ConfUI._closeInputDialog()");

    this._inputDialogOpen = false;

    if (this.ui.client.getState() == "connected")
        $("#pnlWebCall .connected").show();
    
    $("#pnlWebCall .pnlInputDialog").hide();
};

/* UI updates */

WebCall.ConfUI.prototype._update = function() {
    if (this.debug)
        console.log("WebCall:ConfUI._update()");

    this._updateDisplay();
};

    
WebCall.ConfUI.prototype._updateDisplay = function() {
    if (this.debug)
        console.log("WebCall:ConfUI._updateDisplay()");
    
    this._updateDebug();

    /* update UI */
    var newGain = this.confLib.getOutGain();
    if (this.getOutGain() != newGain) {
        this.setOutGain(newGain);
    }

    var newConfMode = this.confLib.getConfMode();
    if (this.getConfMode() != newConfMode) {
        this.setConfMode(newConfMode);
    }

    var newHost = this.confLib.getHost();
    if (this.getHost() != newHost) {
        this.setHost(newHost);
    }

    var newMuteLocked = this.confLib.getMuteLocked();
    if (this.getMuteLocked() != newMuteLocked) {
        this.setMuteLocked(newMuteLocked);
    }

    var newCallStatus = this.confLib.getCallStatus();
    if (this.getCallStatus() != newCallStatus) {
        this.setCallStatus(newCallStatus);
    }

    var newStatus = this.confLib.getConfStatus();
    var newConfStartMode = this.confLib.getConfStartMode();
    if (this._confStartMode != newConfStartMode) {
        this._confStartMode = newConfStartMode;
        this.setStatus(newStatus);
    }

    if (this.getStatus() != newStatus) {
        this.setStatus(newStatus);
    }

    if (this.confLib.getLocked()) {
        $("#pnlWebCall .btnLock").addClass("locked ui-state-error");
    } else {
        $("#pnlWebCall .btnLock").removeClass("locked ui-state-error");
    }

    if (this.confLib.getRecording() == 1) {
        $("#pnlWebCall .btnRecording").addClass("ui-state-error");
    } else {
        $("#pnlWebCall .btnRecording").removeClass("ui-state-error");
    }

    if (this.confLib.getHandRaised())
        $("#pnlWebCall .btnHand").addClass("ui-state-error");
    else
        $("#pnlWebCall .btnHand").removeClass("ui-state-error");

    if (this.confLib.getMusicOnHold() && this._status != "running")
        $("#pnlWebCall .btnMusic").addClass("ui-state-error");
    else
        $("#pnlWebCall .btnMusic").removeClass("ui-state-error");
    
    this.ui._muted = this.confLib.getMute();
    this.ui._setMuteHoldDisplay();
};

WebCall.ConfUI.prototype._updateDebug = function() {
    if (this.debug)
        console.log("WebCall:ConfUI._updateDebug()");

    var state = this.ui.client.getState()
    if (!state || state == "disconnected")
        return;

    if (app.config.params.debug)
        $("#pnlWebCall .debug").show();
    
    this._clear();

    if (this.confLib.status && this.confLib.status.data) {
        for (var i in this.confLib.status.data) {
            $("#pnlWebCall .debug table").append(
                $("<tr>")
                    .append([
                        $("<td>")
                            .text(i),
                        $("<td>")
                            .text(this.confLib.status.data[i])
                    ])
            );
        }
    }
    
    $("#pnlWebCall .debug table").append([
        $("<tr>")
            .append([
                $("<td>")
                    .text("Client Mute"),
                $("<td>")
                    .text(this.confLib.client.getMute())
            ]),
        $("<tr>")
            .append([
                $("<td>")
                    .text("Client Hold"),
                $("<td>")
                    .text(this.confLib.client.getHold())
            ])
    ]);
};

WebCall.ConfUI.prototype._reset = function() {
    if (this.debug)
        console.log("WebCall:ConfUI._reset()");

    this._confStartMode = "instant";
    
    this.setHost(false);
    this.setConfMode("conversation");
    this.setMuteLocked(false);
    this.setCallStatus(null);
    this.setStatus("pending");

    this.ui.closeDialpad();

    this._ctlOutputGainActive = false;
    this.setOutGain(0);
};

WebCall.ConfUI.prototype._clear = function() {
    $("#pnlWebCall .debug table tr").remove();
};

/* getters/setters */

WebCall.ConfUI.prototype.getOutGain = function() {
    return $("#pnlWebCall .ctlOutputGain").slider("value");
};

WebCall.ConfUI.prototype.setOutGain = function(value) {
    if (!this._ctlOutputGainActive)
        $("#pnlWebCall .ctlOutputGain").slider("value", value);
};

WebCall.ConfUI.prototype.getHost = function() {
    return this._host;
};

WebCall.ConfUI.prototype.getStatus = function() {
    return this._status;
};

WebCall.ConfUI.prototype.getCallStatus = function() {
    return this._callStatus;
};

WebCall.ConfUI.prototype.setHost = function(flag) {
    if (this.debug)
        console.log("WebCall:ConfUI.setHost(" + flag + ")");

    this._host = flag;

    if (this.setHostDisplay)
        this.setHostDisplay(flag);

    // refresh status
    
    this.setStatus(this._status);

    // update commandList
    
    var selected = $("#pnlWebCall .sendCommand .commandName").val();

    $("#pnlWebCall .sendCommand .commandName option").remove();

    for (var i in this._commands) {
        var cur = this._commands[i];
        if (cur.host && !flag)
            continue;

        var option = $("<option>")
            .attr("value", i)
            .text(this._commands[i].desc);

        if (i === selected)
            option.attr("selected", "selected");
        
        $("#pnlWebCall .sendCommand .commandName").append(option);
    }
};

WebCall.ConfUI.prototype.setStatus = function(status) {
    if (this.debug)
        console.log("WebCall:ConfUI.setStatus(" + status + ")");

    this._status = status;
    
    var statusLabel;
    if (this.statusMap[status])
        statusLabel = this.statusMap[status];
    else
        statusLabel = status;

    if (this._host)
        statusLabel = app.localeStrings.lblHost + " " + statusLabel;
    
    $("#pnlWebCall .confStatus").text(statusLabel);

    $("#pnlWebCall .confStatus, #pnlWebCall .btnStartConference").hide();
    
    if (status == "pending") {
        var start = this.confLib.getConfStartMode();
        if (this._host && start && start.toLowerCase() == "hostconfirms" && this.getCallStatus() != "recordName") {
            $("#pnlWebCall .btnStartConference").show();
        } else {
            $("#pnlWebCall .confStatus").show();
        }
    } else {
        $("#pnlWebCall .confStatus").show();
    }
};

WebCall.ConfUI.prototype.setCallStatus = function(status) {
    if (this.debug)
        console.log("WebCall:ConfUI.setCallStatus(" + status + ")");

    this._callStatus = status;

    $("#pnlWebCall .btnRecordName").hide();
    
    if (status == "recordName")
        $("#pnlWebCall .btnRecordName").show();        
};

WebCall.ConfUI.prototype.getMuteLocked = function() {
    return this._muteLocked;
};

WebCall.ConfUI.prototype.setMuteLocked = function(value) {
    if (this.debug)
        console.log("WebCall:ConfUI.setMuteLocked(" + value + ")");

    this._muteLocked = value;

    if (this.setMuteLockedDisplay)
        this.setMuteLockedDisplay(this._muteLocked);
};

WebCall.ConfUI.prototype.getConfMode = function() {
    return this._confMode;
};

WebCall.ConfUI.prototype.setConfMode = function(value) {
    if (this.debug)
        console.log("WebCall:ConfUI.setConfMode(" + value + ")");

    this._confMode = value;

    if (this.setConfModeDisplay)
        this.setConfModeDisplay(value);
};

/* handle hash argument parsing */

WebCall.ConfUI.prototype._parseHash = function() {
    var hashParams = window.location.hash.substr(1).parseQueryString();
    var params = {};
    
    for (var i in hashParams)
        params[i.toLowerCase()] = hashParams[i];
    
    if (params.id)
        app.config.params.conferenceID = params.id;
    
    if (params.name)
        app.config.params.fromName = params.name;
    
    if (params.email)
        app.config.params.email = params.email;

    if (params.debug)
        app.config.params.debug = params.debug;
};
