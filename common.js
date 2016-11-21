const common = module.exports = {};
const configCache = {};
const Promise = require('bluebird');
const env = process.env.NODE_ENV || 'development';

const config = common.config = function config(name, allowBlank) {
  if (typeof configCache[name] !== 'undefined') { return configCache[name]; }

  let conf;
  try {
    // eslint-disable-next-line
    conf = require(`./config/${name}`);
  } catch (e) {
    if (allowBlank) {
      configCache[name] = null;
      return null;
    }
    throw e;
  }

  conf = conf[env];
  if (!conf) {
    if (allowBlank) {
      console.error(`${name} config not specified for "+env+" environment`);
      configCache[name] = null;
      return null;
    }
    throw new Error(`${env} enviroment not specified for config/${name}`);
  }

  configCache[name] = conf;
  return configCache[name];
};

common.knex = require('knex')(config('knexfile'));

common.notifyError = (err) => {
  console.error(err);
};

common.logAndThrow = (err) => {
  console.log(err);
  throw new Error(err);
};

if (config('sentry', true)) {
  // eslint-disable-next-line
  const raven = require('raven');
  const ravenClient = new raven.Client(config('sentry').dsn);
  ravenClient.patchGlobal();
  common.notifyError = (err, callback) => {
    let error = err;
    if (!(error instanceof Error)) { error = new Error(err); }
    ravenClient.captureError(error, callback);
  };
}

common.publishEvent = (event, callback) => {
  console.log('Event: ', event);
  return callback && callback();
};

common.newRedisClient = (configName) => {
  const rConfig = config(configName, true) || {};
  rConfig.port = rConfig.port || 6379;
  rConfig.host = rConfig.host || '127.0.0.1';

  // Don't want to overwrite any data in a database for another env
  if (env === 'test' && typeof rConfig.database === 'undefined') {
    rConfig.database = 5;
  }

  // eslint-disable-next-line
  const redis = require('redis');
  Promise.promisifyAll(redis.RedisClient.prototype);

  const client = redis.createClient(
    rConfig.port, rConfig.host, rConfig.options);

  if (!isNaN(rConfig.database)) { client.select(rConfig.database); }

  return client;
};

common.redis = common.newRedisClient('redis');

if (config('redis_events', true) || env === 'test') {
  const redis = common.newRedisClient('redis_events');
  common.publishEvent = (event, callback) => {
    return redis.publishAsync('yodel:events', JSON.stringify(event)).nodeify(callback);
  };
}
