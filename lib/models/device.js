var common = require('../../common')
  , knex   = common.knex
  , _      = require('lodash')
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

  if (validateSubscribeOpts(opts, callback)) {
    if (!knex) {
      return callback("MySQL connection not established");
    }

    knex('devices')
      .where({
        user_id: opts.user_id,
        token: opts.token })
      .update({
        updated_at: new Date()
      })
      .then(function(rows) {
        if (rows === 0) {
          knex('devices').insert({
            user_id: opts.user_id,
            token: opts.token,
            platform: DeviceModel.platforms[opts.platform],
            created_at: new Date(),
            updated_at: new Date()
          })
          .then(function(inserts) {
            console.log(inserts.length + " new device(s) saved");
            return callback();
          }).catch(function(err) {
            return callback(err)
          });
        } else {
          console.log(rows + " new device(s) updated");
          return callback();
        }
      })
      .catch(function(err) {
        return callback(err);
      });

  }
}


DeviceModel.unsubscribe = function(opts, callback) {

  if (validateUnsubscribeOpts(opts, callback)) {
    if (!knex) {
      return callback("MySQL connection not established");
    }

    knex('devices')
      .where({
        user_id: opts.user_id,
        token: opts.token })
      .del()
      .then(function(rows) {
        console.log(rows + " device(s) deleted");
        return callback();
      })
      .catch(function(err) {
        return callback(err);
      });
  }
}


DeviceModel.notify = function(opts, callback) {

  if (validateNotifyOpts(opts, callback)) {
    if (!knex) {
      return callback("MySQL connection not established");
    }

    knex.select()
      .from('devices')
      .where({
        user_id: opts.user_id
      })
      .then(function(results) {

        if (results && results.length > 0) {

          var androidDevices = _.where(results, {'platform': DeviceModel.platforms['android']});
          var iosDevices = _.where(results, {'platform': DeviceModel.platforms['ios']});

          notifyIos(iosDevices, opts.message, opts.payload, function(err) {
            if (err) { common.notifyError(err); }
            notifyAndroid(androidDevices, opts.payload, callback);
          });

        } else {
          return callback();
        }

      })
      .catch(function(err) {
        return callback(err);
      })
  }
}

function notifyAndroid(devices, data, callback) {
  if (!devices) return callback();

  var registrationIds = [];

  _(devices).each(function(device) {
    console.log("Notifying Android Device: " + device.token);
    registrationIds.push(device.token);
  }).value();

  var message = new gcm.Message({data: data});

  var gcmConfig = common.config('gcm', true);
  if (gcmConfig) {
    var sender = new gcm.Sender(gcmConfig.server_api_key);
    sender.send(message, registrationIds, callback);
  } else {
    return callback();
  }
}

function notifyIos(devices, message, payload, callback) {
  if (!devices) return callback();

  var apnConfig = config('apn', true) || {};
  if (!apnConfig.cert && !apnConfig.pfx) {
    // defaults
    apnConfig.cert = process.cwd()+"/config/cert.pem";
    if (!apnConfig.key) {
      apnConfig.key = process.cwd()+"/config/key.pem";
    }
  }
  var apnConnection = new apn.Connection(apnConfig);

  _(devices).each(function(device) {
    console.log("Notifying iOS Device: " + device.token);

    var apnDevice = new apn.Device(device.token);
    var note = new apn.Notification();
    note.badge = 1;
    note.alert = message;
    note.payload = payload;
    apnConnection.pushNotification(note, apnDevice);

  }).value();

  return callback();
}

function validateSubscribeOpts(opts, callback) {
  var valid = true;
  if (!opts.user_id || isNaN(opts.user_id)) {
    valid = false;
    return callback("Invalid or missing option: user_id");
  } else if (!opts.token) {
    valid = false;
    return callback("Invalid or missing option: token");
  } else if (!opts.platform || ['android', 'ios'].indexOf(opts.platform) == -1) {
    valid = false;
    return callback("Invalid or missing option: platform");
  }
  return valid;
}

function validateUnsubscribeOpts(opts, callback) {
  var valid = true;
  if (!opts.user_id || isNaN(opts.user_id)) {
    valid = false;
    return callback("Invalid or missing option: user_id");
  } else if (!opts.token) {
    valid = false;
    return callback("Invalid or missing option: token");
  }

  return valid;
}

function validateNotifyOpts(opts, callback) {
  var valid = true;
  if (!opts.user_id || isNaN(opts.user_id)) {
    valid = false;
    return callback("Invalid or missing option: user_id");
  } else if (!opts.message || typeof opts.message !== 'string') {
    valid = false;
    return callback("Invalid or missing option: message");
  } else if (!opts.payload) {
    valid = false;
    return callback("Invalid or missing option: payload");
  }

  return valid;
}
