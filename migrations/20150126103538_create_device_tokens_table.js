'use strict';

exports.up = function(knex, Promise) {
  return Promise.all([
    knex.schema.createTable('device_tokens', function(table) {
      table.increments();
      table.integer('user_id').unsigned().notNullable();
      table.string('device_token', 177).notNullable();
      table.integer('platform').unsigned().notNullable();
      table.datetime('created_at').notNullable();
      table.datetime('updated_at').notNullable();
      table.charset('utf8mb4');
      table.collate('utf8mb4_unicode_ci');
      table.unique(['user_id','device_token']);
    })
  ]);
};

exports.down = function(knex, Promise) {
  return Promise.all([
    knex.schema.dropTableIfExists('device_tokens')
  ]);
};
