/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

var common  = require('../common');
var Device = require('./device');
var apn     = require('apn');
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
FeedbackService.prototype.processApnFeedback = function processApnFeedback(feedbackDevices) {
  var _this = this;
  var query = common.knex('devices').select('token', 'user_id');

  feedbackDevices.forEach(function(f) {
    query.orWhere(function() {
      this.where('token', f.device.toString())
          .where('updated_at', '<', new Date(f.time * 1000));
    });
  });

  return query.then(function(devices) {
    if (devices.length > 0) {
      var promises;
      if (process.env.NODE_ENV == 'test') {
        promises = devices.map(function(d) {
          return common.redis.rpushAsync('yodel:unsubscribe',
            JSON.stringify(new apnFeedbackDevice(d))
          );
        });
      } else {
        promises = devices.map(function(d) {
          return Device.unsubscribe({
            user_id: d.user_id,
            token: d.token
          });
        });
      }

      return Promise.all(promises);
    } else {
      return;
    }
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
