"use strict";

if (!window.WebCall) window.WebCall = {};

WebCall.init = function() {
    var iframeLocation = app.config.WEBCALL_IFRAME_URI;
    var targetWindow   = $("#pnlWebCall iframe");

    WebCall.initEmbedded(
        iframeLocation, targetWindow,
        function() { // onUnsupported
            $("#pnlWebCall").hide();
            $("#pnlUnsupported").show();
        },
        function() { // getConnectParams
            var formData = this._form.getData();

            var fieldsJSON = JSON.stringify({
                conferenceID : formData.conferenceID,
                fromName     : formData.fromName,
                email        : formData.email
            });

            app.cookie.create(app.config.WEBCALL_SAVE_FIELDS_COOKIE_NAME, fieldsJSON, app.config.WEBCALL_SAVE_FIELDS_COOKIE_MAX_AGE);

            if (!formData.conferenceID.length)
                return "ERR_INVALID_CONFERENCE_ID";

            if (formData.email && !formData.email.validateEmail())
                return "ERR_INVALID_EMAIL";

            var ret = {
                wsSipURI   : app.config.params.wsSipURI,
                toSipURI   : app.config.params.toUriPrefix + formData.conferenceID + app.config.params.toUriSuffix
            };

            if (formData.email)
                ret.fromSipURI = "sip:" + formData.email;
            else
                ret.fromSipURI = "sip:caller@invalid";

            if (formData.fromName)
                ret.fromName = formData.fromName;

            return ret;
        },
        function(data) { // onConfUpdate
        },
        function(adapter) { // onReady
            $(".btnConnect")
                .button()
                .click(function(event) {
                    adapter.connect();
                });

            $("#pnlWebCall input").keypress(function(event) {
                if (event.which == 13) {
                    adapter.connect();
                }
            });
        }
    );
};

$(document).ready(function() {
    WebCall.init();
});
