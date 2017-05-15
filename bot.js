var token = process.env.TOKEN;

var Bot = require('node-telegram-bot-api');
var request = require('request');
var channelId = -1001100829569;

var bot;
var fetcher;

function sendPost(endpoint, data, callback) {
  var options = {
      url: 'http://bezumnoe.ru/services/' + endpoint + '.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      form: data
  }

  return request(options, function (error, response, body) {
    if (callback) {
      callback(error, response, body);
    }
  })
}

function postToChat(userName, message) {
  sendPost('external_messages.service', {user: userName, message: message});
}

function linkAccounts(userId, userName) {
  console.log('Linking', userId, userName);
  sendPost(
    'telegram_linker.service',
    {user_id: userId, username: userName},
    function (error, response, body) {
      if (!error && response.statusCode === 200) {
        console.log(response.body);
      }
    }
  );
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
  var text = msg.text;
  var fromMainChannel = msg.chat.id === channelId;
  if (!fromMainChannel) {
    // Bot actions
    switch (text) {
      case '/link':
        linkAccounts(msg.from.id, msg.from.first_name);
        break;
      default:
        bot.sendMessage(msg.chat.id, 'Привет, ' + msg.from.first_name + '! Заходи в группу https://t.me/bezumnoe');
    }
  } else {
    postToChat(msg.from.first_name, text);
  }
});

bot.repost = function (message) {
  var text;
  if (message.user_id === message.to_user_id) {
    text = '<i>' + message.user_name + ' ' + message.text + '</i>';
  } else {
    text = '<b>' + message.user_name + '</b>: ' + message.text;
  }
  this.sendMessage(this.channelId, text, {parse_mode: 'HTML'});
};

bot.on('webhook_error', function (error) {
  console.log(error.code);
});

module.exports = bot;
