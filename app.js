const cluster = require('cluster');
const program = require('commander');
const https = require('https');
const Promise = require('bluebird');


program
  .option('-e, --environment <env>', 'Node Environment (defaults to development)')
  .option('-w, --workers <n>', 'Number of workers (defaults to number of CPUs)', parseInt)
  .parse(process.argv);

if (program.environment) {
  process.env.NODE_ENV = program.environment;
}

const common = require('./common');
// eslint-disable-next-line
const numWorkers = program.workers || require('os').cpus().length;

// this will fail if there is nothing in the devices table
// that may not be what everyone wants
function ping() {
  const cfg = common.config('ping', true);
  https.get(cfg.run_url, () => {
    return Promise.props({
      sql: common.knex('devices').max('id as max_id'),
      rds: common.redis.incrAsync('yodel:ping'),
    }).then((testResults) => {
      const results = testResults;
      results.sql = testResults.sql[0].max_id;

      let hasError = false;
      results.forEach((key) => {
        if (isNaN(results[key])) {
          hasError = true;
          console.error(`Value not a number: ${key}`);
        } else if (results[key] < 1) {
          hasError = true;
          console.error(`Value less than 1: ${key}`);
        }
      });

      return hasError ? null : https.get(cfg.complete_url);
    }).catch(common.notifyError);
  });
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
    console.log(`worker ${oldPID} died.`);
    console.log(`worker ${newPID} born.`);
  });

  if (common.config('ping', true)) {
    ping();
    setInterval(ping, common.config('ping').frequency || 60000);
  }
} else {
  // eslint-disable-next-line
  const Device = require('./lib/device');
  // eslint-disable-next-line
  const RedisListener = require('./lib/redis');

  RedisListener.listen({
    'yodel:subscribe': Device.subscribe,
    'yodel:unsubscribe': Device.unsubscribe,
    'yodel:notify': Device.notify,
  });

  console.log('Listening to yodel:subscribe, yodel:unsubscribe, and yodel:notify');

  if (common.config('apn_feedback', true)) {
    // eslint-disable-next-line
    require('./lib/feedback');
    console.log('APN Feedback Service monitoring is active');
  }
}
