var common      = require('./common')
  , _           = require('lodash')
  , redis       = common.redis
  , DeviceModel = require('./models/device');


listenTo({
  'stentor:subscribe':   DeviceModel.subscribe
, 'stentor:unsubscribe': DeviceModel.unsubscribe
, 'stentor:notify':      DeviceModel.notify
})


function listenTo(channels) {
  for (var key in channels) {
    if (typeof channels[key] === 'undefined') {
      throw new Error("Invalid method for key: "+key);
    }
  }

  redis.blpop(_.keys(channels).concat([0]), function(err, data) {
    if (err) { 
      console.error('error from blpop:', err);
      return listenTo(channels);
    }

    if (!Array.isArray(data) || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
      console.error('unexpected data format:', data);
      return listenTo(channels);
    }

    var key    = data[0]
      , method = channels[key];

    try {
      var parsedData = JSON.parse(data[1]);
    } catch (e) {
      console.error('invalid JSON on '+key+':', data[1]);
      return listenTo(channels);
    }

    console.log('data received on '+key+':', parsedData);

    method(parsedData, function(err) {
      if (err) { console.error("Error calling method for key: "+key, err); }
      return listenTo(channels);
    });
  });
}
