var common      = module.exports = {}
  , configCache = {}
  , env         = process.env.NODE_ENV || 'development';

var config = common.config = function config(name, allowBlank) {
  if (typeof configCache[name] !== 'undefined') { return configCache[name]; }

  try {
    var conf = require('./config/'+name);
  } catch (e) {
    if (allowBlank) { return configCache[name] = null; }
    throw e;
  }

  conf = conf[env];
  if (!conf) {
    if (allowBlank) {
      console.error(name+" config not specified for "+env+" environment");
      return configCache[name] = null;
    }
    throw new Error(env+" enviroment not specified for config/"+name);
  }

  return configCache[name] = conf;
};

common.knex = require('knex')(config('knexfile'));
common.redis = newRedisClient('redis');

common.notifyError = function(err) {
  console.error(err);
};

if (config('sentry', true)) {
  var raven = require('raven');
  var ravenClient = new raven.Client(config('sentry').dsn);
  ravenClient.patchGlobal();
  common.notifyError = function(err, callback) {
    if (!(err instanceof Error)) { err = new Error(err); }
    ravenClient.captureError(err, callback);
  }
}

common.publishEvent = function(event, callback) {
  console.log('Event: ', event);
  return callback && callback();
}

if (config('redis_events', true)) {
  var redis = newRedisClient('redis_events');
  common.publishEvent = function(stats, callback) {
    redis.publish("yodel:events", JSON.stringify(stats), callback);
  }
}

function newRedisClient(configName) {
  var rConfig = config(configName, true) || {};
  rConfig.port = rConfig.port || 6379;
  rConfig.host = rConfig.host || '127.0.0.1';

  // Don't want to overwrite any data in a database for another env
  if (env == 'test' && typeof rConfig.database === 'undefined') {
    rConfig.database = 5;
  }

  var client = require("redis").createClient(
    rConfig.port, rConfig.host, rConfig.options);

  if (!isNaN(config.database)) { client.select(config.database); }

  return client;
}
