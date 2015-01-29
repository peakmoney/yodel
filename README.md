# Yodel
A lightweight Android and iOS push notification server that reads from a simple 
Redis API and delivers notifications via GCM and APN.

## Sample Redis API Requests

##### Subscribe
```
rpush yodel:subscribe '{"user_id":5, "token":"sample", "platform":"ios"}'
```

##### Unsubscribe
```
rpush yodel:unsubscribe '{"user_id":5, "token":"sample", "platform":"ios"}'
```

##### Notify
```
rpush yodel:notify '{"user_id":5, "message":"This is a test", "payload": {"sample": "payload"}}'
```

## Getting Started
Yodel is meant to run as an independent Node service on Node 0.10.x and above. After cloning the
repository, add the following files in a config folder within the root project directory:

##### knexfile.js (required)
```javascript
module.exports = {
  development: {
    client: 'mysql',
    connection: {
      "user": "root"
    , "password": "test"
    , "database": "stentor_dev"
    }
  }
};
```

##### redis.json (optional)
```json
{
  "development": {
    "host": "127.0.0.1",
    "port": 6379,
    "database": 1
  }
}
```

##### apn.json (optional)
```json
{
  "development": {
    "cert": "sample cert or path to cert.pem",
    "key": "sample key or path to key.pem"
  }
}
```

##### gcm.json (optional)
```json
{
  "development": {
    "server_api_key": "sample"
  }
}
```

##### sentry.json (optional)
```json
{
  "development": {
    "dsn": "https://..."
  }
}
```

Ensure that you have MySQL and Redis running, and that you're MySQL server has a database 
matching you're knexfile. At that point, install npm packages and run the DB migration:

```
npm install
tasks/migrate
```

You should be ready to start yodel now:

```
npm start
```
