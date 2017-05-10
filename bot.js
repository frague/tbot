var token = process.env.TOKEN;

var Bot = require('node-telegram-bot-api');
var bot;
var fetcher;

var syncer = function() {
  console.log('Loop');
  fetcher = setTimeout(syncer, 2000);
};

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

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

bot.onText(/^/, function (msg) {
  var name = msg.from.first_name;
  bot.sendMessage(msg.chat.id, 'Hello, ' + name + '!').then(
    function () {
    }
  );
});

bot.on('webhook_error', function (error) {
  console.log(error.code);
});

syncer();

module.exports = bot;
