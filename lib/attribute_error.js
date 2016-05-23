'use strict';

module.exports = class AttributeError extends Error {
  constructor(attr) {
    this.message = `Invalid or missing attribute: ${attr}`;
  }
};
