var builder    = require('ltx'),
    Base       = require('xmpp-ftw/lib/base'),
    crypto     = require('crypto')
    
var Avatar = function() {}

Avatar.prototype = new Base()

Avatar.prototype.NS_IMG    = 'urn:xmpp:avatar:data'
Avatar.prototype.NS_META   = 'urn:xmpp:avatar:metadata'
Avatar.prototype.NS_PUBSUB = 'http://jabber.org/protocol/pubsub'
Avatar.prototype.NS_EVENT  = 'http://jabber.org/protocol/pubsub#event'

Avatar.prototype.registerEvents = function() {
    var self = this
    this.socket.on('xmpp.avatar.upload', function(data, callback) {
        self.uploadData(data, callback)
    })
    this.socket.on('xmpp.avatar.metadata', function(data, callback) {
        self.setMetadata(data, callback)
    })
    this.socket.on('xmpp.avatar.data', function(data, callback) {
        self.getData(data, callback)
    })
}

Avatar.prototype.handles = function(stanza) {
    var event, items, item, metadata
    if ((false === stanza.is('message')) ||
        (null === (event = stanza.getChild('event', this.NS_EVENT))) ||
        (null === (items = event.getChild('items', this.NS_META))) ||
        (null === (item = items.getChild('item'))) ||
        (null === (metadata = item.getChild('metadata', this.NS_META))))
        return false
    return true
}

Avatar.prototype.handle = function(stanza) {
  
    var data = { from: this._getJid(stanza.attrs.from) }
    try {
        var metadata = stanza.getChild('event')
            .getChild('items')
            .getChild('item')
            .getChild('metadata')
        if (0 === metadata.children.length)
            data.disabled = true
        else
            this._addMetadata(metadata.getChild('info').attrs, data)
        this.socket.emit('xmpp.avatar.push.metadata', data)
        return true
    } catch (e) {
        return false
    }
}

Avatar.prototype._addMetadata = function(attrs, data) {
    var properties = [ 'id', 'width', 'height', 'type', 'bytes', 'url' ]
    var value
    properties.forEach(function(property) {
        if (null !== (value = attrs[property]))
            data[property] = attrs[property]
    })
}

Avatar.prototype.setMetadata = function(data, callback) {
    var self = this
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)

    var attrs = {}
      , infoAttrs = {}
    
    if (!data.disable) {
       if (!data.bytes)
           return this._clientError('Missing \'bytes\' key', data, callback)
       if (!data.id)
           return this._clientError('Missing \'id\' key', data, callback)
       if (!data.type)
           return this._clientError('Missing \'type\' key', data, callback)
       this._addMetadata(data, infoAttrs)
       attrs.id = data.id
    }

    var stanza = new builder.Element(
        'iq',
        { type: 'set', id: this._getId() }
    ).c('pubsub', { xmlns: this.NS_PUBSUB })
     .c('publish', { node: this.NS_IMG })
     .c('item', attrs)
     .c('metadata', { xmlns: this.NS_META })
  
    if (!data.disable)
        stanza.c('info', infoAttrs)

    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if ('error' == stanza.attrs.type)
            return callback(self._parseError(stanza), null)
        callback(null, true)
    })
    this.client.send(stanza)
}

Avatar.prototype.uploadData = function(data, callback) {
    var self = this
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)
    if (!data.content)
        return this._clientError('Missing \'content\' key', data, callback)
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

Avatar.prototype.getData = function(data, callback) {
    var self = this
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)
    if (!data.of)
        return this._clientError('Missing \'of\' key', data, callback)
    if (!data.id)
        return this._clientError('Missing \'id\' key', data, callback)
    var stanza = new builder.Element(
        'iq',
        { type: 'get', id: this._getId(), to: data.of }
    ).c('pubsub', { xmlns: this.NS_PUBSUB })
     .c('items', { node: this.NS_DATA })
     .c('item', { id: data.id })
    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if ('error' == stanza.attrs.type)
            return callback(self._parseError(stanza), null)
        var content = stanza.getChild('pubsub')
            .getChild('items')
           .getChild('item')
            .getChildText('data')
        callback(null, { content: content })
    })
    this.client.send(stanza)
    
}

module.exports = Avatar