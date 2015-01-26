var common = require('./common')
  , redis  = common.redis;

(function blpopSubscribe() {
  redis.blpop('stentor:subscribe', 0, function(err, data){
    console.log('stentor:subscribe blpop data', data);
    if (err) { return blpopSubscribe(); }
    common.models.Device.subscribe(data, blpopSubscribe);
  });
  console.log('listening to stentor:subscribe');
})();

(function blpopUnsubscribe() {
  redis.blpop('stentor:unsubscribe', 0, function(err, data){
    console.log('stentor:unsubscribe blpop data', data);
    if (err) { return blpopUnubscribe(); }
    common.models.Device.unsubscribe(data, blpopUnubscribe);
  });
  console.log('listening to stentor:unsubscribe');
})();

(function blpopNotify() {
  redis.blpop('stentor:notify', 0, function(err, data){
    console.log('stentor:notify blpop data', data);
    if (err) { return blpopNotify(); }
    common.models.Device.notify(data, blpopNotify);
  });
  console.log('listening to stentor:notify');
})();
