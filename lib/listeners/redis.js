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
      common.notifyError('error from blpop: '+err);
      return RedisListener.listen(channels);
    }

    if (!Array.isArray(data) || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
      common.notifyError('unexpected data format: '+data);
      return RedisListener.listen(channels);
    }

    var key    = data[0]
      , method = channels[key];

    try {
      var parsedData = JSON.parse(data[1]);
    } catch (e) {
      common.notifyError('invalid JSON on '+key+':'+data[1]);
      return RedisListener.listen(channels);
    }

    method(parsedData, function(err) {
      if (err) { common.notifyError(err); }
      return RedisListener.listen(channels);
    });
  });
}
