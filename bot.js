var token = process.env.TOKEN;

var Bot = require('node-telegram-bot-api');
var request = require('request');
var channelId = -1001100829569;

var bot;
var fetcher;

function postToChat(userName, message) {
  var options = {
      url: 'http://bezumnoe.ru/services/external_messages.service.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      form: {user: userName, message: message}
  }

  request(options, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      // Print out the response body
      console.log(body);
    }
  })
}

if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token, {
  	certificate: 'crt.pem'
  });
} else {
  bot = new Bot(token, {
    polling: true 
  });
};

bot.channelId = channelId;

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

bot.onText(/^/, function (msg) {
  if (msg.chat.id !== channelId) {
    bot.sendMessage(msg.chat.id, 'Привет, ' + msg.from.first_name + '! Заходи в группу https://t.me/bezumnoe');
  } else {
    postToChat(msg.from.first_name, msg.text);
  }
});

bot.repost = function (message) {
  var text = '<b>' + message.user_name + '</b>' + (message.user_id === message.to_user_id ? ' ' : ': ') + message.text;
  this.sendMessage(this.channelId, text, {parse_mode: 'HTML'});
};

bot.on('webhook_error', function (error) {
  console.log(error.code);
});

module.exports = bot;
