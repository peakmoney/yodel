'use strict';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const Promise = require('bluebird');
const raven = require('raven');
const redis = Promise.promisifyAll(require('redis'));

const common = module.exports = {};

const config = common.config = require('./config');

// Sentry (error reporting)
if (config.sentry.dsn) {
  const ravenClient = new raven.Client(config.sentry.dsn);
  ravenClient.patchGlobal();
  common.notifyError = function notifyError(err, callback) {
    let fullErr = err;
    if (!(err instanceof Error)) { fullErr = new Error(err); }
    ravenClient.captureError(fullErr, callback);
  };
} else {
  common.notifyError = console.error;
}

// Knex (MySQL)
common.knex = require('knex')(config.knex);

// Redis
common.newRedisClient = function newRedisClient(configName) {
  const rConfig = config[configName] || {};
  rConfig.port = rConfig.port || 6379;
  rConfig.host = rConfig.host || '127.0.0.1';

  const client = redis.createClient(rConfig);

  if (!isNaN(rConfig.database)) { client.select(rConfig.database); }

  return client;
};

common.redis = common.newRedisClient('redis');

// Redis Events (for Yodel Stats)
if (config.redisEvents.host) {
  const rEventsClient = common.newRedisClient('redis_events');
  common.publishEvent = function publishEvent(event, callback) {
    return rEventsClient
      .publishAsync('yodel:events', JSON.stringify(event))
      .nodeify(callback);
  };
} else {
  common.publishEvent = function publishEvent(event, callback) {
    console.log('Event: ', event);
    return callback && callback();
  };
}
