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

var redisConfig = config('redis', true) || {};
redisConfig.port = redisConfig.port || 6379;
redisConfig.host = redisConfig.host || '127.0.0.1';
// Don't want to overwrite any data in a database for another env
if (env == 'test' && typeof redisConfig.database === 'undefined') {
  redisConfig.database = 5;
}

common.redis = require("redis").createClient(redisConfig.port, redisConfig.host, redisConfig.options);
if (!isNaN(redisConfig.database)) {
  common.redis.select(redisConfig.database);
}

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
