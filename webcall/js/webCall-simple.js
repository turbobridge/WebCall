"use strict";

$(document).ready(function() {    
    window.UI = new WebCall.UI({
        getConnectParams : function() {
            var formData = this.form.getData();

            var fieldsJSON = JSON.stringify({
                wsSipURI   : formData.wsSipURI,
                toSipURI   : formData.toSipURI,
                fromSipURI : formData.fromSipURI,
                fromName   : formData.fromName
            });

            app.cookie.create(app.config.WEBCALL_SAVE_FIELDS_COOKIE_NAME, fieldsJSON, app.config.WEBCALL_SAVE_FIELDS_COOKIE_MAX_AGE);
            
            var ret = {
                wsSipURI   : formData.wsSipURI,
                toSipURI   : formData.toSipURI,
                fromSipURI : formData.fromSipURI
            };

            if (formData.fromName)
                ret.fromName = formData.fromName;
            
            return ret;
        }
    });

    if (!UI.client.getSupportedFeatures().supported) {
        $("#pnlWebCall").hide();
        $("#pnlUnsupported").show();
        return;
    }
});
