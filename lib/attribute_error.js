/*
 *  Yodel
 *  by Spire Labs
 *  MIT Licensed
 */

var util = require('util');

/**
 *  Creates a new attribute specific Error
 *  @constructor
 *  @param {String} attr - The invalid or missing attribute.
 */
var AttributeError = function AttributeError(attr) {
  this.message = 'Invalid or missing attribute: ' + attr;
}

util.inherits(AttributeError, Error);

module.exports = AttributeError;
