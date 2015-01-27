var common      = module.exports = {}
  , configCache = {}
  , env         = process.env.NODE_ENV || 'development';

var config = common.config = function config(name, allowBlank) {
  if (configCache[name]) { return configCache[name]; }

  try {
    var conf = require('./config/'+name);
  } catch (e) {
    if (allowBlank) { return {}; }
    throw e;
  }

  conf = conf[env];
  if (!conf) {
    throw new Error(env+" enviroment not specified for config/"+name);
  }

  return configCache[name] = conf;
};

common.knex = require('knex')(config('knexfile'));

var redisConfig = config('redis', true);
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
