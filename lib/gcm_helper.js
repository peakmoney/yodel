/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

'use strict';

const common = require('../common');
const randomstring = require('randomstring');
const gcm = require('yodel-gcm');

module.exports = class GCMHelper {
  /**
   *  Updates a GCM notification key.
   *  @param {Object} opts
   *  @param {Integer} opts.userId
   *  @param {String} opts.registrationId - the device token.
   *  @param {String} opts.action - the action to be applied.
   *  @param {Boolean} [opts.sendNotificationKey]
   */
  static updateNotificationKey(opts) {
    const isSubscribe = opts.action === 'subscribe';

    const query = common.knex('gcm_notification_users')
                        .where({ user_id: opts.userId });

    return query.then((gcmNotificationUsers) => {
      if (gcmNotificationUsers.length < 1) {
        if (!isSubscribe) { return null; }

        const notificationKeyName = `user_${opts.userId}_${randomstring.generate(10)}`;
        const operationOpts = {
          operationType: 'create',
          notificationKeyName,
          registrationIds: [opts.registrationId],
        };

        return this.performOperation(operationOpts).then((notificationKey) => {
          const now = new Date();
          return common.knex('gcm_notification_users').insert({
            user_id: opts.userId,
            notification_key: notificationKey,
            notification_key_name: notificationKeyName,
            created_at: now,
            updated_at: now,
          })
          .then(() => {
            if (opts.sendNotificationKey) {
              return this.notifyAndroid(opts.userId, [opts.registrationId],
                { notification_key: notificationKey });
            }
            return null;
          })
          .catch((err) => {
            throw new Error(`Error inserting to gcm_notification_users: ${err}`);
          });
        });
      }

      let operationType;
      if (isSubscribe) {
        operationType = gcmNotificationUsers[0].notification_key ? 'add' : 'create';
      } else {
        operationType = 'remove';
      }

      const operationOpts = {
        operationType,
        notificationKeyName: gcmNotificationUsers[0].notification_key_name,
        notificationKey: gcmNotificationUsers[0].notification_key,
        registrationIds: [opts.registrationId],
        recreateKeyIfMissing: true,
      };

      return this.performOperation(operationOpts).then(notificationKey => {
        const gcmUpdateQuery = common.knex('gcm_notification_users')
                                     .where({ user_id: opts.userId })
                                     .update({
                                       notification_key: notificationKey,
                                       updated_at: new Date(),
                                     });

        return gcmUpdateQuery.then(updateCount => {
          if (updateCount && opts.sendNotificationKey) {
            return this.notifyAndroid(opts.userId, [opts.registrationId],
              { notification_key: notificationKey });
          }
          return null;
        });
      });
    });
  }

  static performOperation(operationOpts) {
    const gcmConfig = common.config('gcm');
    const keyOperation = new gcm.Operation(operationOpts);
    const opRunner = new gcm.OperationRunner(
      gcmConfig.project_number, gcmConfig.server_api_key);

    return new Promise((resolve, reject) => {
      opRunner.performOperation(keyOperation, (err, result) => {
        if (err) { return reject(err); }
        if (result.notification_key) {
          return resolve(result.notification_key);
        }
        return reject('Did not receive notification key');
      });
    });
  }

  static notifyAndroid(device, opts) {
    const data = opts.extra || opts.payload || {};
    return Promise.try(() => {
      if (!opts.include_notification_key) { return null; }
      const nkQuery = common.knex('gcm_notification_users')
                            .select('notification_key')
                            .where({ user_id: device.get('user_id') });

      return nkQuery.then((gcmResults) => {
        if (gcmResults.length > 0) {
          data.notification_key = gcmResults[0].notification_key;
        }
        return null;
      });
    })
    .then(() => {
      if (process.env.NODE_ENV === 'test') {
        return common.redis.rpushAsync('yodel:push', JSON.stringify(data));
      }
      return new Promise((resolve, reject) => {
        if (common.config('gcm', true)) {
          const message = gcm.Message({ data: data });
          const sender = gcm.Sender(common.config('gcm').server_api_key);

          return sender.send(message, [device.get('token')], (err) => {
            if (err) { return reject(err); }
            return resolve(device.emit('notified', null, 'notify'));
          });
        }
        return resolve();
      });
    });
  }
};
