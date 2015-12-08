var helpers = require('./helpers');
var common = require('../common');
var redis = common.redis;
var knex = common.knex;

var apnFeedback = require('apn').Feedback;
var FeedbackService = require('../lib/listeners/feedback');

describe('Feedback', function() {
  describe('processApnFeedback', function() {
    var feedback;

    before(function(done) {
      feedback = FeedbackService();

      knex('devices').insert({
        user_id: 40,
        token:  'abc123',
        platform: 2,
        created_at: new Date(2015, 10, 1),
        updated_at: new Date(2015, 10, 15)
      }).nodeify(done);
    });

    it('user 40 should exist', function(done) {
      knex('devices').where({user_id: 40, token: 'abc123'}).nodeify(function(err, results) {
        if (err) { return done(err); }
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(1);
        done();
      });
    });

    it('feedback.apnService should be an apn.Feedback object', function(done) {
      feedback.apnService.should.be.instanceof(apnFeedback);
      done();
    });

    it('emit "feedback"', function(done) {
      feedback.apnService.emit('feedback', [{device: 'abc123', time: new Date().getTime() }]);
      done();
    });

    it('should wait for Event delete_device:40', function(done) {
      this.timeout(3500);
      helpers.actionWatcher.waitForEvent('delete_device:40', function(err) {
        if (err) return done(err);
        done();
      });
    });

    it('should have unsubscribed user 40', function(done) {
      knex('devices').where({user_id: 40, token: 'abc123'}).nodeify(function(err, results) {
        if (err) { return done(err); }
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(0);
        done();
      });
    });
  });
});
