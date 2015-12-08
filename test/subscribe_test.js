var helpers = require('./helpers');
var common = require('../common');
var redis = common.redis;
var knex = common.knex;

describe('Subscribe', function() {
  before(function(done) {
    console.log('Resetting batch...');
    helpers.actionWatcher.clearBuffer();
    redis.del(['yodel:subscribe', 'yodel:unsubscribe', 'yodel:notify', 'yodel:push'], function(err) {
      if (err) { return done(err); }
      knex('devices').truncate().nodeify(done);
    });
  });

  describe('Redis rpush yodel:subscribe {user_id: 5, token: "sample", platform: "ios"}', function() {
    it('should have a result of 1', function(done) {
      common.redis.rpush('yodel:subscribe', JSON.stringify({user_id: 5, token: 'sample', platform: 'ios'}), function(err, result) {
        if (err) return done(err);
        result.should.equal(1);
        done();
      });
    });

    it('should wait for Event create_device:5', function(done) {
      this.timeout(3500);
      helpers.actionWatcher.waitForEvent('create_device:5', function(err) {
        if (err) return done(err);
        done();
      });
    });
  });

  describe('Ensure matching record exists in MySQL', function() {
    it('should have a results array', function(done) {
      common.knex('devices')
        .where({user_id: 5, token: 'sample', platform: 2})
        .nodeify(function(err, result) {
          if (err) { return done(err); }
          result.should.be.instanceof(Array);
          done();
        });
    });

    it('should have a length of 1', function(done) {
      common.knex('devices')
        .where({user_id: 5, token: 'sample', platform: 2})
        .nodeify(function(err, result) {
          if (err) { return done(err); }
          result.should.have.lengthOf(1);
          done();
        });
    });

    it('results.0.created_at should be within 5s', function(done) {
      common.knex('devices')
        .where({user_id: 5, token: 'sample', platform: 2})
        .nodeify(function(err, result) {
          if (err) { return done(err); }
          var createdAt = helpers.nestedProperty(result, '0.created_at').getTime();
          createdAt.should.be.approximately(new Date().getTime(), 5000);
          done();
        });
    });
  });

  describe('Redis rpush yodel:notify {user_id: 5, message: "Sample message", payload: {other: "attribute"}}', function() {
    it('result should be 1', function(done) {
      common.redis.rpush('yodel:notify', JSON.stringify({user_id: 5, message: 'Sample message', payload: {other: 'attribute'}}), function(err, result) {
        if (err) { return done(err); }
        result.should.equal(1);
        done();
      });
    });

    it('should wait for Push 5', function(done) {
      this.timeout(2000);
      helpers.actionWatcher.waitForPush(5, function(err, push) {
        if (err) { return done(err); }
        helpers.nestedProperty(push, {'aps.alert': 'Sample message'});
        helpers.nestedProperty(push, {'aps.badge': 1});
        helpers.nestedProperty(push, {'other': 'attribute'});
        done();
      });
    });
  });

  describe('Redis rpush yodel:unsubscribe {user_id: 5, token: "sample", platform: "ios"}', function() {
    it('result should be 1', function(done) {
      common.redis.rpush('yodel:unsubscribe', JSON.stringify({user_id: 5, token: 'sample', platform: 'ios'}), function(err, result) {
        if (err) { return done(err); }
        result.should.equal(1);
        done();
      });
    });

    it('should wait for Event delete_device:5', function(done) {
      this.timeout(3500);
      helpers.actionWatcher.waitForEvent('delete_device:5', function(err) {
        if (err) return done(err);
        done();
      });
    });
  });

  describe('Ensure matching record was deleted in MySQL', function() {
    it('should have a results array', function(done) {
      common.knex('devices')
        .where({user_id: 5, token: 'sample', platform: 2})
        .nodeify(function(err, result) {
          if (err) { return done(err); }
          result.should.be.instanceof(Array);
          done();
        });
    });

    it('should have a length of 0', function(done) {
      common.knex('devices')
        .where({user_id: 5, token: 'sample', platform: 2})
        .nodeify(function(err, result) {
          if (err) { return done(err); }
          result.should.have.lengthOf(0);
          done();
        });
    });
  });
});
