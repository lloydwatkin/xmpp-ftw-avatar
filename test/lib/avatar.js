'use strict';

var should = require('should')
  , Avatar = require('../../index')
  , ltx    = require('ltx')
  , helper = require('../helper')

/* jshint -W030 */
describe('Avatar', function() {

    var avatar, socket, xmpp, manager

    before(function() {
        socket = new helper.SocketEventer()
        xmpp = new helper.XmppEventer()
        manager = {
            socket: socket,
            client: xmpp,
            trackId: function(id, callback) {
                this.callback = callback
            },
            makeCallback: function(error, data) {
                this.callback(error, data)
            },
            getJidType: function(type) {
                if ('bare' === type)
                    return 'juliet@example.com'
                throw new Error('Unknown JID type')
            }
        }
        avatar = new Avatar()
        avatar.init(manager)
    })

    beforeEach(function() {
        socket.removeAllListeners()
        xmpp.removeAllListeners()
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

                data.avatars.length.should.equal(2)
                data.avatars[0].id.should.equal('12345abcdef')
                data.avatars[0].bytes.should.equal('12345')
                data.avatars[0].height.should.equal('64')
                data.avatars[0].type.should.equal('image/png')
                data.avatars[0].width.should.equal('64')

                data.avatars[1].id.should.equal('54321fedcba')
                data.avatars[1].bytes.should.equal('998')
                data.avatars[1].type.should.equal('image/jpeg')
                data.avatars[1].url.should.equal('http://xmpp.org/avatar.jpg')
                should.not.exist(data.avatars[1].width)
                should.not.exist(data.avatars[1].height)
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
                '<info bytes="998" ' +
                   'id="54321fedcba" ' +
                   'type="image/jpeg" url="http://xmpp.org/avatar.jpg" />' +
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
            socket.send('xmpp.avatar.upload', {})
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
            socket.send('xmpp.avatar.upload', {}, true)
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send('xmpp.avatar.metadata', {})
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
            socket.send('xmpp.avatar.metadata', {}, true)
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })

        it('Errors if \'additional\' key not array', function(done) {
            var request = {
                id: '12345abcdef',
                type: 'image/png',
                bytes: 1234,
                additional: true
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Additional must be an array')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })

        it('Errors if additional missing \'id\' key', function(done) {
            var request = {
                id: '12345abcdef',
                type: 'image/png',
                bytes: 1234,
                additional: [ {} ]
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description
                    .should.equal('Missing \'id\' key in additional')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })

        it('Errors if additional missing \'url\' key', function(done) {
            var request = {
                id: '12345abcdef',
                type: 'image/png',
                bytes: 1234,
                additional: [
                    {
                        id: '54321fedcba'
                    }
                ]
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description
                    .should.equal('Missing \'url\' key in additional')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })

        it('Errors if additional missing \'bytes\' key', function(done) {
            var request = {
                id: '12345abcdef',
                type: 'image/png',
                bytes: 1234,
                additional: [
                    {
                        id: '54321fedcba',
                        url: 'http://shakespeare.lit/romeo.jpg'
                    }
                ]
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description
                    .should.equal('Missing \'bytes\' key in additional')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })

        it('Errors if additional missing \'type\' key', function(done) {
            var request = {
                id: '12345abcdef',
                type: 'image/png',
                bytes: 1234,
                additional: [
                    {
                        id: '54321fedcba',
                        url: 'http://shakespeare.lit/romeo.jpg',
                        bytes: 998
                    }
                ]
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description
                    .should.equal('Missing \'type\' key in additional')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.avatar.metadata',
                request,
                callback
            )
        })

        var checkMetaData = function(request, info) {
            info.attrs.id.should.equal(request.id)
            info.attrs.url.should.equal(request.url)
            info.attrs.bytes.should.eql(request.bytes)
            info.attrs.type.should.equal(request.type)
        }

        it('Sends expected stanza with additionals', function(done) {
            var request = {
                id: '12345abcdef',
                type: 'image/png',
                bytes: 1234,
                additional: [
                    {
                        id: '54321fedcba',
                        url: 'http://shakespeare.lit/romeo.jpg',
                        bytes: 998,
                        type: 'image/jpeg'
                    },
                    {
                        id: '98765zyxvwu',
                        url: 'http://shakespeare.lit/romeo.gif',
                        bytes: 1444,
                        type: 'image/gif',
                        height: 64,
                        width: 64
                    }
                ]
            }
            xmpp.once('stanza', function(stanza) {
                var item = stanza.getChild('pubsub', avatar.NS_PUBSUB)
                    .getChild('publish')
                    .getChild('item')

                item.attrs.id.should.equal(request.id)

                var metadata = item.getChild('metadata', avatar.NS_META)
                metadata.children.length.should.equal(3)

                var info = metadata.children[0]
                info.attrs.type.should.equal(request.type)
                info.attrs.bytes.should.eql(request.bytes)
                info.attrs.id.should.equal(request.id)

                info = metadata.children[1]
                checkMetaData(request.additional[0], info)
                should.not.exist(info.attrs.height)
                should.not.exist(info.attrs.width)

                info = metadata.children[2]
                checkMetaData(request.additional[1], info)
                info.attrs.height.should.equal(request.additional[1].height)
                info.attrs.width.should.equal(request.additional[1].width)

                done()
            })
            socket.send(
                'xmpp.avatar.metadata',
                request,
                function() {}
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
            socket.send('xmpp.avatar.data', {})
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
            socket.send('xmpp.avatar.data', {}, true)
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
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
            socket.send(
                'xmpp.avatar.unsubscribe',
                request,
                function() {}
            )
        })

    })

})
