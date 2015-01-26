/** Don't hate me for this. Just throwing together something I can quickly run. **/

var common = require('./common')
  , redis  = common.redis;

var testDevice = {
  user_id: 1234,
  token: "asdf132456",
  platform: "android"
};

(function subscribe() {
  redis.lpush('stentor:subscribe', JSON.stringify(testDevice), function(err, data){
    console.log('stentor:subscribe lpush data', data);
    
    if (err) { 
      console.log(err);
    }

    process.exit(0);
  });
})();