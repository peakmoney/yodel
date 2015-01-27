var common      = module.exports = {}
  , configCache = {}
  , env         = process.env.NODE_ENV || 'development';

var config = common.config = function config(name) {
  if (configCache[name]) { return configCache[name]; }

  var conf = require('./config/'+name);
  if (!conf) {
    throw new Error("File not found: config/"+name);
  }

  conf = conf[env];
  if (!conf) {
    throw new Error(env+" enviroment not specified for config/"+name);
  }

  return configCache[name] = conf;
};

common.knex = require('knex')(config('knexfile'));
common.redis = require("redis").createClient();