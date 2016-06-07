'use strict';

const config = require('./config');

module.exports = {
  client: 'mysql',
  connection: connectionConfig,
  migrations: {
    directory: `${__dirname}/migrations`,
  },
};
