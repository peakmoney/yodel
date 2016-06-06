'use strict';

const config = require('./config');

console.log(`Using ${config.knex.connection} as DB credentials`);

module.exports = {
  client: 'mysql',
  connection: config.knex.connection,
  migrations: {
    directory: `${__dirname}/migrations`,
  },
};
