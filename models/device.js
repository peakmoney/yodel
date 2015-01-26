var Device = module.exports = function(attrs){
  for (var k in attrs) {
    this[k] = attrs[k];
  }
}

Device.platforms = {
  1: 'android'
, 2: 'ios'

, 'android': 1
, 'ios':     2
};


Device.subscribe = function(opts, callback) {
  if (validateSubscriptionOpts(opts, callback)) {
    console.log("Valid subscribe opts");
    return callback();
  }
}

Device.unsubscribe = function(opts, callback) {
  if (validateSubscriptionOpts(opts, callback)) {
    console.log("Valid unsubscribe opts");
    return callback();
  }
}

Device.notify = function(opts, callback) {
  return callback();
}


function validateSubscriptionOpts(opts, callback) {
  var valid = true;
  if (!opts.userId || isNaN(opts.userId)) {
    valid = false;
    return callback("Invalid or missing option: userId");
  } else if (!opts.token) {
    valid = false;
    return callback("Invalid or missing option: token");
  } else if (!opts.platform || ['android', 'ios'].indexOf(opts.platform) == -1) {
    valid = false;
    return callback("Invalid or missing option: platform");
  }
  return valid;
}