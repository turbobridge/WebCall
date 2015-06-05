$(document).ready(function() {
    window.ConfUI = new WebCall.ConfUI({
        getConnectParams : function() {
            var formData = this.form.getData();

            var fieldsJSON = JSON.stringify({
                conferenceID : formData.conferenceID,
                fromName     : formData.fromName,
                email        : formData.email
            });

            app.cookie.create(app.config.WEBCALL_SAVE_FIELDS_COOKIE_NAME, fieldsJSON, app.config.WEBCALL_SAVE_FIELDS_COOKIE_MAX_AGE);

            // TODO
            //var pinMatch = formData.conferenceID.match(/#\d+$/);

            var conferenceID = formData.conferenceID.replace(/[^\d#*]/g, "");

            if (!conferenceID.length)
                return "ERR_INVALID_CONFERENCE_ID";

            if (formData.email && !formData.email.validateEmail())
                return "ERR_INVALID_EMAIL";
            
            var ret = {
                wsSipURI   : app.config.params.wsSipURI,
                toSipURI   : app.config.params.toUriPrefix + conferenceID + app.config.params.toUriSuffix
            };

            if (app.config.params.debug) {
                ret.wsSipURI = formData.wsSipURI;
                ret.toSipURI = formData.toUriPrefix + conferenceID + formData.toUriSuffix
            }

            if (formData.email)
                ret.fromSipURI = "sip:" + formData.email;
            else
                ret.fromSipURI = "sip:caller@invalid";

            if (formData.fromName)
                ret.fromName = formData.fromName;

            return ret;
        }
    });

    if (!window.ConfUI.ui.client.getSupportedFeatures().supported) {
        $("#pnlWebCall").hide();
        $("#pnlUnsupported").show();
        return;
    }

    $(window).bind("hashchange", function() {
        window.ConfUI._hashChange();
    });

    if (window.location.hash.length) {
        window.ConfUI._hashChange();
    }
});
