var builder    = require('ltx'),
    Base       = require('xmpp-ftw/lib/base')
    
var Avatar = function() {}

Avatar.prototype = new Base()

Avatar.prototype.registerEvents = function() {
}

Avatar.prototype.handles = function(stanza) {
    return false
}

Avatar.prototype.handle = function(stanza) {
    return false
}

module.exports = Avatar
