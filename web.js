var express = require('express');
var packageInfo = require('./package.json');
var bodyParser = require('body-parser');

var channelId = -1001095005836;

var app = express();
app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.json({ version: packageInfo.version });
});

var server = app.listen(process.env.PORT, "0.0.0.0", function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Web server started at http://%s:%s', host, port);
});

module.exports = function (bot) {
  app.post('/' + bot.token, function (req, res) {
    console.log(JSON.stringify(req.body));
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  app.post('/push', function (req, res) {
    var body = req.body;

    bot.sendMessage(channelId, body.user_name + ': ' + body.text);
    console.log('POST received:', req.body);
    res.status(200).end();
  });

};
