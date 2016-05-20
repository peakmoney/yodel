/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

'use strict';

const common = require('../common');
const apn = require('apn');

module.exports = class APNHelper {
  static notifyIos(device, opts) {
    const tokens = [device.get('token')];
    const apnConnection = new apn.Connection(common.config.apn);
    const apnNotification = new apn.Notification();
    apnNotification.badge = 1;
    apnNotification.alert = opts.message;
    apnNotification.payload = opts.payload;

    return Promise.try(() => {
      if (process.env.NODE_ENV === 'test') {
        return common.redis.rpushAsync('yodel:push', JSON.stringify(apnNotification));
      }
      return apnConnection.pushNotification(apnNotification, tokens);
    }).then(() => device.emit('notified', null, 'notify'));
  }
};
