var Device = module.exports = function(attrs){
  for (var k in attrs) {
    this[k] = attrs[k];
  }
}

Device.subscribe = function(opts, callback) {
  return callback();
}

Device.unsubscribe = function(opts, callback) {
  return callback();
}

Device.notify = function(opts, callback) {
  return callback();
}