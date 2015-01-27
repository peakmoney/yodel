var common = require('../../common')
  , _      = require('lodash')
  , redis  = common.redis;


var RedisListener = module.exports = {};


RedisListener.listen = function listen(channels) {
  for (var key in channels) {
    if (typeof channels[key] === 'undefined') {
      throw new Error("Invalid method for key: "+key);
    }
  }

  redis.blpop(_.keys(channels).concat([0]), function(err, data) {
    if (err) { 
      console.error('error from blpop:', err);
      return RedisListener.listen(channels);
    }

    if (!Array.isArray(data) || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
      console.error('unexpected data format:', data);
      return RedisListener.listen(channels);
    }

    var key    = data[0]
      , method = channels[key];

    try {
      var parsedData = JSON.parse(data[1]);
    } catch (e) {
      console.error('invalid JSON on '+key+':', data[1]);
      return RedisListener.listen(channels);
    }

    console.log('data received on '+key+':', parsedData);

    method(parsedData, function(err) {
      if (err) { console.error("Error calling method for key: "+key, err); }
      return RedisListener.listen(channels);
    });
  });

  console.log('Listening to '+_.keys(channels).join(', '));
}