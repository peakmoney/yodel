var express = require('express')
  , app     = express();

var DeviceController = require('./controllers/device')

app.post('/*', function(req, res, next) {
  if (req.is('application/json')) {
    next();
  } else {
    res.status(406).send();
  }
});

app.put('/api/device_tokens/:token', DeviceController.subscribe);
app.delete('/api/device_tokens/:token', DeviceController.unsubscribe);

var server = app.listen(3000, function () {
  var host = server.address().address
    , port = server.address().port;

  console.log('node-push listening at http://%s:%s', host, port);
});