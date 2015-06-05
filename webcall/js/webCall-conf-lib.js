"use strict";

if (!window.webCall) window.webCall = {};

WebCall.ConfLib = function(options) {
    this.debug = 1;

    this.intAttributes = [ "host", "muted", "hold", "handRaised", "inGain", "outGain", "confLocked", "muteLocked", "recordCall", "musicOnHold" ];
    this.boolAttributes = [ "host", "muted", "hold", "confLocked", "muteLocked", "musicOnHold" ];
    
    if (this.debug)
        console.log("new WebCall.ConfLib()");

    this._eventHandlers = {
        update : null,
        disconnected : null
    };

    for (var i in options.eventHandlers)
        this._eventHandlers[i] = options.eventHandlers[i];
    
    this.client = options.client;

    this.status = {
        data    : null
    };

    this._setupEvents();
};

WebCall.ConfLib.prototype._setupEvents = function() {
    var self = this;
    
    this.client.on("newMessage", function(e) { self._newMessage(e) });
    this.client.on("disconnected", function(e) { self._disconnected(e) });
};

WebCall.ConfLib.prototype._newMessage = function(e) {
    if (this.debug)
        console.log("WebCall:ConfLib._newMessage()", e);
    
    if (e.originator == "remote" && e.message && e.message.content_type.toLowerCase() == "application/json") {
        this.status.data    = null;

        // attempt to parse response
        try {
            this.status.data    = $.parseJSON(e.message.content);
        } catch (error) {
            if (this.debug)
                console.log("WebCall:ConfLib._newMessage() error parsing response JSON", error);
        }

        if (this.status.data)
            this._update();
    }
};

WebCall.ConfLib.prototype._update = function() {
    if (this.debug)
        console.log("WebCall:ConfLib._update()");

    // sanitize

    for (var i in this.intAttributes) {
        var name = this.intAttributes[i];
        if (this.status.data[name] === undefined)
            this.status.data[name] = 0;
        else
            this.status.data[name] = parseInt(this.status.data[name]);

        if ($.inArray(name, this.boolAttributes) >= 0)
            this.status.data[name] = !!this.status.data[name];
    }

    app.webCallLastCallID = this.status.data.callID;

    var muted = this.getMute();
    if (muted != this.client.getMute())
        this.client.setMute(muted);

    this._emitEvent("update", {
        data    : this.status.data
    });
};

WebCall.ConfLib.prototype._disconnected = function() {
    this._emitEvent("disconnected");
};

/* getters */

WebCall.ConfLib.prototype.getOutGain = function() {
    if (this.status && this.status.data)
        return  this.status.data.outGain;

    return 0;
};

WebCall.ConfLib.prototype.getHost = function() {
    if (this.status && this.status.data)
        return  this.status.data.host;

    return false;
};

WebCall.ConfLib.prototype.getMute = function() {
    if (this.status && this.status.data)
        return  this.status.data.muted;

    return false;
};

WebCall.ConfLib.prototype.getHandRaised = function() {
    if (this.status && this.status.data)
        return  this.status.data.handRaised;

    return false;
};

WebCall.ConfLib.prototype.getLocked = function() {
    if (this.status && this.status.data)
        return  this.status.data.confLocked;

    return false;
};

WebCall.ConfLib.prototype.getRecording = function() {
    if (this.status && this.status.data)
        return  this.status.data.recordCall;

    return 0;
};

WebCall.ConfLib.prototype.getConfStatus = function() {
    if (this.status && this.status.data)
        return  this.status.data.confStatus;

    return "pending";
};

WebCall.ConfLib.prototype.getConfMode = function() {
    if (this.status && this.status.data)
        return  this.status.data.confMode;

    return "conversation";
};

WebCall.ConfLib.prototype.getConfStartMode = function() {
    if (this.status && this.status.data)
        return  this.status.data.confStart;

    return "instant";
};

WebCall.ConfLib.prototype.getMuteLocked = function() {
    if (this.status && this.status.data)
        return  this.status.data.muteLocked;

    return false;
};

WebCall.ConfLib.prototype.getMusicOnHold = function() {
    if (this.status && this.status.data)
        return  this.status.data.musicOnHold;

    return false;
};

/* Commands/setters */

WebCall.ConfLib.prototype.setMute = function(flag) {
    this._sendCommand("mute", flag ? 1 : 0);
};

WebCall.ConfLib.prototype.toggleMute = function() {
    this._sendCommand("mute", this.getMute() ? 0 : 1);
};

WebCall.ConfLib.prototype.toggleHandRaised = function() {
    this._sendCommand("raiseHand", this.getHandRaised() ? 0 : 1);
};

WebCall.ConfLib.prototype.toggleMusicOnHold = function() {
    this._sendCommand("moh", this.getMusicOnHold() ? 0 : 1);
};

WebCall.ConfLib.prototype.toggleLocked = function() {
    this._sendCommand("lock", this.getLocked() ? 0 : 1);
};

WebCall.ConfLib.prototype.toggleRecording = function() {
    this._sendCommand("callRecording", this.getRecording() == 1 ? 0 : 1);
};

WebCall.ConfLib.prototype.startConference = function() {
    this._sendCommand("hostConfirm");
};

WebCall.ConfLib.prototype.endConference = function() {
    this._sendCommand("endConference");
};

WebCall.ConfLib.prototype.setOutGain = function(value) {
    this._sendCommand("setOutGain", value);
};

WebCall.ConfLib.prototype.setConfMode = function(value) {
    this._sendCommand("confMode", value);
};

WebCall.ConfLib.prototype.changeRole = function(value) {
    this._sendCommand("changeRole", value);
};

WebCall.ConfLib.prototype.setRecording = function(value) {
    this._sendCommand("callRecording", value);
};

WebCall.ConfLib.prototype.setLocked = function(value) {
    this._sendCommand("lock", value);
};
    
/* Command implementation */

WebCall.ConfLib.prototype._sendCommand = function(name, value) {
    if (this.debug)
        console.log("WebCall:ConfLib._sendCommand(" + name + "," + value + ")");

    var body = "command=" + name;

    if (value)
        body += "&value=" + value;

    this.client.session.dialog.sendRequest(this, JsSIP.C.INFO, {
        extraHeaders: [
            "Content-Type: application/x-www-form-urlencoded"
        ],
        body: body
    });
};

WebCall.ConfLib.prototype.onRequestTimeout = function() {
    if (this.debug)
        console.log("WebCall:ConfLib.onRequestTimeout()");
};

WebCall.ConfLib.prototype.onTransportError = function() {
    if (this.debug)
        console.log("WebCall:ConfLib.onTransportError()");
};


WebCall.ConfLib.prototype.receiveResponse = function(response) {
    if (this.debug)
        console.log("WebCall:ConfLib.receiveResponse()", response);
};

/* event stuff */

WebCall.ConfLib.prototype._emitEvent = function(eventName, event) {
    if (this.debug)
        console.log("WebCall:ConfLib._emitEvent(" + eventName + ")");

    if (this._eventHandlers[eventName])
        this._eventHandlers[eventName](event);
};
