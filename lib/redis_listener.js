'use strict';

const common = require('../common');
const Promise = require('bluebird');

module.exports = class RedisListener {
  /**
   *  Executes redis blpop command asynchronously.
   *  @param {Array} channels - Redis string keys.
   */
  listen(channels) {
    const self = this;

    return Promise.try(() => {
      for (let key in channels) {
        if (typeof channels[key] === 'undefined') {
          throw new Error(`Invalid method for key: ${key}`);
        }
      }

      const blpopArgs = Object.keys(channels);
      blpopArgs.push(0); // 0 timeout

      return common.redis.blpopAsync(blpopArgs).then(data => {
        if (!Array.isArray(data) || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
          common.notifyError(`unexpected data format: ${data}`);
          return self.listen(channels);
        }

        const key = data[0];
        const deviceMethod = channels[key];

        return Promise.try(() => JSON.parse(data[1]))
          .catch(() => {
            common.notifyError(`Invalid JSON on ${key}:${data[1]}`);
            return self.listen(channels);
          })
          .then((parsedData) => deviceMethod(parsedData))
          .catch((e) => {
            common.notifyError(`Error calling deviceMethod for ${key}: ${e}`);
            return self.listen(channels);
          })
          .then(() => self.listen(channels));
      }).catch(err => {
        common.notifyError(`Error from blpop: ${err}`);
        return self.listen(channels);
      });
    });
  }
};
