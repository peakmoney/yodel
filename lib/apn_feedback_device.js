'use strict';

module.exports = class APNFeedbackDevice {
  constructor(attrs) {
    this.token = attrs.token;
    this.user_id = attrs.user_id;
    this.platform = 'ios';
  }
};
