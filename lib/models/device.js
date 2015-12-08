var common       = require('../../common');
var knex         = common.knex;
var randomstring = require('randomstring');
var gcm          = require('yodel-gcm');
var apn          = require('apn');
var Promise      = require('bluebird');


var DeviceModel = module.exports = function(attrs){
  for (var k in attrs) {
    this[k] = attrs[k];
  }
};


DeviceModel.platforms = {
  1: 'android',
  2: 'ios',

  'android': 1,
  'ios':     2
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
              updateGcmNotificationKey({userId: opts.user_id, registrationId: opts.token
                , action: 'subscribe', sendNotificationKey: opts.send_notification_key}, function(err) {
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
          if (opts.platform === 'android') {
            updateGcmNotificationKey({userId: opts.user_id, registrationId: opts.token
              , action: 'subscribe', sendNotificationKey: opts.send_notification_key}, function(err) {
              if (err) common.notifyError('Error updating GCM notification key: ' + err);
              common.publishEvent({user_id: opts.user_id, action: 'update_device'
                , platform: opts.platform, successful: !err}, callback);
            });
          } else {
            common.publishEvent({user_id: opts.user_id, action: 'update_device'
              , platform: opts.platform, successful: true}, callback);
          }
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
            , registrationId: opts.token, action: 'unsubscribe'}, function(err) {
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
    return knex.select().from('devices').where({
      user_id: opts.user_id
    })
    .then(function(results) {
      if (!results || results.length < 1) { return; }

      var androidTokens = []
        , iosTokens     = []

        , androidNotifications  = Promise.promisify(notifyAndroid)
        , iosNotifications      = Promise.promisify(notifyIos);

      results.forEach(function(device) {
        if (device.platform == DeviceModel.platforms['android']) {
          androidTokens.push(device.token);
        } else if (device.platform == DeviceModel.platforms['ios']) {
          iosTokens.push(device.token);
        } else {
          throw new Error('Invalid platform: '+device.platform);
        }
      });

      return Promise.props({
        ios:      iosNotifications(opts.user_id, iosTokens, opts.message, opts.payload),
        android:  Promise.method(function() {
          var androidData = opts.extra || opts.payload || {};

          if (opts.include_notification_key) {
            return knex.select('notification_key').from('gcm_notification_users').where({
              user_id:  opts.user_id
            })
            .then(function(userResult) {
              if (userResult && userResult.length) {
                androidData.notification_key = userResult[0].notification_key;
              }

              return androidNotifications(opts.user_id, androidTokens, androidData);
            })
            .catch(function(err) {
              common.notifyError(new Error("Error while querying for notification key: "+err));
              return androidNotifications(opts.user_id, androidTokens, androidData);
            });
          }
        })
      });
    })
    .catch(function(err) {
      common.notifyError(err);
      throw err;
    })
    .nodeify(callback);
  }
}

function notifyIos(userId, tokens, message, payload, callback) {
  if (!tokens || !tokens.length) { return callback(); }

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
  note.alert = message;
  note.payload = payload;

  if (process.env.NODE_ENV == 'test') {
    common.redis.rpush('yodel:push', JSON.stringify(note));
  } else {
    apnConnection.pushNotification(note, tokens);
  }

  if (process.env.NODE_ENV !== 'test' && tokens.length > 0) {
    common.publishEvent({user_id: userId, action: 'notify'
        , platform: 'ios', successful: true}, callback);
  } else {
    return callback();
  }
}

function notifyAndroid(userId, registrationIds, data, callback) {
  if (!registrationIds || !registrationIds.length) { return callback(); }

  if (process.env.NODE_ENV == 'test') {
    common.redis.rpush("yodel:push", JSON.stringify(data));
  } else if (common.config('gcm', true)) {
    var message = new gcm.Message({data: data})
      , sender  = new gcm.Sender(common.config('gcm').server_api_key);

    sender.send(message, registrationIds, function(err, results) {
      if (err) { common.notifyError(err + (results ? ' : ' + results : '')); }
      common.publishEvent({user_id: userId, action: 'notify'
        , platform: 'android', successful: !err}, callback);
    });
  } else {
    return callback();
  }
}

function updateGcmNotificationKey(opts, callback) {
  // opts:
  // userId
  // registrationId,
  // action
  // sendNotificationKey (optional)

  var isSubscribe = opts.action === 'subscribe';

  knex.select().from('gcm_notification_users')
    .where({ user_id: opts.userId })
    .then(function(results) {
      if (!results || results.length === 0) {
        if (!isSubscribe) return callback();

        var notificationKeyName = 'user_' + opts.userId + '_' + randomstring.generate(10)
          , operationOpts = {
              operationType: 'create'
            , notificationKeyName: notificationKeyName
            , registrationIds: [opts.registrationId]
            };

        performOperation(operationOpts, function(err, notificationKey) {
          if (err) {
            callback(err);
          } else {
            knex('gcm_notification_users').insert({
              user_id: opts.userId,
              notification_key: notificationKey,
              notification_key_name: notificationKeyName,
              created_at: new Date(),
              updated_at: new Date()
            })
            .then(function(inserts) {
              if (opts.sendNotificationKey) {
                notifyAndroid(opts.userId, [opts.registrationId], {notification_key: notificationKey}, callback);
              } else {
                callback();
              }
            })
            .catch(function(err) {
              callback('Error inserting to gcm_notification_users: ' + err);
            });
          }
        });

      } else {
        // Results exist
        var operationType;
        if (isSubscribe) operationType = results[0].notification_key ? 'add' : 'create';
        else operationType = 'remove';

        var operationOpts = {
          operationType: operationType
        , notificationKeyName: results[0].notification_key_name
        , notificationKey: results[0].notification_key
        , registrationIds: [opts.registrationId]
        , recreateKeyIfMissing: true
        };

        performOperation(operationOpts, function(err, notificationKey) {
          if (err) return callback(err);

          knex('gcm_notification_users')
            .where({ user_id: opts.userId })
            .update({
              notification_key: notificationKey,
              updated_at: new Date()
            })
            .then(function(updateCount) {
              if (updateCount) {
                if (opts.sendNotificationKey) {
                  notifyAndroid(opts.userId, [opts.registrationId], {notification_key: notificationKey}, callback);
                } else {
                  callback();
                }
              } else {
                callback('Unable to update a record on gcm_notification_users');
              }
            })
            .catch(function(err) {
              callback('Error updating a record in gcm_notification_users: ' + err);
            });
        });
      }
    })
    .catch(function(err) {
      callback('Error querying gcm_notification_users: ' + err);
    });
}

function performOperation(operationOpts, callback) {
  var gcmConfig    = common.config('gcm')
    , keyOperation = new gcm.Operation(operationOpts)
    , opRunner     = new gcm.OperationRunner(gcmConfig.project_number, gcmConfig.server_api_key);

    opRunner.performOperation(keyOperation, function(err, result) {
      if (err) return callback(err + (result ? ' : ' + result : ''));
      if (result.notification_key) {
        callback(null, result.notification_key);
      } else {
        callback('Did not receive notification key');
      }
    });
}
