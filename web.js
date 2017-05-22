var express = require('express');
var packageInfo = require('./package.json');
var bodyParser = require('body-parser');

var token = process.env.TOKEN;

var app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
  // Returns version
  res.json({
    version: packageInfo.version
  });
});

var server = app.listen(process.env.PORT || 8080, '0.0.0.0', () => {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Web server started at http://%s:%s', host, port);
});

module.exports = Bot => {
  var bezumnoe = new Bot();

  app.post('/' + token, (req, res) => {
    // Endpoint fot telegram to send its updates
    console.log('from channel:', JSON.stringify(req.body));
    bezumnoe.bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  app.post('/push', (req, res) => {
    // Endpoint for chat to push messages to
    var body = req.body;
    bezumnoe.repost(body);
    console.log('from chat:', body);
    res.status(200).end();
  });

};
