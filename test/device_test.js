var helpers = require('./helpers');
var common = require('../common');
var resetBatch = require('./reset_batch');
var Device = require('../lib/device');

describe('Device', function() {

  before(function() {
    return resetBatch().then(function() {
      return common.knex('devices').insert({
        user_id: 40,
        token:  'abc123',
        platform: 2,
        created_at: new Date(2015, 10, 1),
        updated_at: new Date(2015, 10, 15)
      });
    });
  });

  describe('#find()', function() {
    it('user 40 should exist', function() {
      return Device.find({user_id: 40, token: 'abc123'}).then(function(device) {
        device.should.be.instanceof(Device);
        device.get('user_id').should.equal(40);
        device.get('token').should.equal('abc123');
      });
    });

    it('should not break if the device is not found', function() {
      return Device.find({id: 100}).then(function(device) {
        (device === null).should.be.true;
      });
    });

    it('should throw an error without id, user_id and token', function() {
      return (Device.find({platform: 'ios'})).should.be.rejected();
    });
  });
});
