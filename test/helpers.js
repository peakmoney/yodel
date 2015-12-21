var should        = require('should');
var util          = require('util');
var EventEmitter  = require('events').EventEmitter;
var common        = require('../common');
var Promise = require('bluebird');
var jdg = require('jdg');

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

var ActionWatcher = function ActionWatcher() {
  var _this = this;
  _this.buffer = {};

  _this.redis = common.newRedisClient('redis');
  _this.redis.on('ready', function() {
    return _this.redis.subscribeAsync('yodel:events');
  });

  _this.redis.on('message', function(channel, message) {
    var result = JSON.parse(message);
    var event = message.action + ':' + message.user_id;
    var listeners = _this.listeners(event);

    if (listeners.length > 0) {
      return _this.emit(event, result);
    } else {
      _this.buffer[channel] = result;
      return;
    }
  });

  EventEmitter.call(this);
}
util.inherits(ActionWatcher, EventEmitter);

ActionWatcher.prototype.clearBuffer = function() {
  this.buffer = {};
}

ActionWatcher.prototype.waitForEvent = function waitForEvent(event) {
  var _this = this;
  var key = 'yodel:events';
  var polls = 6;

  function poll() {
    return Promise.delay(500).then(function() {
      if (jdg.is.present(_this.buffer[key])) {
        var result = _this.buffer[key];
        delete _this.buffer[key];
        return result;
      } else if (polls.length < 1) {
        throw new Error('Event '+event+' never happened');
      } else {
        polls--;
        return poll();
      }
    });
  }

  return poll();
}

ActionWatcher.prototype.waitForPush = function(userId) {
  var polls = 6;

  function poll() {
    return Promise.delay(500).then(function() {
      return common.redis.lpopAsync('yodel:push').then(function(result) {
        if (jdg.is.present(result)) {
          return JSON.parse(result);
        } else if (polls.length < 1) {
          throw new Error('Push for User '+userId+' never happened');
        } else {
          polls--;
          return poll();
        }
      });
    });
  }

  return poll();
}

helpers.actionWatcher = new ActionWatcher();
