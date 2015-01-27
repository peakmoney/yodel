/** Don't hate me for this. Just throwing together something I can quickly run. **/

var common  = require('./common')
  , redis   = common.redis
  , program = require('commander');

program
  .option('-t, --task <action>', 'Task (defaults to subscribe)')
  .parse(process.argv);

var task = program.task ? program.task : 'subscribe';

var testDevice = {
  user_id: 1234,
  token: "999988887777",
  platform: "android"
};

var testNotification = {
  user_id: 1234,
  data: JSON.stringify({
    activity_id: 4,
    message: "This is a notification!"
  })
}

if (task === 'subscribe') {
  (function subscribe() {
    redis.lpush('stentor:subscribe', JSON.stringify(testDevice), function(err, data){
      console.log('stentor:subscribe lpush data', data);
      
      if (err) { 
        console.log(err);
      }

      process.exit(0);
    });
  })();

} else if (task === 'notify') {
  (function notify() {
    redis.lpush('stentor:notify', JSON.stringify(testNotification), function(err, data){
      console.log('stentor:notify lpush data', data);
      
      if (err) { 
        console.log(err);
      }

      process.exit(0);
    });
  })();

} else {
  console.log("Unrecognized action");
  process.exit(0);
}