var common = require('./common')
  , redis  = common.redis;

var blpopSubscribe = function() {
  client.blpop('stentor:subscribe', 0, function(err, data){
    console.log('stentor:subscribe blpop data', data);
    blpopSubscribe();
  });
};