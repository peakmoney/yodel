var should = require('should');

var helpers = module.exports = {};

helpers.nestedProperty = function(obj, keys, val) {
  if (keys.constructor != Array) {
    if (keys.constructor != String) {
      // assume object {'following_me.status': 'confirmed'}
      for (k in keys) break;
      val = keys[k];
      keys = k;
    }
    keys = keys.split('.');
  }

  keys.forEach(function(key){
    should.exist(obj);
    obj.should.have.property(key);
    obj = obj[key];
  });

  if (typeof val != 'undefined') should.equal(val, obj);
  return obj;
}
