var token = process.env.TOKEN;

var Bot = require('node-telegram-bot-api');
var request = require('request-promise');
var channelId = -1001100829569;

var bot;
var fetcher;

function sendPost(endpoint, data) {
  var options = {
      method: 'POST',
      uri: 'http://bezumnoe.ru/services/' + endpoint + '.php',
      form: data,
      json: true
  }
  return request(options);
}

function postToChat(userName, message, userId) {
  return sendPost(
    'external_messages.service', 
    {user: userName, message: message, user_id: userId}
  );
}

function linkAccounts(userId, userName) {
  console.log('Linking', userId, userName);
  return sendPost('telegram_linker.service', {user_id: userId, username: userName});
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
  var command = text.replace(/\/([^@]+)(@.*){0,1}$/g, '$1');
  var fromMainChannel = msg.chat.id === channelId;

  switch (command) {
    case 'link':
      if (msg.chat.type === 'private') {
        linkAccounts(msg.from.id, msg.from.first_name)
          .then(function (body) {
            // console.log(body);
            bot.sendMessage(msg.from.id, 'Для связи аккаунтов telegram и bezumnoe залогиньтесь в чат и перейдите по ссылке http://bezumnoe.ru/t/' + body.uuid);
          });
      } else {
        bot.sendMessage(msg.chat.id, 'Необходимо обратиться к боту @bezumnoe_bot в приватном чате');
      }
      break;
    default:
      if (fromMainChannel) {
        postToChat(msg.from.first_name, text, msg.from.id)
          .then(function (body) {
            console.log('Response:', body);
          });
      } else {
        bot.sendMessage(msg.chat.id, 'Привет, ' + msg.from.first_name + '! Заходи в группу https://t.me/bezumnoe');
      }
    }
});

bot.repost = function (message) {
  var text = message.text;
  var boldLinks = false;
  if (message.user_id === '') {
    // Topic change
    text = '<i>' +  (text.replace(/&[lr]aquo;/g, '"')) + '</i>';
    text = '&#9888; ' + (text.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, ''));
  } else if (message.user_id === message.to_user_id) {
    // /me message
    text = '<i>' + message.user_name + ' ' + text + '</i>';
    console.log(text);
  } else if (message.user_id === -2) {
    // Entering
    text = '&#8680; ' + text;
    boldLinks = true;
  } else if (message.user_id === -3) {
    // Quiting
    text = '&#8678; ' + text;
    boldLinks = true;
  } else {
    // Everything else
    text = '<b>' + message.user_name + '</b>: ' + text;
  }
  if (boldLinks) {
    text = text.replace(/<a[^>]*>/g, '<b>').replace(/<\/a>/g, '</b>');
  }
  this.sendMessage(this.channelId, text, {parse_mode: 'HTML'});
};

bot.on('webhook_error', function (error) {
  console.log(error.code);
});

module.exports = bot;
