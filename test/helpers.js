var should        = require('should')
  , util          = require('util')
  , EventEmitter  = require('events').EventEmitter
  , common        = require('../common');

var helpers = module.exports = {};

helpers.nestedProperty = function(obj, keys, val) {
  if (keys.constructor != Array) {
    if (keys.constructor != String) {
      // assume object {'following_me.status': 'confirmed'}
      for (k in keys) break;
      val = keys[k];
      keys = k;
    }
    keys = keys.split('.');
  }

  keys.forEach(function(key){
    should.exist(obj);
    obj.should.have.property(key);
    obj = obj[key];
  });

  if (typeof val != 'undefined') should.equal(val, obj);
  return obj;
}

var ActionWatcher = function() {
  this.actionPrefix = 'yodel:events';
  this.redis = common.newRedisClient('redis');
  this.buffer = {};

  var self = this;
  self.redis.on('ready', function() {
    self.redis.subscribe('yodel:events');
  });

  self.redis.on('message', function(channel, message) {
    var result = JSON.parse(message);
    var event = message.action + ':' + message.user_id;
    var listeners = self.listeners(event);

    if (listeners.length > 0) {
      self.emit(event, result);
    } else {
      self.buffer[channel] = result;
    }
  });

  EventEmitter.call(this);
}
util.inherits(ActionWatcher, EventEmitter);

ActionWatcher.prototype.clearBuffer = function() {
  return this.buffer = {};
}

ActionWatcher.prototype.waitForEvent = function(event, listener, delay) {
  var self = this
    , key  = 'yodel:events';

  delay = delay || 500;

  var interval = setInterval(function() {
    if (key in self.buffer) {
      var result = self.buffer[key];
      listener(null, result);
      delete self.buffer[key];
      handler();
      return;
    }
  }, 1000);

  var handler = function() {
    clearTimeout(timeout);
    clearInterval(interval);
    self.removeListener(event, handler);
    setTimeout(function () {
      listener.apply(self, arguments);
    }, delay);
  }

  var timeout = setTimeout(function() {
    self.removeListener(event, handler);
    clearInterval(interval);
    return listener(new Error('Event ' + event + ' Never Completed'));
  }, 3500);

  this.once(event, handler);
}

ActionWatcher.prototype.waitForPush = function(userId, listener, delay) {
  delay = delay || 500;

  var interval = setInterval(function() {
    common.redis.lpop("yodel:push", function(err, result) {
      if (result) {
        handler();
        return listener(null, JSON.parse(result));
      }
    });
  }, 500);

  var handler = function() {
    clearTimeout(timeout);
    clearInterval(interval);
  }

  var timeout = setTimeout(function () {
    return listener(new Error('Push for '+userId+' never happened'));
  }, delay);
}

helpers.actionWatcher = new ActionWatcher();
