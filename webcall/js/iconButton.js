jQuery.fn.enableIconButton = function(flag) {
    if (flag || flag === undefined)
        this.removeAttr("disabled");
    else
        this.attr("disabled", true);
};

$(document).ready(function() {
    $(document).on("click", ".btnImg", function() { 
        $(this).trigger("iconClick");
    });

    // no tooltips for mobile browsers
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
        return;

    $(document).tooltip({
        items    : ".btnShowTooltip",
        show     : {
            delay : 800
        },
        content : function() {
            if (this.tagName == "TH")
                return app.localeStrings.lblSortHelp;

            if ($(this).hasClass("btnImg")) {
                var text = $(this).children("span").text();
                if (text)
                    return text;
            }

            return $(this).attr("alt");
        }
    });
});
