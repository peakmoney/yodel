/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

'use strict';

const common = require('../common');
const Device = require('./device');
const apn = require('apn');
const Promise = require('bluebird');
const APNFeedbackDevice = require('./apn_feedback_device');

module.exports = class FeedbackService {
  constructor() {
    this.config = common.config('apn_feedback', true);
    this.service = new apn.Feedback(this.config);
    this.service.on('feedback', this.processApnFeedback);
  }

  /**
   *  Processes APN feedback returned on the 'feedback' event.
   *  @param {Array} feedbackDevices - Array of {device: {token:""}, time: #####}
   *    returned from APN Feedback Service and formatted by node-apn.
   */
  processApnFeedback(arg1, arg2) {
    let feedbackDevices = arg1;
    if (!Array.isArray(feedbackDevices)) {
      if (arg2) {
        feedbackDevices = [{ time: arg1, device: arg2 }];
      } else {
        feedbackDevices = [arg1];
      }
    }

    if (feedbackDevices.length < 1) {
      return Promise.resolve();
    }

    const query = common.knex('devices').select('token', 'user_id');

    feedbackDevices.forEach((f) => {
      query.orWhere(function matchesDevice() {
        this.where('token', f.device.toString())
            .where('updated_at', '<', new Date(f.time * 1000));
      });
    });

    return query.then(devices => {
      if (devices.length < 1) {
        return Promise.resolve();
      }

      if (process.env.NODE_ENV === 'test') {
        return Promise.all(devices.map(d =>
          common.redis.rpushAsync('yodel:unsubscribe',
            JSON.stringify(new APNFeedbackDevice(d)))
        ));
      }
      return Promise.all(devices.map(d =>
        Device.unsubscribe(new APNFeedbackDevice(d))));
    });
  }
};
