/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

'use strict';

const cluster = require('cluster');
const program = require('commander');
const https = require('https');
const Promise = require('bluebird');
const Device = require('./lib/device');
const RedisListener = require('./lib/redis_listener');
const APNFeedbackListener = require('./lib/apn_feedback_listener');


program
  .option('-e, --environment <env>', 'Node Environment (defaults to development)')
  .option('-w, --workers <n>', 'Number of workers (defaults to number of CPUs)', parseInt)
  .parse(process.argv);

if (program.environment) {
  process.env.NODE_ENV = program.environment;
}

const common = require('./common');
const numWorkers = program.workers || 2;

// this will fail if there is nothing in the devices table
// that may not be what everyone wants
function ping() {
  const cfg = common.config.ping;
  https.get(cfg.run_url, () =>
    Promise.props({
      sql: common.knex('devices').max('id as max_id'),
      rds: common.redis.incrAsync('yodel:ping'),
    }).then(testResults => {
      const testResultsCopy = testResults;
      testResultsCopy.sql = testResults.sql[0].max_id;

      for (let k in testResultsCopy) {
        if (isNaN(testResultsCopy[k])) {
          return process.stderr.write(`Value not a number: ${k}\n`);
        } else if (testResultsCopy[k] < 1) {
          return process.stderr.write(`Value less than 1: ${k}\n`);
        }
      }

      return https.get(cfg.complete_url);
    }).catch(common.notifyError)
  );
}

if (cluster.isMaster) {
  // Fork workers. One per CPU for maximum effectiveness
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (deadWorker) => {
    // Restart the worker
    const worker = cluster.fork();

    // Note the process IDs
    const newPID = worker.process.pid;
    const oldPID = deadWorker.process.pid;

    // Log the event
    process.stderr.write(`worker ${oldPID} died.\n`);
    process.stderr.write(`worker ${newPID} born.\n`);
  });

  if (common.config.ping.run_url) {
    ping();
    setInterval(ping, common.config.ping.frequency || 60000);
  }
} else {
  new RedisListener().listen({
    'yodel:subscribe': Device.subscribe,
    'yodel:unsubscribe': Device.unsubscribe,
    'yodel:notify': Device.notify,
  });

  process.stdout.write(
    `Listening to yodel:subscribe, yodel:unsubscribe, and yodel:notify\n`);

  if (common.config.apnFeedback.cert) {
    const apnFeedbackListener = new APNFeedbackListener();
    apnFeedbackListener.listen();
    console.log('APN Feedback Service monitoring is active');
  }
}
