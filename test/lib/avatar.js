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

})
