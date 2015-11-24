var vows       = require('vows')
  , should     = require('should')
  , helpers    = require('../helpers')
  , resetBatch = require('../reset_batch')
  , common     = require('../../common')
  , redis      = common.redis;

module.exports = vows.describe('Subscribe').addBatch(resetBatch).addBatch({

  'Redis rpush yodel:subscribe {user_id: 5, token: "sample", platform: "ios"}': {
    topic: function() {
      common.redis.rpush("yodel:subscribe"
        , JSON.stringify({user_id: 5, token: "sample", platform: "ios"})
        , this.callback);
    }

  , 'Result should be 1': function(result) {
      should.equal(result, 1);
    }

  , '> Wait for event': {
      topic: function() {
        helpers.actionWatcher.waitForEvent('create_device:5', this.callback);
      }

    , 'no errors': function(errs, results) {
        should.not.exist(errs);
      }
    }
  }

}).addBatch({

  'Ensure that matching record exists in MySQL after 3s': {
    topic: function() {
      common.knex('devices')
        .where({user_id: 5, token: "sample", platform: 2})
        .nodeify(this.callback);
    }

  , 'results should be an array': function(results) {
      results.should.be.instanceof(Array);
    }

  , 'results should have length of 1': function(results) {
      results.should.have.lengthOf(1);
    }

  , 'results.0.created_at should be within 5s': function(results) {
      var createdAt = helpers.nestedProperty(results, '0.created_at').getTime();
      createdAt.should.be.approximately(new Date().getTime(), 3000);
    }
  }


}).addBatch({


  'Redis rpush yodel:notify {user_id: 5, message: "Sample message", payload: {other: "attribute"}}': {
    topic: function() {
      common.redis.rpush("yodel:notify"
        , JSON.stringify({user_id: 5, message: "Sample message", payload: {other: "attribute"}})
        , this.callback);
    }

  , 'Result should be 1': function(result) {
      should.equal(result, 1);
    }

  , '> Wait for push': {
      topic: function() {
        helpers.actionWatcher.waitForPush(5, this.callback, 2000);
      }

    , 'aps.alert should be "Sample message"': function(result) {
        helpers.nestedProperty(result, {'aps.alert': 'Sample message'});
      }

    , 'aps.badge should be 1': function(result) {
        helpers.nestedProperty(result, {'aps.badge': 1});
      }

    , 'other should be "attribute"': function(result) {
        helpers.nestedProperty(result, {'other': "attribute"});
      }
    }
  }


}).addBatch({


  'Redis rpush yodel:unsubscribe {user_id: 5, token: "sample", platform: "ios"}': {
    topic: function() {
      common.redis.rpush("yodel:unsubscribe"
        , JSON.stringify({user_id: 5, token: "sample", platform: "ios"})
        , this.callback);
    }

  , 'Result should be 1': function(result) {
      should.equal(result, 1);
    }

  , '> Wait for event': {
      topic: function() {
        helpers.actionWatcher.waitForEvent('delete_device:5', this.callback);
      }

    , 'no errors': function(errs, results) {
        should.not.exist(errs);
      }
    }
  }

}).addBatch({

  'Ensure that matching record does not exist in MySQL after 3s': {
    topic: function() {
      common.knex('devices')
        .where({user_id: 5, token: "sample", platform: 2})
        .nodeify(this.callback);
    }

  , 'results should be an array': function(results) {
      results.should.be.instanceof(Array);
    }

  , 'results should have length of 0': function(results) {
      results.should.have.lengthOf(0);
    }
  }

}).export(module);
