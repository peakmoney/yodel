'use strict';

const dotenv = require('dotenv');
const env = process.env.NODE_ENV || 'development';

// Load ENV specific
dotenv.config({
  path: `.env.${env}`,
  silent: true,
});

// Load Defaults
dotenv.config({
  silent: true,
});


function parseBoolean(val) {
  if (typeof val === 'undefined') { return undefined; }
  return JSON.parse(val);
}

// A hack until my related Knex pull request is accepted
let knexConnection = process.env.DATABASE_URL;
if (knexConnection === 'mysql://travis@127.0.0.1:3306/yodel_test') {
  knexConnection = { user: 'travis', database: 'yodel_test' };
}


// Only APN, GCM, and Knex (MySQL) config are actually required here
module.exports = {
  apn: {
    cert: process.env.APN_CERT,
    key: process.env.APN_KEY,
    production: parseBoolean(process.env.APN_PRODUCTION),
  },
  apnFeedback: {
    cert: process.env.APN_FEEDBACK_CERT,
    key: process.env.APN_FEEDBACK_KEY,
    batchFeedback: process.env.APN_FEEDBACK_BATCH_FEEDBACK,
    interval: process.env.APN_FEEDBACK_INTERVAL,
    production: parseBoolean(process.env.APN_FEEDBACK_PRODUCTION),
  },
  gcm: {
    server_api_key: process.env.GCM_SERVER_API_KEY,
    product_number: process.env.GCM_PRODUCT_NUMBER,
  },
  knex: {
    client: 'mysql',
    connection: knexConnection,
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
