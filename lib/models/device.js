var common = require('../../common')
  , knex   = common.knex
  , _ = require('lodash');


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

    var notifyError;

    knex.select()
      .from('devices')
      .where({
        user_id: opts.user_id
      })
      .then(function(results) {

        if (results && results.length > 0) {
          
          var androidDevices = _.where(results, {'platform': DeviceModel.platforms['android']});
          var iosDevices = _.where(results, {'platform': DeviceModel.platforms['ios']});

          notifyIos(iosDevices, function(err) {
            notifyError += err;
            notifyAndroid(androidDevices, callback);
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

function notifyAndroid(devices, callback) {
  if (!devices) return callback();
  _(devices).each(function(device) {
    console.log("Notifying Android Device: " + device.token);
  }).value();

  return callback();
}

function notifyIos(devices, callback) {
  if (!devices) return callback();
  _(devices).each(function(device) {
    console.log("Notifying iOS Device: " + device.token);
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
  } else if (!opts.data || !isJsonString(opts.data)) {
    valid = false;
    return callback("Invalid or missing option: data");
  }

  return valid;
}

function isJsonString(str) {
  try {
    JSON.parse(str);
  } catch (err) {
    console.log("JSON Parse Error: " + err);
    return false;
  }
  return true;
}



