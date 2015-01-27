var common = require('../common')
  , redis  = common.redis
  , knex   = common.knex;

module.exports = {
  'Reset DB': {
    topic: function() {
      var callback = this.callback;
      redis.del(['stentor:subscribe', 'stentor:unsubscribe', 'stentor:notify'], function(err) {
        if (err) { return callback(err); }
        knex('devices').truncate().exec(callback);
      });
    }

  , 'wait for reset': function() {}
  }
}
