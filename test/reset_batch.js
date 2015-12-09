var common = require('../common');
var helpers = require('./helpers');
var Promise = require('bluebird');

module.exports = function() {
  return Promise.try(function() {
    console.log('Resetting batch...');
    helpers.actionWatcher.clearBuffer();
    return common.redis.delAsync(['yodel:subscribe', 'yodel:unsubscribe', 'yodel:notify', 'yodel:push']).then(function() {
      return common.knex('devices').truncate();
    });
  })
  .catch(common.notifyError);
}
