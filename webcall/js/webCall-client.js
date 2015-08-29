"use strict";

if (!window.WebCall) window.WebCall = {};

WebCall.Client = function(options) {
    if (this.debug)
        console.log("new WebCall.Client()");

    // setup JsSIP
    if (!JsSIP.debug().enabled)
        JsSIP.debug.enable("none");
    
    JsSIP.C.USER_AGENT += " Browser - " + navigator.userAgent
    JsSIP.rtcninja();

    // create <audio> element
    this._audioElement = ($("<audio>")
                          .attr("autoplay", "autoplay")
                          .css("display", "none"))[0];

    // setup shims
    this.AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!this.AudioContext) {
        if (this.debug)
            console.log("WebCall:Client not supported");

        return;
    }

    this.getSources = MediaStreamTrack && MediaStreamTrack.getSources;

    // parse and assign options
    for (var i in this._eventHandlers) {
        if (options && options.eventHandlers && options.eventHandlers[i])
            this._eventHandlers[i].push(options.eventHandlers[i]);
    }

    // get sources if possible
    
    if (this.getSources) {
        var self = this;
        
        this.getSources(function(sources) { self._getSourcesInitial(sources); });
    }    
};

$.extend(WebCall.Client.prototype, {
    AudioContext : null,
    getSources   : null,
    
    ua              : null,
    session         : null,
    debug           : 1,

    _state            : null,
    _localMediaStream : null,
    _audioIn          : {},
    _audioInFake      : {},

    _eventHandlers : {
        ringing      : [],
        disconnected : [],
        connected    : [],
        error        : [],
        preconnect   : [],
        newMessage   : []
    },

    _mediaConstraints : {
        video : false,
        audio : {
            optional : []
        }
    },

    _audioConstraints : {
        googEchoCancellation         : true,
        googAutoGainControl          : true,
        googNoiseSuppression         : true,
        googHighpassFilter           : true,
        googAudioMirroring           : false,
        googNoiseSuppression2        : true,
        googEchoCancellation2        : true,
        googAutoGainControl2         : true,
        googDucking                  : false,
        chromeRenderToAssociatedSink : true,
    },

    _reset : function() {
        this.setHold(false);
    },

    getState : function() {
        return this._state;
    },

    getSupportedFeatures : function() {
        return {
            supported      : !!this.AudioContext,
            changeSettings : !!this.getSources
        };
    },

    _getSourcesInitial : function(sources) {
        if (this.debug)
            console.log("WebCall:Client._getSourcesInitial()", sources);

        for (var i = 0; i < sources.length; i++) {
            var cur = sources[i];

            if (cur.kind == "audio") {
                this._audioConstraints.sourceId = cur.id;
                break;
            }
        }
    },

    connect : function(connectParams) {
        this._connectParams = connectParams;
        
        this._reset();

        this._emitEvent("preconnect");

        if (this._localMediaStream)
            this._connect();
        else
            this.getUserMedia();
    },

    _connect : function() {
        this._setSipURIs(this._connectParams.toSipURI, this._connectParams.fromSipURI);

        this._connectWS();
    },

    _setState : function(state) {
        if (this.debug)
            console.log("WebCall:Client._setState(" + state + ")");

        this._state = state;

        switch (state) {
        case "ringing":
            this._emitEvent("ringing");

            break;

        case "disconnected":
            if (this.ua !== null && this.ua.isConnected()) {
                this.ua.stop();
            }

            if (this._localMediaStream) {
                if (!this._localMediaStream.fake)
                    this._localMediaStream.stop();

                this._localMediaStream = null;
            }

            this._audioElement.src = "";

            this._emitEvent("disconnected");

            break;

        case "connected":
            this._emitEvent("connected");

            break;
        }
    },

    getHold : function() {
        return this._audioElement.muted;
    },
    
    setHold : function(flag) {
        if (this.debug)
            console.log("WebCall:Client.setHold(" + flag + ")");

        this._audioElement.muted = flag;
    },

    getMute : function() {
        var track = this._getLocalAudioTrack();

        if (track && !track.enabled)
            return true;

        return false;
    },

    setMute : function(flag) {
        if (this.debug)
            console.log("WebCall:Client.setMute(" + flag + ")");

        var track = this._getLocalAudioTrack();
        if (track !== null) {
            track.enabled = !flag;
        }
    },

    sendDTMF : function(digit) {
        if (this.debug)
            console.log("WebCall:Client.sendDTMF(" + digit + ")");

        this.session.sendDTMF(digit);
    },

    isMicConnected : function() {
        return !!(this._localMediaStream && !this._localMediaStream.fake);
    },

    _getLocalAudioTrack : function() {
        if (!this._localMediaStream)
            return null;

        var tracks = this._localMediaStream.getAudioTracks();

        if (tracks.length > 0)
            return tracks[0];

        return null;
    },

    _setSipURIs : function(toURI, fromURI) {
        this.toURI = toURI;
        this.fromURI = fromURI;
    },

    _connectWS : function() {
        var connectParams = this._connectParams;
        
        if (this.debug)
            console.log("WebCall:Client._connectWS()", connectParams);

        this._setState("ringing");

        var configuration = {
            ws_servers   : [ connectParams.wsSipURI ],
            uri          : this.fromURI,
            register     : false,
            trace_sip    : true,
            stun_servers : []
        };

        if (connectParams.fromName)
            configuration.display_name = connectParams.fromName;

        try {
            this.ua = new JsSIP.UA(configuration);
        } catch (e) {
            this._emitError("ERR_WEBCALL_WS_CONNECT_FAILED");
            return;
        }

        var self = this;

        this.ua.on("connected", function(e) {
            if (self.debug)
                console.log("WebCall:Client.ua.connected", e);

            self._call();
        });

        this.ua.on("disconnected", function(e) {
            if (self.debug)
                console.log("WebCall:Client.ua.disconnected", e);

            this.stop();

            if (self._state == "ringing")
                self._emitError("ERR_WEBCALL_WS_CONNECT_FAILED");
        });

        this.ua.on("newRTCSession", function(e) {
            if (self.debug)
                console.log("WebCall:Client.ua.newRTCSession", e);

            self.session = e.session;
        });

        this.ua.on("newMessage", function(e) {
            if (self.debug)
                console.log("WebCall:Client.ua.newMessage", e);

            self._emitEvent("newMessage", e);
        });

        this.ua.start();
    },

    _call : function() {
        if (this.debug)
            console.log("WebCall:Client._call()");

        var self = this;

        var eventHandlers = {
            connecting : function(e) {
                if (self.debug)
                    console.log("WebCall:Client.session.call.connecting", e);

                self._setState("ringing");
            },

            failed : function(e) {
                if (self.debug)
                    console.log("WebCall:Client.session.call.failed", e);

                self.session = null;

                self._setState("disconnected");

                if (!(e && e.data && e.data.cause && e.data.cause == "Canceled"))
                    self._emitError("ERR_WEBCALL_SIP_CONNECT_FAILED", e);
            },

            accepted : function(e) {
                if (self.debug)
                    console.log("WebCall:Client.session.call.accepted", e);
            },

            confirmed : function(e) {
                if (self.debug)
                    console.log("WebCall:Client.session.call.confirmed", e);
            },

            addstream : function(e) {
                if (self.debug)
                    console.log("WebCall:Client.session.call.addstream", e);

                self._audioElement.src = window.URL.createObjectURL(e.stream);

                self._setState("connected");
            },

            ended : function(e) {
                if (self.debug)
                    console.log("WebCall:Client.session.call.ended", e);

                self.session = null;

                self._setState("disconnected");
            }
        };

        var options = {
            mediaStream         : this._localMediaStream,
            eventHandlers       : eventHandlers,
            rtcConstraints : {
                optional : [ { googIPv6 : false }]
            }
        };

        try {
            this.ua.call(this.toURI, options);
        } catch (e) {
            this._emitError("ERR_WEBCALL_SIP_CONNECT_FAILED", e);
        }
    },

    getMediaConstraints : function() {
        this._mediaConstraints.audio.optional = [];

        for (var i in this._audioConstraints) {
            var cur = this._audioConstraints[i];
            var opt = {};
            opt[i] = cur;

            this._mediaConstraints.audio.optional.push(opt);
        }

        return this._mediaConstraints;
    },

    getAudioOptions : function() {
        return {
            autoGainControl  : this._audioConstraints.googAutoGainControl,
            noiseSuppression : this._audioConstraints.googNoiseSuppression,
            echoCancellation : this._audioConstraints.googEchoCancellation
        };
    },

    setAudioOptions : function(options) {
        if (this.debug)
            console.log("WebCall:Client.setAudioOptions()", options);

        this._audioConstraints.googAutoGainControl = this._audioConstraints.googAutoGainControl2 = options.autoGainControl;
        this._audioConstraints.googNoiseSuppression = this._audioConstraints.googNoiseSuppression2 = this._audioConstraints.googHighpassFilter = options.noiseSuppression;
        this._audioConstraints.googEchoCancellation = this._audioConstraints.googEchoCancellation2 = options.echoCancellation;
    },

    getAudioSourceId : function() {
        return this._audioConstraints.sourceId || null;
    },

    setAudioSourceId : function(sourceId) {
        if (this.debug)
            console.log("WebCall:Client.setAudioSourceId()", sourceId);

        if (sourceId)
            this._audioConstraints.sourceId = sourceId;
        else
            delete this._audioConstraints.sourceId;
    },

    getUserMedia : function() {
        var self = this, rtcninja = JsSIP.rtcninja;

        rtcninja.getUserMedia(
            this.getMediaConstraints(),
            function(stream) {
                self._userMediaSucceeded(stream);
            },
            function() {
                self._userMediaFailed()
            }
        );
    },

    _userMediaSucceeded : function(stream) {
        var self = this;

        if (this.debug)
            console.log("WebCall:Client._userMediaSucceeded()", stream);

        this._getVolumeMeter(stream, this._audioIn);

        if (this._state == "connected") {
            var cnt = 2;
            this.session.connection.onnegotiationneeded = function(e) {
                if (self.debug)
                    console.log("call.onnegotiationneeded cnt = " + cnt, e);

                cnt--;
                if (!cnt) {
                    self.session.renegotiate();
                }
            };

            if (this._localMediaStream) {
                this._localMediaStream.stop();
                this.session.connection.removeStream(this._localMediaStream);
            }

            this.session.connection.addStream(stream);

            this._localMediaStream = stream;
        } else {
            this._localMediaStream = stream;

            this._connect();
        }
    },

    _userMediaFailed : function() {
        if (this.debug)
            console.log("WebCall:Client._userMediaFailed()");

        if (this._state == "connected") {
            return;
        }

        var stream = this._getFakeMediaStream(this._audioInFake);

        stream.fake = true;

        this._localMediaStream = stream;

        this._connect();
    },

    _getVolumeMeter : function(stream, obj) {
        if (!obj.init) {
            obj.context = new this.AudioContext();
            obj.meter   = createAudioMeter(obj.context);
            obj.init    = true;
        } else {
            // remove previous source from AudioContext graph
            obj.source.disconnect();
        }

        obj.source = obj.context.createMediaStreamSource(stream);
        obj.source.connect(obj.meter);
    },

    getInputVolume : function() {
        if (this._audioIn && this._audioIn.meter)
            return this._audioIn.meter.volume;
        
        return 0;
    },

    _getGainFilteredStream : function(stream, obj, controlID) {
        obj.context = new this.AudioContext();

        var context = obj.context;

        obj.source   = context.createMediaStreamSource(stream);
        obj.dest     = context.createMediaStreamDestination();
        obj.gainNode = context.createGain();

        obj.source.connect(obj.gainNode);

        obj.meter = createAudioMeter(context);
        obj.gainNode.connect(obj.meter);


        obj.gainNode.connect(obj.dest);

        return obj.dest.stream;
    },

    _getFakeMediaStream : function(obj) {
        obj.context  = new this.AudioContext();
        obj.dest     = obj.context.createMediaStreamDestination();

        return obj.dest.stream;
    },

    endCall : function() {
        if (this.debug)
            console.log("WebCall:Client.endCall()");

        if (this.session)
            this.session.terminate();
    },
    
    on : function(event, handler) {
        this._eventHandlers[event].push(handler);
    },

    _emitEvent : function(eventName, event) {
        if (this.debug)
            console.log("WebCall:Client._emitEvent(" + eventName + ")");

        var eventList = this._eventHandlers[eventName];

        for (var i in eventList)
            eventList[i](event);
    },

    _emitError : function(code, origEvent) {
        var ret = {
            code : code,
            data : origEvent || null
        };
        
        if (this.debug)
            console.log("WebCall:Client._emitError()", ret);

        this._emitEvent("error", ret);
    }
});
