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

    describe('Upload image data', function() {

        it('Errors if no callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal("Missing callback")
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
                error.description.should.equal("Missing callback")
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
                error.description.should.equal("Missing 'content' key")
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
                    .should.equal("Image content should be a string")
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
                error.description.should.equal("Avatar id should be a string")
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
            xmpp.once('stanza', function(stanza) {
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
            xmpp.once('stanza', function(stanza) {
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

})
