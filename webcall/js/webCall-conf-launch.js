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
        },

        setMuteLockedDisplay : function(flag) {
            if (flag) {
                $("#pnlWebCall .btnMute").button("option", "disabled", true);
            } else {
                $("#pnlWebCall .btnMute").button("option", "disabled", false);
            }
        },

        setHostDisplay : function(flag) {
            var widget = $("#pnlWebCall .confMode").dropdown("widget");

            if (flag) {
                $("#pnlWebCall .confMode").dropdown("enable");
                widget.find(".ui-icon").show();
                
                $("#pnlWebCall .btnChangeRole").addClass("btnEndConference");
                $("#pnlWebCall .btnChangeRole .tooltip").text(app.localeStrings.lblEndConference);

                $("#pnlWebCall .btnLock, #pnlWebCall .btnRecording").button("enable");
            } else {
                $("#pnlWebCall .confMode").dropdown("disable");
                widget.find(".ui-icon").hide();
                
                $("#pnlWebCall .btnChangeRole").removeClass("btnEndConference");
                $("#pnlWebCall .btnChangeRole .tooltip").text(app.localeStrings.lblChangeRole);

                $("#pnlWebCall .btnLock, #pnlWebCall .btnRecording").button("disable");
            }
        },

        setConfModeDisplay : function(value) {
            $("#pnlWebCall .confMode")
                .val(this._confMode)
                .dropdown("refresh");
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
