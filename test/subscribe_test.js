var helpers = require('./helpers');
var common = require('../common');
var resetBatch = require('./reset_batch');

describe('Subscribe', function() {
  before(function() {
    return resetBatch();
  });

  describe('Redis rpush yodel:subscribe {user_id: 5, token: "sample", platform: "ios"}', function() {
    it('should have a result of 1', function() {
      return common.redis.rpushAsync('yodel:subscribe', JSON.stringify({
        user_id: 5, token: 'sample', platform: 'ios'
      }))
      .then(function(result) {
        result.should.equal(1);
      });
    });

    it('should wait for Event create_device:5', function() {
      this.timeout(3500);
      return (helpers.actionWatcher.waitForEvent('create_device:5')).should.be.fulfilled();
    });
  });

  describe('Ensure valid record exists in MySQL', function() {
    it('results should be an Array with 1 element and element.created_at within 3s', function() {
      return common.knex('devices').where({
        user_id: 5, token: 'sample', platform: 2
      }).then(function(results) {
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(1);
        results[0].created_at.getTime().should.be.approximately(new Date().getTime(), 3000);
      });
    });
  });

  describe('Redis rpush yodel:notify {user_id: 5, message: "Sample message", payload: {other: "attribute"}}', function() {
    it('result should be 1', function() {
      return common.redis.rpushAsync('yodel:notify', JSON.stringify({user_id: 5, message: 'Sample message', payload: {other: 'attribute'}}))
      .then(function(results) {
        results.should.equal(1);
      });
    });

    it('should wait for Push 5', function() {
      this.timeout(3000);
      return helpers.actionWatcher.waitForPush(5).then(function(push) {
        push.aps.alert.should.equal('Sample message');
        push.aps.badge.should.equal(1);
        push.other.should.equal('attribute');
      });
    });
  });

  describe('Redis rpush yodel:unsubscribe {user_id: 5, token: "sample", platform: "ios"}', function() {
    it('result should be 1', function() {
      return common.redis.rpushAsync('yodel:unsubscribe', JSON.stringify({user_id: 5, token: 'sample', platform: 'ios'}))
        .then(function(result) {
          result.should.equal(1);
        });
    });

    it('should wait for Event delete_device:5', function() {
      this.timeout(3500);
      return (helpers.actionWatcher.waitForEvent('delete_device:5')).should.be.fulfilled();
    });
  });

  describe('Ensure matching record was deleted in MySQL', function() {
    it('results should be an Array with 0 elements', function() {
      return common.knex('devices')
        .where({user_id: 5, token: 'sample', platform: 2})
        .then(function(results) {
          results.should.be.instanceof(Array);
          results.should.have.lengthOf(0);
        });
    });
  });
});
