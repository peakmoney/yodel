'use strict';

const config = require('./config');

module.exports = {
  client: 'mysql',
  connection: config.knex.connection,
  migrations: {
    directory: `${__dirname}/migrations`,
  },
};
