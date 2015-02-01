var common = require('../../common')
  , knex   = common.knex
  , gcm    = require('node-gcm')
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
            common.publishEvent({user_id: opts.user_id, action: 'create_device'
              , platform: opts.platform, successful: true}, callback);
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
        common.publishEvent({user_id: opts.user_id, action: 'delete_device'
          , platform: opts.platform, successful: true}, callback);
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

        notifyIos(iosDevices, opts.message, opts.payload, function(err) {
          if (err) { common.notifyError(err); }
          notifyAndroid(androidDevices, opts.extra || opts.payload, callback);
        });
      })
      .catch(function(err) {
        return callback(err);
      })
  }


  function notifyAndroid(devices, data, callback) {
    if (!devices) { return callback(); }

    var registrationIds = [];
    devices.forEach(function(device) {
      registrationIds.push(device.token);
    });

    if (registrationIds.length < 1) {
      return callback();
    } else if (process.env.NODE_ENV == 'test') {
      common.redis.rpush("yodel:push", JSON.stringify(data));
    } else if (common.config('gcm', true)) {
      var message = new gcm.Message({data: data})
        , sender  = new gcm.Sender(common.config('gcm').server_api_key);
      sender.send(message, registrationIds, function(err, results) {
        common.publishEvent({user_id: opts.user_id, action: 'notify'
          , platform: 'android', successful: !!err}, callback);
      });
    } else {
      return callback();
    }
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
}
