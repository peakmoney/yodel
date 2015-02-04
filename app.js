var cluster = require('cluster')
  , program = require('commander');


program
  .option('-e, --environment <env>', 'Node Environment (defaults to development)')
  .option('-w, --workers <n>', 'Number of workers (defaults to number of CPUs)', parseInt)
  .parse(process.argv);


if (program.environment) {
  process.env.NODE_ENV = program.environment;
}

var numWorkers = program.workers || require('os').cpus().length;

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

} else {
  var DeviceModel   = require('./lib/models/device')
    , RedisListener = require('./lib/listeners/redis');

  setTimeout(function() {
    RedisListener.listen({
      'yodel:subscribe':   DeviceModel.subscribe
    , 'yodel:unsubscribe': DeviceModel.unsubscribe
    , 'yodel:notify':      DeviceModel.notify
    });

    console.log('Listening to yodel:subscribe, yodel:unsubscribe, and yodel:notify');
  }, 500);
}
