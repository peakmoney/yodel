var common      = require('./common')
  , redis       = common.redis
  , DeviceModel = require('./models/device');


listenTo({
  'stentor:subscribe':   DeviceModel.subscribe
, 'stentor:unsubscribe': DeviceModel.unsubscribe
, 'stentor:notify':      DeviceModel.notify
})


function listenTo(channels) {
  for (var key in channels) {
    continuousBlpop(key);
    console.log('listening to '+key);
  }

  function continuousBlpop(key) {
    var method = channels[key];
    if (typeof method === 'undefined') {
      throw new Error("Invalid method for key: "+key);
    }

    redis.blpop(key, 0, function(err, data) {
      if (err) { 
        console.error('error from blpop on '+key+':', err);
        return continuousBlpop(key);
      }

      console.log(key+' blpop data', data);

      if (!Array.isArray(data) || typeof data[1] !== 'string') {
        console.error('unexpected data format on '+key+':', data);
        return continuousBlpop(key);
      }

      try {
        var parsedData = JSON.parse(data[1]);
      } catch (e) {
        console.error('invalid JSON on '+key+':', data[1]);
        return continuousBlpop(key);
      }

      method(parsedData, function(err) {
        if (err) { console.error("Error calling method for key: "+key, err); }
        return continuousBlpop(key);
      });
    });
  }
}