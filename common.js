'use strict';

const common = module.exports = {};
const Promise = require('bluebird');
const raven = require('raven');
const redis = Promise.promisifyAll(require('redis'));
const fs = require('fs');
const dotenv = require('dotenv');

let dotenvPath;
['./.env', `./.env.${process.env.NODE_ENV}`].forEach(path => {
  try {
    if (fs.statSync(path).isFile()) { dotenvPath = path; }
  } catch (e) {
    // nothing to see here
  }
});

if (dotenvPath) {
  dotenv.config({ path: dotenvPath });
}

// Only APN, GCM, and Knex (MySQL) config are actually required here
const config = common.config = {
  apn: {
    cert: process.env.APN_CERT,
    key: process.env.APN_KEY,
    production: process.env.APN_PRODUCTION,
  },
  apnFeedback: {
    cert: process.env.APN_FEEDBACK_CERT,
    key: process.env.APN_FEEDBACK_KEY,
    batchFeedback: process.env.APN_FEEDBACK_BATCH_FEEDBACK,
    interval: process.env.APN_FEEDBACK_INTERVAL,
    production: process.env.APN_FEEDBACK_PRODUCTION,
  },
  gcm: {
    server_api_key: process.env.GCM_SERVER_API_KEY,
    product_number: process.env.GCM_PRODUCT_NUMBER,
  },
  knex: {
    client: 'mysql',
    connection: process.env.DATABASE_URL,
  },
  ping: {
    run_url: process.env.PING_RUN_URL,
    complete_url: process.env.PING_COMPLETE_URL,
    frequency: process.env.PING_FREQUENCY,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    database: process.env.REDIS_DATABASE,
    password: process.env.REDIS_PASSWORD,
  },
  redisEvents: {
    host: process.env.REDIS_EVENTS_HOST,
    port: process.env.REDIS_EVENTS_PORT,
    database: process.env.REDIS_EVENTS_DATABASE,
    password: process.env.REDIS_EVENTS_PASSWORD,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
};

// Sentry (error reporting)
if (config.sentry.dsn) {
  const ravenClient = new raven.Client(config('sentry').dsn);
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
  const rConfig = config[configName];
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
