var common  = require('../../common');
var DeviceModel = require('../models/device');
var apn     = require('apn');
var apnConfig = common.config('apn', true) || {};

// dirty default hacks for ensuring tests
// don't fail because private certs are missing
if (!apnConfig.cert && !apnConfig.pfx) {
  // defaults
  if (process.env.NODE_ENV == 'test') {
    apnConfig.cert = process.cwd()+'/node_modules/apn/test/credentials/support/cert.pem';
    apnConfig.address = 'feedback.sandbox.push.apple.com ';
  } else {
    apnConfig.cert = process.cwd()+"/config/cert.pem";
  }

  if (!apnConfig.key) {
    if (process.env.NODE_ENV == 'test') {
      apnConfig.key = process.cwd()+'/node_modules/apn/test/credentials/support/key.pem';
    } else {
      apnConfig.key = process.cwd()+"/config/key.pem";
    }
  }
}

apnConfig.interval = 43200;

var apnFeedbackDevice = function(attrs) {
  this.token = attrs.token;
  this.user_id = attrs.user_id;
  this.platform = 'ios';
}

var Feedback = function() {
  var self = this;

  self.apnService = new apn.Feedback(apnConfig);

  self.apnService.on('feedback', function(devices) {
    self.processApnFeedback(devices);
  });
};

Feedback.prototype.processApnFeedback = function(feedback) {
  var query = common.knex('devices').select('token', 'user_id');

  feedback.forEach(function(f) {
    query.orWhere(function() {
      this.where('token', f.device.toString())
          .where('updated_at', '<', new Date(f.time * 1000));
    });
  });

  query.then(function(devices) {
    if (devices.length > 0) {
      var unsubscribe;

      if (process.env.NODE_ENV == 'test') {
        unsubscribe = function(device) {
          common.redis.rpush('yodel:unsubscribe', JSON.stringify(device))
        }
      } else {
        unsubscribe = function(device) {
          DeviceModel.unsubscribe;
        }
      }

      devices.forEach(function(device) {
        unsubscribe(new apnFeedbackDevice(device));
      });
    }
  })
  .catch(function(err) {
    console.log(err);
  });
};

module.exports = function() {
  return new Feedback();
}
