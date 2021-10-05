const express = require('express');
const Bot = require('./bot');

const {version} = require('./package.json');
const {PORT = 8088} = process.env;

const app = express();
app.use(express.json());

const bot = new Bot();
app.use(bot.webhookCallback('/t'));

app.get('/', (req, res) => res.json({version}));

app.post('/push', ({body}, res) => {
  // Endpoint for chat to push messages to
  bot.processChatUpdate(body);
  res.status(200).end();
});

const server = app.listen(PORT, '0.0.0.0', () => {
  const {address, port} = server.address();
  console.log(`Web server started at https://${address}:${port}`);
});