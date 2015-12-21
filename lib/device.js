/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

var common       = require('../common');
var randomstring = require('randomstring');
var util         = require('util');
var EventEmitter = require('events').EventEmitter;
var gcm          = require('yodel-gcm');
var apn          = require('apn');
var Promise      = require('bluebird');
var jdg          = require('jdg');
var AttributeError = require('./attribute_error');

/**
 *  Represents a device.
 *  @constructor
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 *  @param {Integer} attrs.platform - Whether the device is android (1) or ios (2)
 */
var Device = module.exports = function Device(attrs) {
  var _this = this;

  _this.attributes = {};
  if (jdg.is.present(attrs)) {
    if (jdg.is.present(attrs.id)) {
      _this.id = attrs.id;
    }
    if (jdg.is.present(attrs.send_notification_key)) {
      _this.sendNotificationKey = attrs.send_notification_key;
      delete attrs.send_notification_key;
    }
    _this.set(attrs);
  }

  EventEmitter.call(_this);

  _this.on('subscribed', _this.publishEvent);
  _this.on('unsubscribed', _this.publishEvent);
  _this.on('notified', _this.publishEvent);
};

util.inherits(Device, EventEmitter);

Device.platforms = {
  1:  'android',
  2:  'ios',

  'android':  1,
  'ios':      2
};

/**
 *  Gets an existing device and creates a new one if device is not found.
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 *  @param {Integer} attrs.platform - Whether the device is android (1) or ios (2)
 */
Device.findOrCreate = function findOrCreate(attrs) {
  var query = common.knex('devices');

  if (jdg.is.missing(attrs.id)) {
    if (jdg.is.missing(attrs.token) || jdg.is.missing(attrs.user_id)) {
      throw new Error('Can not find device. Please specify id or user_id and token');
    } else {
      query.where({
        user_id: attrs.user_id,
        token: attrs.token
      });
    }
  } else {
    query.where({id: attrs.id});
  }

  return query.limit(1).then(function(row) {
    if (row.length < 1) {
      return new Device(attrs).save();
    } else {
      return new Device(row[0]).set('updated_at', new Date()).save();
    }
  })
  .catch(common.logAndThrow);
}

/**
 *  Creates a new subscriber device
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 *  @param {Integer} attrs.platform - Whether the device is android (1) or ios (2)
 */
Device.subscribe = function subscribe(attrs) {
  return Device.findOrCreate(attrs).catch(common.logAndThrow);
}

/**
 *  Removes an existing subscriber device
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 */
Device.unsubscribe = function unsubscribe(attrs) {
  return new Device(attrs).validate().then(function(device) {
    return device.destroy();
  });
}

/**
 *  Notifies all devices belonging to a specific user
 *  @param {Object} opts - Information about the device
 *  @param {Integer} opts.user_id - The id of the user to be notified
 *  @param {String} opts.message - The message to be sent in the notification
 *  @param opts.payload
 *  @param {Boolean} opts.include_notification_key
 */
Device.notify = function notify(opts) {
  return new DeviceCollection(opts.user_id).then(function(devices) {
    if (jdg.is.missing(devices) || devices.length  < 1) {
      return;
    }

    return Promise.map(devices, function(device) {
      return device.notify(opts);
    });
  })
  .catch(common.notifyError);
}

/**
 *  Get an attribute from device.attributes.
 *  @param {String} key - The attribute to get.
 */
Device.prototype.get = function get(key) {
  if (jdg.is.present(key)) {
    return this.attributes[key];
  } else {
    return null;
  }
}

/**
 *  Set an attribute or attributes on a device.
 *  @param {String/Object} attr - Can be the attribute to set or an object
 *  of attributes and values to be set at once.
 *  @param [value] - value of attribute to be set. REQUIRED setting a single
 *  attribute.
 */
Device.prototype.set = function set(attr, value) {
  var _this = this;
  if (jdg.is.object(attr)) {
    jdg.get.keys(attr).forEach(function(key) {
      _this.attributes[key] = attr[key];
    });
  } else if (jdg.is.missing(value)) {
    throw new AttributeError(attr);
  } else {
    _this.attributes[attr] = value;
  }

  return _this;
}

/**
 *  Validates the needed attributes have been set on a device.
 */
Device.prototype.validate = function validate() {
  var _this = this;

  return Promise.try(function() {
    if (jdg.is.missing(_this.get('user_id')) || isNaN(_this.get('user_id'))) {
      throw new AttributeError('user_id');
    } else if (jdg.is.missing(_this.get('token'))) {
      throw new AttributeError('token');
    } else if (!jdg.isInArray(jdg.get.keys(Device.platforms), _this.get('platform'))) {
      throw new AttributeError('platform');
    } else {
      return _this;
    }
  });
}

/**
 * Returns the corrent save method based on whether the object's id is present.
 */
Device.prototype.saveMethod = function saveMethod() {
  var _this = this;
  if (jdg.is.present(_this.id)) {
    return _this.update(arguments);
  } else {
    return _this.create(arguments);
  }
}

/**
 *  Saves a device's current attributes to the database.
 */
Device.prototype.save = function save() {
  if (jdg.is.missing(common.knex)) {
    throw new Error('MySQL connection not established');
  }

  var _this = this;
  _this.set({
    created_at: new Date(),
    updated_at: new Date()
  });

  if (isNaN(_this.get('platform'))) {
    _this.set('platform', Device.platforms[_this.get('platform')]);
  }

  return _this.saveMethod();
}

/**
 *  Inserts a new record into devices.
 */
Device.prototype.create = function create() {
  if (jdg.is.missing(common.knex)) {
    throw new Error('MySQL connection not established');
  }

  var _this = this;
  _this.set({
    created_at: new Date(),
    updated_at: new Date()
  });

  return _this.validate().then(function() {
    return common.knex('devices').insert(_this.attributes).then(function(result) {
      return _this.emit('subscribed', 'subscribe', 'create_device');
    });
  });
}

/**
 *  Updates an existing record in devices.
 */
Device.prototype.update = function update() {
  if (jdg.is.missing(common.knex)) {
    throw new Error('MySQL connection not established');
  }

  var _this = this;
  _this.set('updated_at', new Date());

  return _this.validate().then(function() {
    return common.knex('devices').update(_this.attributes).then(function(result) {
      return _this.emit('subscribed', 'subscribe', 'update_device');
    });
  });
}

/**
 *  Deletes a record from devices.
 */
Device.prototype.destroy = function destroy() {
  if (jdg.is.missing(common.knex)) {
    throw new Error('MySQL connection not established');
  }

  var _this = this;

  if (isNaN(_this.get('platform'))) {
    _this.set('platform', Device.platforms[_this.get('platform')]);
  }

  return _this.validate().then(function() {
    return common.knex('devices').where(_this.attributes).del().then(function(rows) {
      return _this.emit('unsubscribed', 'unsubscribe', 'delete_device');
    });
  });
}

/**
 *  Publishes events to redis and updates gcm notification keys.
 *  @param {String} uAction - the gcm notification update action.
 *  @param {String} redisAction - the action of the event to be published.
 *  @listens subscribed
 *  @listens unsubscribed
 *  @listens notified
 */
Device.prototype.publishEvent = function publishEvent(uAction, redisAction) {
  var _this = this;

  return Promise.try(function() {
    if (_this.get('platform') === Device.platforms.android && jdg.is.present(uAction)) {
      return updateGcmNotificationKey({
        userId: _this.get('user_id'),
        registrationId: _this.get('token'),
        action: uAction,
        sendNotificationKey: _this.sendNotificationKey
      })
      .catch(function(err) {
        common.notifyError('Error updating GCM notification key: ' + err);
        return;
      });
    } else {
      return;
    }
  })
  .then(function() {
    return common.publishEvent({
      user_id: _this.get('user_id'),
      action: redisAction,
      platform: _this.get('platform'),
      successful: true
    });
  })
  .catch(function(err) {
    common.notifyError(err);
    return common.publishEvent({
      user_id: _this.get('user_id'),
      action: redisAction,
      platform: _this.get('platform'),
      successful: false
    });
  });
}

/**
 *  Calls the appropriate notification method for the device.
 *  @param {Object} opts - Options for the notification.
 *  @param {String} opts.message - The message to be sent in the notification.
 *  @param opts.payload
 *  @param {Boolean} opts.include_notification_key
 */
Device.prototype.notify = function notify(opts) {
  var _this = this;
  return _this.validate().then(function() {
    if (Device.platforms[_this.get('platform')] == 'ios') {
      return notifyIos(_this, opts);
    } else {
      return notifyAndroid(_this, opts);
    }
  })
  .catch(common.notifyError);
}

/** Notifies an iOS device */
function notifyIos(device, opts) {
  var tokens;
  if (Array.isArray(device)) {
    tokens = device;
  } else {
    tokens = [device.get('token')];
  }

  var apnConfig = common.config('apn', true) || {};
  if (!apnConfig.cert && !apnConfig.pfx) {
    // defaults
    apnConfig.cert = process.cwd()+"/config/cert.pem";
    if (!apnConfig.key) {
      apnConfig.key = process.cwd()+"/config/key.pem";
    }
  }
  var apnConnection = new apn.Connection(apnConfig);

  var note = new apn.Notification();
  note.badge = 1;
  note.alert = opts.message;
  note.payload = opts.payload;

  return Promise.try(function() {
    if (process.env.NODE_ENV == 'test') {
      return common.redis.rpushAsync('yodel:push', JSON.stringify(note));
    } else {
      apnConnection.pushNotification(note, tokens);
      return;
    }
  }).then(function() {
    return device.emit('notified', null, 'notify');
  });
}

/** Notifies an android device */
function notifyAndroid(device, opts) {
  var data = opts.extra || opts.payload || {};
  return Promise.try(function() {
    if (jdg.is.present(opts.include_notification_key)) {
      return common.knex('gcm_notification_users').select('notification_key').where({
        user_id: device.get('user_id')
      }).then(function(gcmResults) {
        if (jdg.is.present(gcmResults) && gcmResults.length > 0) {
          data.notification_key = gcmResults[0].notification_key;
        }
        return;
      })
      .catch(function(err) {
        common.notifyError(new Error("Error while querying for notification key: "+err));
        return;
      });
    } else {
      return;
    }
  })
  .then(function() {
    if (process.env.NODE_ENV === 'test') {
      return common.redis.rpushAsync('yodel:push', JSON.stringify(data));
    } else {
      return Promise.try(function() {
        if (common.config('gcm', true)) {
          var message = gcm.Message({data: data});
          var sender = gcm.Sender(common.config('gcm').server_api_key);

          sender.send(message, [device.get('token')], function(err, results) {
            if (jdg.is.present(err)) { throw err; }
            return device.emit('notified', null, 'notify');
          });
        } else {
          return;
        }
      });
    }
  });
};

/**
 *  Updates a gcm notification key.
 *  @param {Object} opts
 *  @param {Integer} opts.userId
 *  @param {String} opts.registrationId - the device token.
 *  @param {String} opts.action - the action to be applied.
 *  @param {Boolean} [opts.sendNotificationKey]
 */
function updateGcmNotificationKey(opts) {
  // opts:
  // userId
  // registrationId,
  // action
  // sendNotificationKey (optional)

  var isSubscribe = opts.action === 'subscribe';

  return common.knex('gcm_notification_users').where({ user_id: opts.userId })
    .then(function(results) {
      return Promise.try(function() {
        if (!results || results.length === 0) {
          if (!isSubscribe) return;

          var notificationKeyName = 'user_' + opts.userId + '_' + randomstring.generate(10);
          var operationOpts = {
                operationType: 'create',
                notificationKeyName: notificationKeyName,
                registrationIds: [opts.registrationId]
              };

          return performOperation(operationOpts).then(function(notificationKey) {
            return common.knex('gcm_notification_users').insert({
              user_id: opts.userId,
              notification_key: notificationKey,
              notification_key_name: notificationKeyName,
              created_at: new Date(),
              updated_at: new Date()
            })
            .then(function(inserts) {
              if (jdg.is.present(opts.sendNotificationKey)) {
                return notifyAndroid(opts.userId, [opts.registrationId], {notification_key: notificationKey});
              } else {
                return;
              }
            })
            .catch(function(err) {
              throw new Error('Error inserting to gcm_notification_users');
            });
          });

        } else {
          // Results exist
          var operationType;
          if (isSubscribe) {
            operationType = results[0].notification_key ? 'add' : 'create';
          } else {
            operationType = 'remove';
          }

          var operationOpts = {
            operationType: operationType,
            notificationKeyName: results[0].notification_key_name,
            notificationKey: results[0].notification_key,
            registrationIds: [opts.registrationId],
            recreateKeyIfMissing: true
          };

          return performOperation(operationOpts).then(function(notificationKey) {
            return common.knex('gcm_notification_users')
              .where({ user_id: opts.userId })
              .update({
                notification_key: notificationKey,
                updated_at: new Date()
              })
              .then(function(updateCount) {
                if (jdg.is.present(updateCount)) {
                  if (jdg.is.present(opts.sendNotificationKey)) {
                    return notifyAndroid(opts.userId, [opts.registrationId], {notification_key: notificationKey});
                  }
                }
              })
              .catch(function(err) {
                console.log(err);
                throw new Error('Unable to update a record on gcm_notification_users');
              });
          })
          .catch(function(err) {
            console.log(err);
            throw new Error('Error updating a record in gcm_notification_users');
          });
        }
      })
      .catch(function(err) {
        console.log(err);
        throw new Error('Error querying gcm_notification_users');
      });
    });
}

function performOperation(operationOpts) {
  var gcmConfig    = common.config('gcm');
  var keyOperation = new gcm.Operation(operationOpts);
  var opRunner     = new gcm.OperationRunner(gcmConfig.project_number, gcmConfig.server_api_key);

  return Promise.try(function() {
    opRunner.performOperation(keyOperation, function(err, result) {
      if (err) { throw err; }
      if (jdg.is.present(result.notification_key)) {
        return result.notification_key;
      } else {
        return 'Did not receive notification key';
      }
    });
  });
}

/**
 *  Creates a new collection of devices all belonging to the same user.
 *  @constructor
 *  @param {Integer} userId
 */
function DeviceCollection(userId) {
  return common.knex('devices').where({user_id: userId}).then(function(results) {
    return results.map(function(r) { return new Device(r); });
  });
}
