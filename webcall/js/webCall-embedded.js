"use strict";

$(document).ready(function() {
    var debug = true;

    var _newSettings = null, _newSourceId = null;

    var parentLocation = document.referrer;

    function sendEvent(type, params) {
        var msg = {
            type : type
        };

        if (params)
            msg.params = params;
        
        window.parent.postMessage(msg, "*");
    }
    
    var confUI = new WebCall.ConfUI({
        setMuteLockedDisplay : function(flag) {
            if (flag) {
                $("#pnlWebCall .btnMute").enableIconButton(false);
            } else {
                $("#pnlWebCall .btnMute").enableIconButton(true);
            }
        }
    });

    confUI.setHost = function() {};

    confUI.ui.client.on("disconnected", function() {
        sendEvent("disconnected");
    });

    confUI.ui.client.on("ringing", function() {
        sendEvent("ringing");
    });

    confUI.ui.client.on("connected", function() {
        sendEvent("connected");
    });

    confUI.ui.openDialpad = function() {
        this._dialpadOpen = true;

        sendEvent("openDialpad");
    };
    
    confUI.ui.closeDialpad = function() {
        this._dialpadOpen = false;
        
        sendEvent("closeDialpad");
    };

    confUI._update = function() {
        if (this.debug)
            console.log("WebCall:ConfUI._update()");

        var callID = null;
        if (this.confLib.status && this.confLib.status.data && this.confLib.status.data.callID)
            callID = this.confLib.status.data.callID;

        sendEvent("confUpdate", {
            callID : callID
        });
        
        this._updateDisplay();
    };

    confUI.ui._openSettings = function() {
        this._settingsOpen = true;
        
        sendEvent("openSettings");
    };

    confUI.ui.closeSettings = function() {
        this._settingsOpen = false;

        sendEvent("closeSettings");
    };

    confUI.ui.populateSettingsForm = function() {
        sendEvent("populateSettingsForm", {
            currentSourceId : this.client.getAudioSourceId(),
            sources         : this._validSources,
            audioOptions    : this.client.getAudioOptions()
        });
    };

    confUI.ui._getNewSettings = function() {
        return _newSettings;
    };

    confUI.ui._getNewSourceId = function() {
        return _newSourceId;
    };

    confUI.ui.displayError = function(errorCode) {
        sendEvent("displayError", {
            errorCode : errorCode
        });
    };

    confUI.ui._onbeforeunload = function() {};

    function listener(event) {
        if (debug)
            console.log("WebCall:ConfEmbedded.listener()", event);

        if (parentLocation.indexOf(event.origin) !== 0)
            return;
        
        if (!event.data || !event.data.type)
            return;

        if (debug)
            console.log("WebCall:ConfEmbedded.listener event " + event.data.type);

        switch (event.data.type) {
        case "connect":
            confUI.ui.connect(event.data.params);
            break;

        case "closeDialpad":
            confUI.ui.closeDialpad();
            break;

        case "cancelSettings":
            confUI.ui.closeSettings();
            break;

        case "dtmf":
            confUI.ui.dtmf(event.data.params.digit);
            break;

        case "saveSettings":
            _newSettings = event.data.params.settings;
            _newSourceId = event.data.params.sourceId;
            
            confUI.ui.saveSettings();
            break;

        case "closeSettings":
            confUI.ui.closeSettings();
            break;

        case "playTestSound":
            confUI.ui.playTestSound();
            break;
        }
    }
    
    window.addEventListener("message", listener, false);

    sendEvent("init", confUI.ui.client.getSupportedFeatures());
});
