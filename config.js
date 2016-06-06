'use strict';

const dotenv = require('dotenv');

const env = process.env.NODE_ENV || 'development';

// Load ENV specific
dotenv.config({
  path: `.env.${env}`,
  silent: true,
});

// Load Defaults
dotenv.config();

function parseBoolean(val) {
  if (typeof val === 'undefined') { return undefined; }
  return JSON.parse(val);
}

// Only APN, GCM, and Knex (MySQL) config are actually required here
module.exports = {
  apn: {
    cert: process.env.APN_CERT,
    key: process.env.APN_KEY,
    production: parseBoolean(process.env.APN_PRODUCTION),
    sandbox: parseBoolean(process.env.APN_SANDBOX),
  },
  apnFeedback: {
    cert: process.env.APN_FEEDBACK_CERT,
    key: process.env.APN_FEEDBACK_KEY,
    batchFeedback: process.env.APN_FEEDBACK_BATCH_FEEDBACK,
    interval: process.env.APN_FEEDBACK_INTERVAL,
    production: parseBoolean(process.env.APN_FEEDBACK_PRODUCTION),
    sandbox: parseBoolean(process.env.APN_FEEDBACK_SANDBOX),
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