module.exports = {
  test: {
    client: 'mysql',
    connection: {
      "user": "root"
    , "password": ""
    , "database": "yodel_test"
    }
  }
, development: {
    client: 'mysql',
    connection: {
      "user": "root"
    , "password": ""
    , "database": "yodel_dev"
    }
  }
};
