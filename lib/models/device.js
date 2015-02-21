var common = require('../../common')
  , knex   = common.knex
  , redis  = common.newRedisClient('redis')
  , gcm    = require('../../../node-gcm')
  , apn    = require('apn');


var DeviceModel = module.exports = function(attrs){
  for (var k in attrs) {
    this[k] = attrs[k];
  }
};


DeviceModel.platforms = {
  1: 'android'
, 2: 'ios'

, 'android': 1
, 'ios':     2
};


DeviceModel.subscribe = function(opts, callback) {
  if (!opts.user_id || isNaN(opts.user_id)) {
    return callback("Invalid or missing option: user_id");
  } else if (!opts.token) {
    return callback("Invalid or missing option: token");
  } else if (!opts.platform || ['android','ios'].indexOf(opts.platform) == -1) {
    return callback("Invalid or missing option: platform");
  } else if (!knex) {
    return callback("MySQL connection not established");
  } else {
    knex('devices')
      .where({
        user_id: opts.user_id,
        token: opts.token })
      .update({
        updated_at: new Date()
      })
      .then(function(rowCount) {
        if (rowCount === 0) {
          knex('devices').insert({
            user_id: opts.user_id,
            token: opts.token,
            platform: DeviceModel.platforms[opts.platform],
            created_at: new Date(),
            updated_at: new Date()
          })
          .then(function(inserts) {
            if (opts.platform === 'android') {
              updateGcmNotificationKey({userId: opts.user_id, token: opts.token
                , action: 'subscribe', notificationKey: opts.send_notification_key}, function(err) {
                if (err) common.notifyError('Error updating GCM notification key: ' + err);
                common.publishEvent({user_id: opts.user_id, action: 'create_device'
                  , platform: opts.platform, successful: !err}, callback);
              });
            } else {
              common.publishEvent({user_id: opts.user_id, action: 'create_device'
                , platform: opts.platform, successful: true}, callback);
            }
          }).catch(function(err) {
            common.publishEvent({user_id: opts.user_id, action: 'create_device'
              , platform: opts.platform, successful: false}, function() {
              return callback(err);
            });
          });
        } else {
          common.publishEvent({user_id: opts.user_id, action: 'update_device'
            , platform: opts.platform, successful: true}, callback);
        }
      })
      .catch(function(err) {
        common.publishEvent({user_id: opts.user_id, action: 'update_device'
          , platform: opts.platform, successful: false}, function() {
          return callback(err);
        });
      });
  }
}


DeviceModel.unsubscribe = function(opts, callback) {
  if (!opts.user_id || isNaN(opts.user_id)) {
    return callback("Invalid or missing option: user_id");
  } else if (!opts.token) {
    return callback("Invalid or missing option: token");
  } else if (!opts.platform || ['android','ios'].indexOf(opts.platform) == -1) {
    return callback("Invalid or missing option: platform");
  } else if (!knex) {
    return callback("MySQL connection not established");
  } else {
    knex('devices')
      .where({
        user_id: opts.user_id,
        token: opts.token })
      .del()
      .then(function(rows) {
        if (opts.platform === 'android') {
          updateGcmNotificationKey({userId: opts.user_id
            , token: opts.token, action: 'unsubscribe'}, function(err) {
            if (err) common.notifyError('Error updating GCM notification key: ' + err);
            common.publishEvent({user_id: opts.user_id, action: 'delete_device'
              , platform: opts.platform, successful: !err}, callback);
          });
        } else {
          common.publishEvent({user_id: opts.user_id, action: 'delete_device'
            , platform: opts.platform, successful: true}, callback);
        }
      })
      .catch(function(err) {
        common.publishEvent({user_id: opts.user_id, action: 'delete_device'
          , platform: opts.platform, successful: false}, function() {
          return callback(err);
        });
      });
  }
}


DeviceModel.notify = function(opts, callback) {
  if (!opts.user_id || isNaN(opts.user_id)) {
    return callback("Invalid or missing option: user_id");
  } else if (!opts.message || typeof opts.message !== 'string') {
    return callback("Invalid or missing option: message");
  } else if (!opts.payload) {
    return callback("Invalid or missing option: payload");
  } else if (!knex) {
    return callback("MySQL connection not established");
  } else {
    knex.select()
      .from('devices')
      .where({
        user_id: opts.user_id
      })
      .then(function(results) {

        if (!results || results.length < 1) { return callback(); }

        var androidDevices = []
          , iosDevices     = [];

        results.forEach(function(device) {
          if (device.platform == DeviceModel.platforms['android']) {
            androidDevices.push(device);
          } else if (device.platform == DeviceModel.platforms['ios']) {
            iosDevices.push(device);
          } else {
            common.notifyError(new Error("Invalid platform: "+device.platform));
          }
        });

        notifyIos(results, opts.message, opts.payload, function(err) {
          if (err) { common.notifyError(err); }
          if (opts.include_notification_key) {
            knex.select('notification_key')
            .from('gcm_notification_users')
            .limit(1)
            .where({
              user_id: opts.user_id
            }).then(function(userResult) {
              notifyAndroid(notificationKey, opts.extra || opts.payload, 
                userResult ? userResult.notification_key : null, callback);
            }).catch(function(err) {
              // Send the notification regardless of notification key query failure
              notifyAndroid(notificationKey, opts.extra || opts.payload, null, callback);
              common.notifyError(new Error("Error while querying for notification key: "+err));
            });
          } else {
            notifyAndroid(notificationKey, opts.extra || opts.payload, null, callback);
          }
        });
      })
      .catch(function(err) {
        return callback(err);
      })
  }

  function notifyIos(devices, message, payload, callback) {
    if (!devices) { return callback(); }

    var apnConfig = common.config('apn', true) || {};
    if (!apnConfig.cert && !apnConfig.pfx) {
      // defaults
      apnConfig.cert = process.cwd()+"/config/cert.pem";
      if (!apnConfig.key) {
        apnConfig.key = process.cwd()+"/config/key.pem";
      }
    }
    var apnConnection = new apn.Connection(apnConfig);

    devices.forEach(function(device) {
      var apnDevice = new apn.Device(device.token);
      var note = new apn.Notification();
      note.badge = 1;
      note.alert = message;
      note.payload = payload;
      if (process.env.NODE_ENV == 'test') {
        common.redis.rpush("yodel:push", JSON.stringify(note));
      } else {
        apnConnection.pushNotification(note, apnDevice);
        common.publishEvent({user_id: opts.user_id, action: 'notify'
          , platform: 'ios', successful: true}, callback);
      }
    });

    return callback();
  }

  function notifyAndroid(registrationIds, data, notificationKey, callback) {
    if (!registrationIds || !registrationIds.length) { return callback(); }

    if (process.env.NODE_ENV == 'test') {
      common.redis.rpush("yodel:push", JSON.stringify(data));
    } else if (common.config('gcm', true)) {

      if (notificationKey) {
        // Inject the notification key into the data object if provided
        data.notification_key = notificationKey;
      }

      var message = new gcm.Message({data: data})
        , sender  = new gcm.Sender(common.config('gcm').server_api_key);

      sender.send(message, registrationIds, function(err, results) {
        common.publishEvent({user_id: opts.user_id, action: 'notify'
          , platform: 'android', successful: !err}, callback);
      });
    } else {
      return callback();
    }
  }  
}

function updateGcmNotificationKey(opts, callback) {
  // opts:
  // userId
  // registrationId,
  // action
  // sendNotificationKey (optional)

  redis.get('yodel:gcmusers:' + opts.userId, function(err, notificationKey) {
    if (err) common.notifyError('Error retrieving notification key: ' + err);

    var operationType;
    var isSubscribe = opts.action === 'subscribe';
    if (isSubscribe) operationType = notificationKey ? 'add' : 'create';
    else operationType = 'remove';

    var operationOpts = {
      operationType: operationType
    , notificationKeyName: opts.userId.toString()
    , notificationKey: notificationKey
    , registrationIds: [opts.registrationId]
    , recreateKeyIfMissing: true
    };

    var gcmConfig    = common.config('gcm')
      , keyOperation = new gcm.Operation(operationOpts)
      , opRunner     = new gcm.OperationRunner(gcmConfig.project_number, gcmConfig.server_api_key);

    opRunner.performOperation(keyOperation, function(err, result) {
      if (err) return callback(err);
      if (result.notification_key) {
        redis.set('yodel:gcmusers:' + opts.userId, result.notification_key, function(err, data) {
          callback(err);
        });
        if (isSubscribe && opts.sendNotificationKey) {
          notifyAndroid([opts.registrationId], {}, result.notification_key, callback);
        } else {
          callback();
        }
      } else {
        callback('Did not receive notification key');
      }
    });
  });
}






