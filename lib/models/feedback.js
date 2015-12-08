var common  = require('../../common');
var DeviceModel = require('./device');
var apn     = require('apn');
var apnConfig = common.config('apn', true) || {};

if (!apnConfig.cert && !apnConfig.pfx) {
  // defaults
  apnConfig.cert = process.cwd()+"/config/cert.pem";
  if (!apnConfig.key) {
    apnConfig.key = process.cwd()+"/config/key.pem";
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
      this.where('token', f.device)
          .where('updated_at', '<', f.time);
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
    console.log(err.stack);
  });
};

module.exports = function() {
  new Feedback();
}
