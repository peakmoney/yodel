var cluster = require('cluster')
  , program = require('commander')
  , https   = require('https')
  , Promise = require('bluebird');


program
  .option('-e, --environment <env>', 'Node Environment (defaults to development)')
  .option('-w, --workers <n>', 'Number of workers (defaults to number of CPUs)', parseInt)
  .parse(process.argv);

if (program.environment) {
  process.env.NODE_ENV = program.environment;
}

var common     = require('./common')
  , numWorkers = program.workers || require('os').cpus().length;

if (cluster.isMaster) {
  // Fork workers. One per CPU for maximum effectiveness
  for (var i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', function(deadWorker, code, signal) {
    // Restart the worker
    var worker = cluster.fork();

    // Note the process IDs
    var newPID = worker.process.pid;
    var oldPID = deadWorker.process.pid;

    // Log the event
    console.log('worker '+oldPID+' died.');
    console.log('worker '+newPID+' born.');
  });

  if (common.config('ping', true)) {
    ping();
    setInterval(ping, common.config('ping').frequency || 60000);
  }

} else {
  var DeviceModel   = require('./lib/models/device')
    , RedisListener = require('./lib/listeners/redis');

  RedisListener.listen({
    'yodel:subscribe':   DeviceModel.subscribe
  , 'yodel:unsubscribe': DeviceModel.unsubscribe
  , 'yodel:notify':      DeviceModel.notify
  });

  console.log('Listening to yodel:subscribe, yodel:unsubscribe, and yodel:notify');
}


// this will fail if there is nothing in the devices table
// that may not be what everyone wants
function ping() {
  var cfg = common.config('ping', true);
  https.get(cfg.run_url, function() {
    return Promise.props({
      sql: common.knex('devices').max('id as max_id')
    , rds: common.redis.incrAsync('yodel:ping')
    }).then(function(testResults) {
      testResults.sql = testResults.sql[0].max_id;

      for (var k in testResults) {
        if (isNaN(testResults[k])) {
          return console.error('Value not a number: '+k);
        // } else if (testResults[k] < 1) {
        //   return console.error('Value less than 1: '+k);
        }
      }

      https.get(cfg.complete_url);
    }).catch(common.notifyError);
  });
}
