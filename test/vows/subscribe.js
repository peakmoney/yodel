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


  , '> Ensure that matching record exists in MySQL after 100ms': {
      topic: function() {
        var callback = this.callback;
        setTimeout(function() {
          common.knex('devices')
            .where({user_id: 5, token: "sample", platform: 2})
            .exec(callback);
        }, 500);
      }

    , 'results should be an array': function(results) {
        results.should.be.instanceof(Array);
      }

    , 'results should have length of 1': function(results) {
        results.should.have.lengthOf(1);
      }

    , 'results.0.created_at should be within 1s': function(results) {
        var createdAt    = helpers.nestedProperty(results, '0.created_at').getTime()
          , oneSecondAgo = new Date().getTime() - (1 * 1000);

        oneSecondAgo.should.be.lessThan(createdAt);
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


  , '> Ensure that matching record exists in MySQL after 100ms': {
      topic: function() {
        var callback = this.callback;
        setTimeout(function() {
          common.knex('devices')
            .where({user_id: 5, token: "sample", platform: 2})
            .exec(callback);
        }, 500);
      }

    , 'results should be an array': function(results) {
        results.should.be.instanceof(Array);
      }

    , 'results should have length of 0': function(results) {
        results.should.have.lengthOf(0);
      }
    }
  }


}).export(module);
