var should = require('should')
  , Avatar = require('../../lib/avatar')
  , ltx    = require('ltx')
  , helper = require('../helper')

describe('Avatar', function() {

    var avatar, socket, xmpp, manager

    before(function() {
        socket = new helper.Eventer()
        xmpp = new helper.Eventer()
        manager = {
            socket: socket,
            client: xmpp,
            trackId: function(id, callback) {
                this.callback = callback
            },
            makeCallback: function(error, data) {
                this.callback(error, data)
            }
        }
        avatar = new Avatar()
        avatar.init(manager)
    })

    describe('Handles', function() {
        
        it('Returns false for non-message stanzas', function() {
            avatar.handles(ltx.parse('<iq/>')).should.be.false
        })
        
        it('Returns true for correct stanza', function() {
            var stanza = '<message>' +
                '<event xmlns="' + avatar.NS_EVENT + '">' +
                '<items xmlns="' + avatar.NS_META + '">' +
                '<item>' +
                '<metadata xmlns="' + avatar.NS_META + '" />' +
                '</item>' +
                '</items>' +
                '</event>' +
                '</message>'
            avatar.handles(ltx.parse(stanza)).should.be.true
        })
        
    })
    
    describe('Handles incoming messages', function() {
        
        it('Handles requests to disable avatars', function(done) {
            socket.once('xmpp.avatar.push.metadata', function(data) {
                data.from.should.eql({
                    domain: 'shakespeare.lit',
                    user: 'romeo'
                })
                data.disabled.should.be.true
                done()
            })
            var stanza = '<message from="romeo@shakespeare.lit">' +
                '<event xmlns="' + avatar.NS_EVENT + '">' +
                '<items xmlns="' + avatar.NS_META + '">' +
                '<item>' +
                '<metadata xmlns="' + avatar.NS_META + '" />' +
                '</item>' +
                '</items>' +
                '</event>' +
                '</message>'
            avatar.handle(ltx.parse(stanza))
        })
        
        it('Handles full metadata update', function(done) {
            socket.once('xmpp.avatar.push.metadata', function(data) {
                data.from.should.eql({
                    domain: 'shakespeare.lit',
                    user: 'romeo'
                })
                should.not.exist(data.disabled)
                data.id.should.equal('12345abcdef')
                data.bytes.should.equal('12345')
                data.height.should.equal('64')
                data.type.should.equal('image/png')
                data.width.should.equal('64')
                done()
            })
            var stanza = '<message from="romeo@shakespeare.lit">' +
                '<event xmlns="' + avatar.NS_EVENT + '">' +
                '<items xmlns="' + avatar.NS_META + '">' +
                '<item id="12345abcdef">' +
                '<metadata xmlns="' + avatar.NS_META + '">' +
                '<info bytes="12345" ' +
                   'height="64" id="12345abcdef" ' +
                   'type="image/png" width="64"/>' +
                '</metadata>' +
                '</item>' +
                '</items>' +
                '</event>' +
                '</message>'
            avatar.handle(ltx.parse(stanza))
        })
        
    })
    
    describe('Upload image data', function() {

        it('Errors if no callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.emit('xmpp.avatar.upload', {})
        })

        it('Errors if non-function callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.emit('xmpp.avatar.upload', {}, true)
        })

        it('Errors if no content key provided', function(done) {
            var request = {}
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'content\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.upload',
                request,
                callback
            )
        })

        it('Errors if content key is not a string', function(done) {
            var request = {
                content: true
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description
                    .should.equal('Image content should be a string')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.upload',
                request,
                callback
            )
        })

        it('If \'id\' key provided it must be a string', function(done) {
            var request = {
                content: 'some-image-data',
                id: true
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Avatar id should be a string')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.upload',
                request,
                callback
            )
        })
        
        it('Sends expected stanza', function(done) {
            var request = {
                content: 'some-image-content'
            }
            var sha1 = '02bf50f9f139284d578c03a8625d9ff561735e4f'
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.type.should.equal('set')
                stanza.attrs.id.should.exist
                var publish = stanza.getChild('pubsub', avatar.NS_PUBSUB)
                    .getChild('publish')
                publish.attrs.node.should.equal(avatar.NS_IMG)
                var item = publish.getChild('item')
                item.should.exist
                item.attrs.id.should.equal(sha1)
                var data = item.getChild('data', avatar.NS_IMG)
                data.getText().should.equal(request.content)
                done()
            })
            socket.emit(
                'xmpp.avatar.upload',
                request,
                function() {}
            )
        })
        
        it('Sends expected stanza with provided ID', function(done) {
            var request = {
                content: 'some-image-content',
                id: '12345'
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.type.should.equal('set')
                stanza.attrs.id.should.exist
                var publish = stanza.getChild('pubsub', avatar.NS_PUBSUB)
                    .getChild('publish')
                publish.attrs.node.should.equal(avatar.NS_IMG)
                var item = publish.getChild('item')
                item.should.exist
                item.attrs.id.should.equal(request.id)
                var data = item.getChild('data', avatar.NS_IMG)
                data.getText().should.equal(request.content)
                done()
            })
            socket.emit(
                'xmpp.avatar.upload',
                request,
                function() {}
            )
        })
        

        it('Handles error response', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('iq-error'))
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.should.eql({
                    type: 'cancel',
                    condition: 'error-condition'
                })
                done()
            }
            var request = {
                content: 'some-image-content'
            }
            socket.emit(
                'xmpp.avatar.upload',
                request,
                callback
            )
        })

        it('Returns expected data', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('iq-result'))
            })
            var sha1 = '02bf50f9f139284d578c03a8625d9ff561735e4f'
            var callback = function(error, success) {
                should.not.exist(error)
                success.should.eql({
                    id: sha1
                })
                done()
            }
            var request = {
                content: 'some-image-content'
            }
            socket.emit(
                'xmpp.avatar.upload',
                request,
                callback
            )
        })

    })
    
    describe('Set meta data', function() {

        it('Errors if no callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.emit('xmpp.avatar.metadata', {})
        })

        it('Errors if non-function callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.emit('xmpp.avatar.metadata', {}, true)
        })
        
        it('Allows disabling of metadata publishing', function(done) {
            var request = { disable: true }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.type.should.equal('set')
                stanza.attrs.id.should.exist
                var publish = stanza.getChild('pubsub', avatar.NS_PUBSUB)
                    .getChild('publish')
                publish.attrs.node.should.equal(avatar.NS_IMG)
                var item = publish.getChild('item')
                item.should.exist
                var metadata = item.getChild('metadata', avatar.NS_META)
                metadata.should.exist
                metadata.children.length.should.equal(0)
                metadata.attrs.should.eql({ xmlns: 'urn:xmpp:avatar:metadata' })
                manager.makeCallback(helper.getStanza('iq-result'))
            })
            socket.emit(
                'xmpp.avatar.metadata',
                request,
                function(error, success) {
                    should.not.exist(error)
                    success.should.be.true
                    done()
                }
            )
        })
        
        it('Errors if \'bytes\' key missing', function(done) {
            var request = {}
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'bytes\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })
        
        it('Errors if \'id\' key missing', function(done) {
            var request = { bytes: 2345 }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'id\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })
        
        it('Errors if \'type\' key missing', function(done) {
            var request = { bytes: 2345, id: '12345' }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'type\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })
        
        it('Sends expected minimal attribute stanza', function(done) {
            var request = {
                bytes: 2345,
                id: '12345',
                type: 'image/png'
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.type.should.equal('set')
                stanza.attrs.id.should.exist
                var publish = stanza.getChild('pubsub', avatar.NS_PUBSUB)
                    .getChild('publish')
                publish.attrs.node.should.equal(avatar.NS_IMG)
                var item = publish.getChild('item')
                item.should.exist
                item.attrs.id.should.equal(request.id)
                var metadata = item.getChild('metadata', avatar.NS_META)
                metadata.should.exist
                var info = metadata.getChild('info')
                info.attrs.id.should.equal(request.id)
                info.attrs.bytes.should.eql(request.bytes)
                info.attrs.type.should.equal(request.type)
                done()
            })
            socket.emit(
                'xmpp.avatar.metadata',
                request,
                function() {}
            )
        })
        
        it('Sends expected full stanza', function(done) {
            var request = {
                bytes: 2345,
                id: '12345',
                type: 'image/png',
                url: 'http://example.org/avatar.png',
                width: 64,
                height: 64
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true

                var info = stanza.getChild('pubsub', avatar.NS_PUBSUB)
                    .getChild('publish')
                    .getChild('item')
                    .getChild('metadata', avatar.NS_META)
                    .getChild('info')
                info.attrs.url.should.equal(request.url)
                info.attrs.width.should.eql(request.width)
                info.attrs.height.should.eql(request.height)
                done()
            })
            socket.emit(
                'xmpp.avatar.metadata',
                request,
                function() {}
            )
        })
        
        it('Handes error response', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('iq-error'))
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.should.eql({
                    type: 'cancel',
                    condition: 'error-condition'
                })
                done()
            }
            var request = {
                id: '12345',
                type: 'image/png',
                bytes: '2345'
            }
            socket.emit(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })
        
        it('Returns expected data (not disabled)', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('iq-result'))
            })
            var callback = function(error, success) {
                should.not.exist(error)
                success.should.be.true
                done()
            }
            var request = {
                id: '12345',
                type: 'image/png',
                bytes: '2345'
            }
            socket.emit(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })
        
    })
    
    describe('Retrieve avatar data', function() {

        it('Errors if no callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.emit('xmpp.avatar.data', {})
        })

        it('Errors if non-function callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.emit('xmpp.avatar.data', {}, true)
        })
        
        it('Errors if \'of\' key missing', function(done) {
            var request = {}
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'of\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.data',
                request,
                callback
            )
        })
        
        it('Errors if \'id\' key is missing', function(done) {
            var request = { of: 'juliet@shakespeare.lit' }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'id\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.data',
                request,
                callback
            )
        })
        
        it('Sends expected stanza', function(done) {
            var request = {
                of: 'juliet@shakespeare.lit',
                id: '123456abcdef'
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.to.should.equal(request.of)
                stanza.attrs.type.should.equal('get')
                stanza.attrs.id.should.exist
                
                var items = stanza.getChild('pubsub', avatar.NS_PUBSUB)
                    .getChild('items')
                items.attrs.node.should.equal(avatar.NS_DATA)
                items.getChild('item').attrs.id.should.equal(request.id)
                done()
            })
            socket.emit(
                'xmpp.avatar.data',
                request,
                function() {}
            )
        })
        
        it('Handles error response', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('iq-error'))
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.should.eql({
                    type: 'cancel',
                    condition: 'error-condition'
                })
                done()
            }
            var request = {
                id: '123456abcdef',
                of: 'juliet@shakespeare.lit'
            }
            socket.emit(
                'xmpp.avatar.data',
                request,
                callback
            )
        })
        
        it('Returns expected data', function(done) {
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('avatar-data'))
            })
            var callback = function(error, success) {
                should.not.exist(error)
                success.should.eql({
                    content: 'some-image-data'
                })
                done()
            }
            var request = {
                id: '123456abcdef',
                of: 'juliet@shakespeare.lit'
            }
            socket.emit(
                'xmpp.avatar.data',
                request,
                callback
            )
        })
        
    })

    /* As this functionality proxies through to xmpp-ftw-pubsub
     * only functionality caused by this call needs to be tested
     */
    describe('Subscribe to updates', function() {
        
        it('Errors if \'of\' key missing', function(done) {
            var request = {}
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'of\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.subscribe',
                request,
                callback
            )
        })
        
        it('Sends expected stanza', function(done) {
            var request = { of: 'juliet@shakespare.lit' }
            xmpp.once('stanza', function(stanza) {
                stanza.attrs.to.should.equal(request.of)
                stanza.getChild('pubsub')
                    .getChild('subscribe')
                    .attrs.node
                    .should.equal(avatar.NS_META)
                done()
            })
            socket.emit(
                'xmpp.avatar.subscribe',
                request,
                function() {}
            )
        })
        
    })

    describe('Unubscribe from updates', function() {
        
        it('Errors if \'of\' key missing', function(done) {
            var request = {}
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'of\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.emit(
                'xmpp.avatar.unsubscribe',
                request,
                callback
            )
        })
        
        it('Sends expected stanza', function(done) {
            var request = { of: 'juliet@shakespare.lit' }
            xmpp.once('stanza', function(stanza) {
                stanza.attrs.to.should.equal(request.of)
                stanza.getChild('pubsub')
                    .getChild('unsubscribe')
                    .attrs.node
                    .should.equal(avatar.NS_META)
                done()
            })
            socket.emit(
                'xmpp.avatar.unsubscribe',
                request,
                function() {}
            )  
        })
        
    })
    
})