/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

const common = require('../common');
const Device = require('./device');
const apn = require('apn');
const Promise = require('bluebird');

/**
 *  Creates a feedback service to monitor APN failures.
 *  @constructor
 */
const FeedbackService = function FeedbackService() {
  this.config = common.config('apn_feedback', true);
  this.service = new apn.Feedback(this.config);
  this.service.on('feedback', this.processApnFeedback);
};

/**
 *  Represents a Device API useable object. Sets platform by default.
 *  @constructor
 *  @param {Object} attrs
 *  @param {String} attrs.token - A valid device token.
 *  @param {Integer} attrs.user_id - ID of user associated with device token.
 */
const ApnFeedbackDevice = function ApnFeedbackDevice(attrs) {
  this.token = attrs.token;
  this.user_id = attrs.user_id;
  this.platform = 'ios';
};

/**
 *  Processes APN feedback returned on the 'feedback' event.
 *  @param {Array} feedbackDevices - Array of {device: {token:""}, time: #####}
 *    returned from APN Feedback Service and formatted by node-apn.
 */
FeedbackService.prototype.processApnFeedback =
  function processApnFeedback(feedbackDevices, fDevice) {
    let devices = feedbackDevices;

    return new Promise((resolve) => {
      if (!Array.isArray(devices)) {
        if (fDevice) {
          devices = [{ time: devices, device: fDevice }];
        } else {
          devices = [devices];
        }
      }

      if (devices.length < 1) {
        return resolve;
      }

      const query = common.knex('devices').select('token', 'user_id');

      devices.forEach((f) => {
        query.orWhere((q) => {
          q.where('token', f.device.toString())
           .where('updated_at', '<', new Date(f.time * 1000));
        });
      });

      return query.then((devicesResult) => {
        if (devicesResult.length < 1) {
          return resolve;
        }

        let promises;
        if (process.env.NODE_ENV === 'test') {
          promises = devicesResult.map((d) => {
            return common.redis.rpushAsync('yodel:unsubscribe',
              JSON.stringify(new ApnFeedbackDevice(d))
            );
          });
        } else {
          promises = devicesResult.map((d) => {
            return Device.unsubscribe(new ApnFeedbackDevice(d));
          });
        }

        return Promise.all(promises).then(resolve);
      });
    });
  };

module.exports = (() => {
  return new FeedbackService();
})();
