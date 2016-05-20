/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

'use strict';

const common = require('../common');
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const jdg = require('jdg');
const AttributeError = require('./attribute_error');
const GCMHelper = require('./gcm_helper');
const APNHelper = require('./apn_helper');

const devicePlatforms = {
  1: 'android',
  2: 'ios',
  android: 1,
  ios: 2,
};

/**
 *  Represents a device.
 *  @constructor
 *  @param {Object} attrs - Information about the device
 *  @param {String} attrs.token - The device token
 *  @param {Integer} attrs.user_id - The id of the device's user
 *  @param {Integer} attrs.platform - Whether the device is android (1) or ios (2)
 */

module.exports = class Device extends EventEmitter {
  constructor(attrs) {
    const attrsToSet = attrs;
    super();

    this.attributes = {};
    if (jdg.is.present(attrs)) {
      if (jdg.is.present(attrs.id)) {
        this.id = attrs.id;
      }
      if (jdg.is.present(attrs.send_notification_key)) {
        this.sendNotificationKey = attrs.send_notification_key;
        delete attrsToSet.send_notification_key;
      }
      this.set(attrsToSet);
    }

    this.on('subscribed', this.publishEvent);
    this.on('unsubscribed', this.publishEvent);
    this.on('notified', this.publishEvent);
  }

  /**
   *  Gets an existing device or returns null if one is not found.
   *  @param {Object} attrs - Information about the device * requires either id
   *  or user_id AND token
   */
  static find(attrs) {
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
        if (results.length < 1) { return null; }
        return new Device(results[0]);
      });
    });
  }

  /**
   *  Gets an existing device and creates a new one if device is not found.
   *  @param {Object} attrs - Information about the device
   *  @param {String} attrs.token - The device token
   *  @param {Integer} attrs.user_id - The id of the device's user
   *  @param {Integer} attrs.platform - Whether the device is android (1) or ios (2)
   */
  static subscribe(attrs) {
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

    return query.first().then((row) => {
      if (row) { return new Device(row); }
      return new Device(attrs).save();
    });
  }

  /**
   *  Removes an existing subscriber device
   *  @param {Object} attrs - Information about the device
   *  @param {String} attrs.token - The device token
   *  @param {Integer} attrs.user_id - The id of the device's user
   */
  static unsubscribe(attrs) {
    return Device.find(attrs).then(device => {
      if (device) { return device.destroy(); }
      return null;
    });
  }

  static findForUserId(userId) {
    return common.knex('devices').where({ user_id: userId })
      .then(results => results.map(r => new Device(r)));
  }

  /**
   *  Notifies all devices belonging to a specific user
   *  @param {Object} opts - Information about the device
   *  @param {Integer} opts.user_id - The id of the user to be notified
   *  @param {String} opts.message - The message to be sent in the notification
   *  @param opts.payload
   *  @param {Boolean} opts.include_notification_key
   */
  static notify(opts) {
    return this.findForUserId(opts.user_id).then(devices => {
      if (devices.length < 1) { return null; }
      return Promise.map(devices, (device) => device.notify(opts));
    });
  }


  /**
   *  Get an attribute from device.attributes.
   *  @param {String} key - The attribute to get.
   */
  get(key) {
    return this.attributes[key];
  }

  set(attr, value) {
    if (typeof attr === 'object') {
      jdg.get.keys(attr).forEach(key => {
        this.attributes[key] = attr[key];
      });
    } else if (typeof value === 'undefined') {
      throw new AttributeError(attr);
    } else {
      this.attributes[attr] = value;
    }
    return this;
  }

  validate() {
    return Promise.try(() => {
      if (!this.get('user_id') || isNaN(this.get('user_id'))) {
        throw new AttributeError('user_id');
      } else if (!this.get('token')) {
        throw new AttributeError('token');
      } else if (!devicePlatforms[this.get('platform')] || isNaN(this.get('platform'))) {
        throw new AttributeError('platform');
      } else {
        return this;
      }
    });
  }

  /**
   *  Returns truthy if the device's platform matches the given string.
   *  @param {String} platform The platform to compare to
   */
  platformIs(platform) {
    if (this.get('platform') === platform) {
      return true;
    } else if (this.get('platform') === devicePlatforms[platform]) {
      return true;
    }
    return false;
  }

  save() {
    if (isNaN(this.get('platform'))) {
      this.set('platform', devicePlatforms[this.get('platform')]);
    }
    if (this.id) {
      this.update();
    } else {
      this.create();
    }
  }

  create() {
    const now = new Date();
    this.set({ created_at: now, updated_at: now });

    return this.validate().then(() =>
      common.knex('devices').insert(this.attributes).then(() =>
        this.emit('subscribed', 'subscribe', 'create_device')
      )
    );
  }

  update() {
    const now = new Date();
    this.set({ updated_at: now });

    const updateQuery = common.knex('devices')
                              .where({ id: this.id })
                              .update(this.attributes);

    return this.validate().then(() =>
      updateQuery.then(() =>
        this.emit('subscribed', 'subscribe', 'update_device')
      )
    );
  }

  destroy() {
    const deleteQuery = common.knex('devices')
                              .where({ id: this.id })
                              .del();

    return this.validate().then(() =>
      deleteQuery.then(() =>
        this.emit('unsubscribed', 'unsubscribe', 'delete_device')
      )
    );
  }

  /**
   *  Publishes events to redis and updates gcm notification keys.
   *  @param {String} updateAction - the gcm notification update action.
   *  @param {String} redisAction - the action of the event to be published.
   *  @listens subscribed
   *  @listens unsubscribed
   *  @listens notified
   */
  publishEvent(updateAction, redisAction) {
    return Promise.try(() => {
      if (this.platformIs('android') && updateAction) {
        return GCMHelper.updateNotificationKey({
          userId: this.get('user_id'),
          registrationId: this.get('token'),
          action: updateAction,
          sendNotificationKey: this.sendNotificationKey,
        });
      }
      return null;
    })
    .then(() => common.publishEvent({
      user_id: this.get('user_id'),
      action: redisAction,
      platform: this.get('platform'),
      successful: true,
    }))
    .catch((err) => {
      common.notifyError(err);
      return common.publishEvent({
        user_id: this.get('user_id'),
        action: redisAction,
        platform: this.get('platform'),
        successful: false,
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
  notify(opts) {
    return this.validate().then(() => {
      if (this.platformIs('ios')) {
        return APNHelper.notifyIos(this, opts);
      }
      return GCMHelper.notifyAndroid(this, opts);
    });
  }
};
