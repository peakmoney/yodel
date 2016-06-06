'use strict';

const config = require('./config');

console.log(`Using ${config.knex.connection} as DB credentials`);

module.exports = {
  client: 'mysql',
  connection: 'mysql://travis:none@127.0.0.1:3306/yodel_test',
  migrations: {
    directory: `${__dirname}/migrations`,
  },
};
