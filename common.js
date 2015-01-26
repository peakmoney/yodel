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

common.knex = { 
  dialect: 'mysql', connection: {
    host:     config('mysql').host
  , user:     config('mysql').user
  , password: config('mysql').password
  , database: config('mysql').database
  , timezone: config('mysql').timezone || 'Z'
}}


common.redis = require("redis").createClient();