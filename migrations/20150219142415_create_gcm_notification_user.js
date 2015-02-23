'use strict';

exports.up = function(knex, Promise) {
  return Promise.all([
    knex.schema.createTable('gcm_notification_users', function(table) {
      table.increments();
      table.integer('user_id').unsigned().notNullable();
      table.string('notification_key_name', 177).notNullable();
      table.text('notification_key').notNullable();
      table.datetime('created_at').notNullable();
      table.datetime('updated_at').notNullable();
      table.charset('utf8mb4');
      table.collate('utf8mb4_unicode_ci');
      table.unique(['user_id']);
    })
  ]);
};

exports.down = function(knex, Promise) {
  return Promise.all([
    knex.schema.dropTableIfExists('gcm_notification_users')
  ]);
};
