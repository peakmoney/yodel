/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

const common = require('../common');
const Promise = require('bluebird');

/**
 *  Creates a new RedisListener.
 *  @constructor
 */
const RedisListener = function RedisListener() {};

/**
 *  Executes redis blpop command asynchronously.
 *  @param {Array} channels - Redis string keys.
 */
RedisListener.prototype.listen = function listen(channels) {
  return Promise.try(() => {
    const keys = Object.keys(channels);
    keys.forEach((key) => {
      if (typeof channels[key] === 'undefined') {
        throw new Error(`Invalid method for key: ${key}`);
      }
    });

    return common.redis.blpopAsync(Object.keys(channels).concat([0])).then((data) => {
      if (!Array.isArray(data) || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
        common.notifyError(`unexpected data format: ${data}`);
        return this.listen(channels);
      }

      const key = data[0];
      const method = channels[key];

      return Promise.try(() => {
        return JSON.parse(data[1]);
      })
      .then((parsedData) => {
        return method(parsedData).then(() => {
          return this.listen(channels);
        })
        .catch(common.notifyError);
      })
      .catch(() => {
        common.notifyError(`invalid JSON on ${key}:${data[1]}`);
        return this.listen(channels);
      });
    })
    .catch((err) => {
      common.notifyError(`error from blpop: ${err}`);
      return this.listen(channels);
    });
  });
};

module.exports = (() => {
  return new RedisListener();
})();
