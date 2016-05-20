'use strict';

const common = require('../../common');
const EventEmitter = require('events').EventEmitter;
const jdg = require('jdg');
const Promise = require('bluebird');

module.exports = class ActionWatcher extends EventEmitter {
  constructor() {
    super();
    this.buffer = {};

    this.redis = common.newRedisClient('redis');
    this.redis.on('ready', () => this.redis.subscribeAsync('yodel:events'));

    this.redis.on('message', (channel, message) => {
      const result = JSON.parse(message);
      const event = `${message.action}:${message.user_id}`;
      const listeners = this.listeners(event);

      if (listeners.length > 0) {
        this.emit(event, result);
      } else {
        this.buffer[channel] = result;
      }
    });
  }

  clearBuffer() {
    this.buffer = {};
  }

  waitForEvent(event) {
    const self = this;
    const key = 'yodel:events';
    let polls = 6;

    function poll() {
      return Promise.delay(500).then(() => {
        if (jdg.is.present(self.buffer[key])) {
          const result = self.buffer[key];
          delete self.buffer[key];
          return result;
        } else if (polls.length < 1) {
          throw new Error(`Event ${event} never happened`);
        } else {
          polls--;
          return poll();
        }
      });
    }

    return poll();
  }

  waitForPush(userId) {
    let polls = 6;

    function poll() {
      return Promise.delay(500).then(() =>
        common.redis.lpopAsync('yodel:push').then(result => {
          if (jdg.is.present(result)) {
            return JSON.parse(result);
          } else if (polls.length < 1) {
            throw new Error(`Push for User ${userId} never happened`);
          } else {
            polls--;
            return poll();
          }
        })
      );
    }

    return poll();
  }
};
