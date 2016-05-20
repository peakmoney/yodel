/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

var common = require('../common');
var Promise = require('bluebird');

/**
 *  Creates a new RedisListener.
 *  @constructor
 */
var RedisListener = function RedisListener() {};

/**
 *  Executes redis blpop command asynchronously.
 *  @param {Array} channels - Redis string keys.
 */
RedisListener.prototype.listen = function listen(channels) {
  var _this = this;

  return Promise.try(function() {
    for (var key in channels) {
      if (typeof channels[key] === 'undefined') {
        throw new Error('Invalid method for key: '+key);
      }
    }

    return common.redis.blpopAsync(Object.keys(channels).concat([0])).then(function(data) {
      if (!Array.isArray(data) || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
        common.notifyError('unexpected data format: '+data);
        return _this.listen(channels);
      }

      var key = data[0];
      var method = channels[key];

      return Promise.try(function() {
        return JSON.parse(data[1]);
      })
      .then(function(parsedData) {
        return method(parsedData).then(function() {
          return _this.listen(channels);
        })
        .catch(common.notifyError);
      })
      .catch(function(err) {
        common.notifyError('invalid JSON on '+key+':'+data[1]);
        return _this.listen(channels);
      });
    })
    .catch(function(err) {
      common.notifyError('error from blpop: '+err);
      return _this.listen(channels);
    });
  });
}

module.exports = (function() {
  return new RedisListener();
})();
