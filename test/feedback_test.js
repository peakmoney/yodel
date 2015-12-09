var helpers = require('./helpers');
var common = require('../common');
var resetBatch = require('./reset_batch');
var apnFeedback = require('apn').Feedback;
var feedback = require('../lib/feedback');

describe('Feedback', function() {

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

  describe('processApnFeedback', function() {
    it('user 40 should exist', function() {
      return common.knex('devices').where({user_id: 40, token: 'abc123'}).then(function(results) {
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(1);
      });
    });

    it('feedback.service should be an apn.Feedback object', function(done) {
      feedback.service.should.be.instanceof(apnFeedback);
      done();
    });

    it('emit "feedback"', function(done) {
      feedback.service.emit('feedback', [{device: 'abc123', time: new Date().getTime() }]);
      done();
    });

    it('should wait for Event delete_device:40', function() {
      this.timeout(3500);
      return (helpers.actionWatcher.waitForEvent('delete_device:40')).should.be.fulfilled();
    });

    it('should have unsubscribed user 40', function() {
      return common.knex('devices').where({user_id: 40, token: 'abc123'}).then(function(results) {
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(0);
      });
    });
  });
});
