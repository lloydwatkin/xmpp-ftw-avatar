var builder    = require('ltx'),
    Base       = require('xmpp-ftw/lib/base'),
    crypto     = require('crypto')
    
var Avatar = function() {}

Avatar.prototype = new Base()

Avatar.prototype.NS_IMG    = 'urn:xmpp:avatar:data'
Avatar.prototype.NS_META   = 'urn:xmpp:avatar:metadata'
Avatar.prototype.NS_PUBSUB = 'http://jabber.org/protocol/pubsub'

Avatar.prototype.registerEvents = function() {
    var self = this
    this.socket.on('xmpp.avatar.upload', function(data, callback) {
        self.uploadData(data, callback)
    })
}

Avatar.prototype.handles = function(stanza) {
    return false
}

Avatar.prototype.handle = function(stanza) {
    return false
}

Avatar.prototype.uploadData = function(data, callback) {
    var self = this
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)
    if (!data.content)
        return this._clientError("Missing 'content' key", data, callback)
    if (typeof data.content !== 'string')
        return this._clientError('Image content should be a string', data, callback)
    if (data.id && (typeof data.id !== 'string'))
        return this._clientError('Avatar id should be a string', data, callback)
    var id
    if (data.id) {
        id = data.id
    } else { 
        var shasum = crypto.createHash('sha1')
        shasum.update(data.content)
        id = shasum.digest('hex')
    }
    var stanza = new builder.Element(
        'iq',
        { type: 'set', id: this._getId() }
    ).c('pubsub', { xmlns: this.NS_PUBSUB })
     .c('publish', { node: this.NS_IMG })
     .c('item', { id: id })
     .c('data', { xmlns: this.NS_IMG })
     .t(data.content)
    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if ('error' == stanza.attrs.type) 
            return callback(self._parseError(stanza), null)
        callback(null, { id: id })
    })
    this.client.send(stanza)
}

module.exports = Avatar
