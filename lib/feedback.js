/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

var common = require('../common');
var Device = require('./device');
var apn = require('apn');
var Promise = require('bluebird');

/**
 *  Creates a feedback service to monitor APN failures.
 *  @constructor
 */
var FeedbackService = function FeedbackService() {
  var _this = this;

  _this.config = common.config('apn_feedback', true);
  _this.service = new apn.Feedback(_this.config);
  _this.service.on('feedback', _this.processApnFeedback);
};

/**
 *  Processes APN feedback returned on the 'feedback' event.
 *  @param {Array} feedbackDevices - Array of {device: {token:""}, time: #####}
 *    returned from APN Feedback Service and formatted by node-apn.
 */
FeedbackService.prototype.processApnFeedback = function processApnFeedback(feedbackDevices, fDevice) {
  return new Promise(function result(resolve) {
    if (!Array.isArray(feedbackDevices)) {
      if (fDevice) {
        feedbackDevices = [{time: feedbackDevices, device: fDevice}];
      } else {
        feedbackDevices = [feedbackDevices];
      }
    }

    if (feedbackDevices.length < 1) {
      return resolve;
    }

    var _this = this;
    var query = common.knex('devices').select('token', 'user_id');

    feedbackDevices.forEach(function(f) {
      query.orWhere(function() {
        this.where('token', f.device.toString())
            .where('updated_at', '<', new Date(f.time * 1000));
      });
    });

    return query.then(function(devices) {
      if (devices.length < 1) {
        return resolve;
      }

      var promises;
      if (process.env.NODE_ENV == 'test') {
        promises = devices.map(function(d) {
          return common.redis.rpushAsync('yodel:unsubscribe',
            JSON.stringify(new apnFeedbackDevice(d))
          );
        });
      } else {
        promises = devices.map(function(d) {
          return Device.unsubscribe(new apnFeedbackDevice(d));
        });
      }

      return Promise.all(promises).then(resolve);
    });
  });

  /**
   *  Represents a Device API useable object. Sets platform by default.
   *  @constructor
   *  @param {Object} attrs
   *  @param {String} attrs.token - A valid device token.
   *  @param {Integer} attrs.user_id - ID of user associated with device token.
   */
  function apnFeedbackDevice(attrs) {
    this.token = attrs.token;
    this.user_id = attrs.user_id;
    this.platform = 'ios';
  };
};

module.exports = (function() {
  return new FeedbackService();
})();
