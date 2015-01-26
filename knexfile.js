var common = require('./common');

module.exports = {
  development: {
    client: 'mysql',
    connection: common.config('mysql')
  }
};
