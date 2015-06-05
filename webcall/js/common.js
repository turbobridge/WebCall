String.prototype.escapeHTML = function() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g, '&quot;');
};

String.prototype.parseQueryString = function() {
    var match;
    var search = /([^&=]+)=?([^&]*)/g;
    var decode = function (s) { return decodeURIComponent(s.replace(/\+/g, " ")); };
    var ret = {};
    
    while (match = search.exec(this))
        ret[decode(match[1])] = decode(match[2]);

    return ret;
};

String.prototype.formatConferenceID = function() {
    var len = this.length;
        
    if (len <= 5)
        return this;
        
    switch (len) {
    case 6:
    case 7:
        return this.substr(0, 3) + '-' + this.substr(3);
    case 8:
        return this.substr(0, 4) + '-' + this.substr(4);
    case 9:
    case 10:
        return this.substr(0, 3) + '-' + this.substr(3, 3) + '-' + this.substr(6);
    }
        
    return this;
};

function getPageName() {
    var name = document.location.href;
    var end = (name.indexOf("?") == -1) ? name.length : name.indexOf("?");

    return name.substring(name.lastIndexOf("/")+1, end);
}

function getBaseURL() {
    var url = document.location.href;

    return url.substring(0, url.lastIndexOf("/") + 1);
}
