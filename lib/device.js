/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

const common = require('../common');
const randomstring = require('randomstring');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const gcm = require('yodel-gcm');
const apn = require('apn');
const Promise = require('bluebird');
const jdg = require('jdg');
const AttributeError = require('./attribute_error');


/** Notifies an iOS device */
function notifyIos(device, opts) {
  let tokens;
  if (Array.isArray(device)) {
    tokens = device;
  } else {
    tokens = [device.get('token')];
  }

  const apnConfig = common.config('apn', true) || {};
  if (!apnConfig.cert && !apnConfig.pfx) {
    // defaults
    apnConfig.cert = `${process.cwd()}/config/cert.pem`;
    if (!apnConfig.key) {
      apnConfig.key = `${process.cwd()}/config/key.pem`;
    }
  }
  const apnConnection = new apn.Connection(apnConfig);

  const note = new apn.Notification();
  note.badge = 1;
  note.alert = opts.message;
  note.payload = opts.payload;

  return Promise.try(() => {
    if (process.env.NODE_ENV === 'test') {
      return common.redis.rpushAsync('yodel:push', JSON.stringify(note));
    }
    apnConnection.pushNotification(note, tokens);
    return null;
  }).then(() => {
    return device.emit('notified', null, 'notify');
  });
}

/** Notifies an android device */
function notifyAndroid(device, opts) {
  const data = opts.extra || opts.payload || {};
  return Promise.try(() => {
    if (jdg.is.present(opts.include_notification_key)) {
      return common.knex('gcm_notification_users').select('notification_key').where({
        user_id: device.get('user_id'),
      }).then((gcmResults) => {
        if (jdg.is.present(gcmResults) && gcmResults.length > 0) {
          data.notification_key = gcmResults[0].notification_key;
        }
        return;
      })
      .catch((err) => {
        common.notifyError(new Error(`Error while querying for notification key: ${err}`));
        return;
      });
    }
    return null;
  })
  .then(() => {
    if (process.env.NODE_ENV === 'test') {
      return common.redis.rpushAsync('yodel:push', JSON.stringify(data));
    }
    return Promise.try(() => {
      if (common.config('gcm', true)) {
        // eslint-disable-next-line
        const message = gcm.Message({ data });
        // eslint-disable-next-line 
        const sender = gcm.Sender(common.config('gcm').server_api_key);

        sender.send(message, [device.get('token')], (err) => {
          if (jdg.is.present(err)) { throw err; }
          return device.emit('notified', null, 'notify');
        });
      } else {
        return;
      }
    });
  });
}

function performOperation(operationOpts) {
  const gcmConfig = common.config('gcm');
  const keyOperation = new gcm.Operation(operationOpts);
  const opRunner = new gcm.OperationRunner(gcmConfig.project_number, gcmConfig.server_api_key);

  return Promise.try(() => {
    opRunner.performOperation(keyOperation, (err, result) => {
      if (err) { throw err; }
      if (jdg.is.present(result.notification_key)) {
        return result.notification_key;
      }
      return 'Did not receive notification key';
    });
  });
}

/**
 *  Updates a gcm notification key.
 *  @param {Object} opts
 *  @param {Integer} opts.userId
 *  @param {String} opts.registrationId - the device token.
 *  @param {String} opts.action - the action to be applied.
 *  @param {Boolean} [opts.sendNotificationKey]
 */
function updateGcmNotificationKey(opts) {
  const isSubscribe = opts.action === 'subscribe';

  return common.knex('gcm_notification_users').where({ user_id: opts.userId })
    .then((results) => {
      return Promise.try(() => {
        if (!results || results.length === 0) {
          if (!isSubscribe) return null;

          const notificationKeyName = `user_${opts.userId}_${randomstring.generate(10)}`;
          const operationOpts = {
            operationType: 'create',
            notificationKeyName,
            registrationIds: [opts.registrationId],
          };

          return performOperation(operationOpts).then((notificationKey) => {
            return common.knex('gcm_notification_users').insert({
              user_id: opts.userId,
              notification_key: notificationKey,
              notification_key_name: notificationKeyName,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .then(() => {
              if (jdg.is.present(opts.sendNotificationKey)) {
                return notifyAndroid(opts.userId, [opts.registrationId],
                { notification_key: notificationKey });
              }
              return null;
            })
            .catch(() => {
              throw new Error('Error inserting to gcm_notification_users');
            });
          });
        }
        // Results exist
        let operationType;
        if (isSubscribe) {
          operationType = results[0].notification_key ? 'add' : 'create';
        } else {
          operationType = 'remove';
        }

        const operationOpts = {
          operationType,
          notificationKeyName: results[0].notification_key_name,
          notificationKey: results[0].notification_key,
          registrationIds: [opts.registrationId],
          recreateKeyIfMissing: true,
        };

        return performOperation(operationOpts).then((notificationKey) => {
          return common.knex('gcm_notification_users')
            .where({ user_id: opts.userId })
            .update({
              notification_key: notificationKey,
              updated_at: new Date(),
            })
            .then((updateCount) => {
              if (jdg.is.present(updateCount)) {
                if (jdg.is.present(opts.sendNotificationKey)) {
                  return notifyAndroid(opts.userId, [opts.registrationId],
                    { notification_key: notificationKey });
                }
                return null;
              }
              return null;
            })
            .catch((err) => {
              console.log(err);
              throw new Error('Unable to update a record on gcm_notification_users');
            });
        })
        .catch((err) => {
          console.log(err);
          throw new Error('Error updating a record in gcm_notification_users');
        });
      })
      .catch((err) => {
        console.log(err);
        throw new Error('Error querying gcm_notification_users');
      });
    });
}

/**
 *  Represents a device.
 *  @constructor
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 *  @param {Integer} attrs.platform - Whether the device is android (1) or ios (2)
 */
const Device = module.exports = function Device(attrs) {
  const deviceAttrs = attrs;

  this.attributes = {};
  if (jdg.is.present(attrs)) {
    if (jdg.is.present(attrs.id)) {
      this.id = attrs.id;
    }
    if (jdg.is.present(attrs.send_notification_key)) {
      this.sendNotificationKey = attrs.send_notification_key;
      delete deviceAttrs.send_notification_key;
    }
    this.set(deviceAttrs);
  }

  EventEmitter.call(this);

  this.on('subscribed', this.publishEvent);
  this.on('unsubscribed', this.publishEvent);
  this.on('notified', this.publishEvent);
};

util.inherits(Device, EventEmitter);

Device.platforms = {
  1: 'android',
  2: 'ios',
  android: 1,
  ios: 2,
};

/**
 *  Creates a new collection of devices all belonging to the same user.
 *  @constructor
 *  @param {Integer} userId
 */
function DeviceCollection(userId) {
  return common.knex('devices').where({ user_id: userId }).then((results) => {
    return results.map((r) => { return new Device(r); });
  });
}

/**
 *  Gets an existing device or returns null if one is not found.
 *  @param {Object} attrs - Information about the device * requires either id
 *  or user_id AND token
 */
Device.find = function find(attrs) {
  const query = common.knex('devices');

  return Promise.try(() => {
    if (attrs.id) {
      query.where('id', attrs.id);
    } else if (attrs.user_id && attrs.token) {
      query.where({
        user_id: attrs.user_id,
        token: attrs.token,
      });
    } else {
      throw new Error('Must provide id or user_id and token to find a device');
    }

    return query.limit(1).then((results) => {
      if (results.length < 1) {
        return null;
      }

      return new Device(results[0]);
    });
  });
};

/**
 *  Gets an existing device and creates a new one if device is not found.
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 *  @param {Integer} attrs.platform - Whether the device is android (1) or ios (2)
 */
Device.findOrCreate = function findOrCreate(attrs) {
  const query = common.knex('devices');

  if (jdg.is.missing(attrs.id)) {
    if (jdg.is.missing(attrs.token) || jdg.is.missing(attrs.user_id)) {
      throw new Error('Can not find device. Please specify id or user_id and token');
    } else {
      query.where({
        user_id: attrs.user_id,
        token: attrs.token,
      });
    }
  } else {
    query.where({ id: attrs.id });
  }

  return query.limit(1).then((row) => {
    if (row.length < 1) {
      return new Device(attrs).save();
    }
    return new Device(row[0]);
  })
  .catch(common.logAndThrow);
};

/**
 *  Creates a new subscriber device
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 *  @param {Integer} attrs.platform - Whether the device is android (1) or ios (2)
 */
Device.subscribe = function subscribe(attrs) {
  return Device.findOrCreate(attrs).catch(common.logAndThrow);
};

/**
 *  Removes an existing subscriber device
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 */
Device.unsubscribe = function unsubscribe(attrs) {
  return Device.find(attrs).then((device) => {
    if (device) {
      return device.destroy();
    }
    return null;
  });
};

/**
 *  Notifies all devices belonging to a specific user
 *  @param {Object} opts - Information about the device
 *  @param {Integer} opts.user_id - The id of the user to be notified
 *  @param {String} opts.message - The message to be sent in the notification
 *  @param opts.payload
 *  @param {Boolean} opts.include_notification_key
 */
Device.notify = function notify(opts) {
  return new DeviceCollection(opts.user_id).then((devices) => {
    if (jdg.is.missing(devices) || devices.length < 1) {
      return null;
    }

    return Promise.map(devices, (device) => {
      return device.notify(opts);
    });
  })
  .catch(common.notifyError);
};

/**
 *  Get an attribute from device.attributes.
 *  @param {String} key - The attribute to get.
 */
Device.prototype.get = function get(key) {
  if (jdg.is.present(key)) {
    return this.attributes[key];
  }
  return null;
};

/**
 *  Set an attribute or attributes on a device.
 *  @param {String/Object} attr - Can be the attribute to set or an object
 *  of attributes and values to be set at once.
 *  @param [value] - value of attribute to be set. REQUIRED setting a single
 *  attribute.
 */
Device.prototype.set = function set(attr, value) {
  if (jdg.is.object(attr)) {
    jdg.get.keys(attr).forEach((key) => {
      this.attributes[key] = attr[key];
    });
  } else if (jdg.is.missing(value)) {
    throw new AttributeError(attr);
  } else {
    this.attributes[attr] = value;
  }

  return this;
};

/**
 *  Validates the needed attributes have been set on a device.
 */
Device.prototype.validate = function validate() {
  return Promise.try(() => {
    if (jdg.is.missing(this.get('user_id')) || isNaN(this.get('user_id'))) {
      throw new AttributeError('user_id');
    } else if (jdg.is.missing(this.get('token'))) {
      throw new AttributeError('token');
    } else if (!jdg.isInArray(jdg.get.keys(Device.platforms), this.get('platform'))) {
      throw new AttributeError('platform');
    } else {
      return this;
    }
  });
};

/**
 *  Returns truthy if the device's platform matches the given string.
 *  @param {String} platform The platform to compare to
 */
Device.prototype.platformIs = function platformIs(platform) {
  if (this.get('platform') === platform) {
    return true;
  } else if (this.get('platform') === Device.platforms[platform]) {
    return true;
  }
  return false;
};

/**
 * Returns the corrent save method based on whether the object's id is present.
 */
Device.prototype.saveMethod = function saveMethod() {
  if (jdg.is.present(this.id)) {
    return this.update();
  }
  return this.create();
};

/**
 *  Saves a device's current attributes to the database.
 */
Device.prototype.save = function save() {
  if (jdg.is.missing(common.knex)) {
    throw new Error('MySQL connection not established');
  }

  if (isNaN(this.get('platform'))) {
    this.set('platform', Device.platforms[this.get('platform')]);
  }

  return this.saveMethod();
};

/**
 *  Inserts a new record into devices.
 */
Device.prototype.create = function create() {
  if (jdg.is.missing(common.knex)) {
    throw new Error('MySQL connection not established');
  }

  this.set({
    created_at: new Date(),
    updated_at: new Date(),
  });

  return this.validate().then(() => {
    return common.knex('devices').insert(this.attributes).then(() => {
      return this.emit('subscribed', 'subscribe', 'create_device');
    });
  });
};

/**
 *  Updates an existing record in devices.
 */
Device.prototype.update = function update() {
  if (jdg.is.missing(common.knex)) {
    throw new Error('MySQL connection not established');
  }

  this.set('updated_at', new Date());

  return this.validate().then(() => {
    return common.knex('devices').update(this.attributes).then(() => {
      return this.emit('subscribed', 'subscribe', 'update_device');
    });
  });
};

/**
 *  Deletes a record from devices.
 */
Device.prototype.destroy = function destroy() {
  if (jdg.is.missing(common.knex)) {
    throw new Error('MySQL connection not established');
  }
  if (isNaN(this.get('platform'))) {
    this.set('platform', Device.platforms[this.get('platform')]);
  }

  return this.validate().then(() => {
    return common.knex('devices').where(this.attributes).del().then(() => {
      return this.emit('unsubscribed', 'unsubscribe', 'delete_device');
    });
  });
};

/**
 *  Publishes events to redis and updates gcm notification keys.
 *  @param {String} uAction - the gcm notification update action.
 *  @param {String} redisAction - the action of the event to be published.
 *  @listens subscribed
 *  @listens unsubscribed
 *  @listens notified
 */
Device.prototype.publishEvent = function publishEvent(uAction, redisAction) {
  return Promise.try(() => {
    if (this.platformIs('android') && jdg.is.present(uAction)) {
      return updateGcmNotificationKey({
        userId: this.get('user_id'),
        registrationId: this.get('token'),
        action: uAction,
        sendNotificationKey: this.sendNotificationKey,
      })
      .catch((err) => {
        common.notifyError(`Error updating GCM notification key: ${err}`);
        return null;
      });
    }
    return null;
  })
  .then(() => {
    return common.publishEvent({
      user_id: this.get('user_id'),
      action: redisAction,
      platform: this.get('platform'),
      successful: true,
    });
  })
  .catch((err) => {
    common.notifyError(err);
    return common.publishEvent({
      user_id: this.get('user_id'),
      action: redisAction,
      platform: this.get('platform'),
      successful: false,
    });
  });
};

/**
 *  Calls the appropriate notification method for the device.
 *  @param {Object} opts - Options for the notification.
 *  @param {String} opts.message - The message to be sent in the notification.
 *  @param opts.payload
 *  @param {Boolean} opts.include_notification_key
 */
Device.prototype.notify = function notify(opts) {
  return this.validate().then(() => {
    if (this.platformIs('ios')) {
      return notifyIos(this, opts);
    }
    return notifyAndroid(this, opts);
  })
  .catch(common.notifyError);
};

