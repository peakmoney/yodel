'use strict';

const helpers = require('./helpers');
const common = require('../common');
const resetBatch = require('./reset_batch');
const apnFeedback = require('apn').Feedback;
const APNFeedbackListener = require('../lib/apn_feedback_listener');
const apnFeedbackListener = new APNFeedbackListener();
apnFeedbackListener.listen();

describe('Feedback', function() {

  before(function() {
    return resetBatch().then(function() {
      return common.knex('devices').insert([{
        user_id: 40,
        token:  'abc123',
        platform: 2,
        created_at: new Date(2015, 10, 1),
        updated_at: new Date(2015, 10, 15)
      },{
        user_id: 41,
        token:  '123abc',
        platform: 2,
        created_at: new Date(2015, 10, 1),
        updated_at: new Date(2015, 10, 15)
      }]);
    });
  });

  describe('processApnFeedback', function() {
    it('2 ios users should exist', function() {
      return common.knex('devices').where({platform: 2}).then(function(results) {
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(2);
      });
    });

    it('user 40 should exist', function() {
      return common.knex('devices').where({user_id: 40, token: 'abc123'}).then(function(results) {
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(1);
      });
    });

    it('apnFeedbackListener.listener should be an apn.Feedback object', function(done) {
      apnFeedbackListener.listener.should.be.instanceof(apnFeedback);
      done();
    });

    it('emit "feedback"', function(done) {
      apnFeedbackListener.listener.emit('feedback', [{device: 'abc123', time: new Date().getTime() }]);
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

    it('should have only unsubscribed user 40', function() {
      return common.knex('devices').where({platform: 2}).then(function(results) {
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(1);
      });
    });

    it('should not break emit "feedback"', function(done) {
      apnFeedbackListener.listener.emit('feedback', []);
      done();
    });

    it('emit "feedback" with 2 args', function(done) {
      apnFeedbackListener.listener.emit('feedback', new Date().getTime(), '123abc');
      done();
    });

    it('should wait for Event delete_device:41', function() {
      this.timeout(3500);
      return (helpers.actionWatcher.waitForEvent('delete_device:41')).should.be.fulfilled();
    });


    it('should have unsubscribed user 41', function() {
      return common.knex('devices').where({user_id: 41, token: '123abc'}).then(function(results) {
        results.should.be.instanceof(Array);
        results.should.have.lengthOf(0);
      });
    });
  });
});
