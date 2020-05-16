var Bot = require('node-telegram-bot-api');
var request = require('request-promise');
var settings = require('./settings.json');

var token = process.env.TOKEN;

class BezumnoeBot {

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      this.bot = new Bot(token);
      this.bot.setWebHook(process.env.HEROKU_URL + token, {});
    } else {
      this.bot = new Bot(token, {
        polling: true
      });
    };

    console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

    this.bot.onText(/^/, message => this.processMessage(message));

    this.bot.on('webhook_error', error => {
      console.warn(error.code);
    });
  }

  processTelegramUpdate(data) {
    console.log('Update', JSON.stringify(data));
    this.bot.processUpdate(data);
  }

  processMessage(message) {
    var text = message.text;
    var command = text.replace(/\/([^@]+)(@.*){0,1}$/g, '$1');
    var fromMainChannel = message.chat.id === settings.channelId;

    switch (command) {
      case 'kick':
        this.kickActions(message, true);
        break;
      case 'unban':
        this.kickActions(message, false);
        break;
      case 'link':
        if (message.chat.type === 'private') {
          this.linkAccounts(message.from.id, message.from.first_name)
            .then(body => {
              this.bot.sendMessage(
                message.chat.id,
                message.from.first_name + ', для связи аккаунтов telegram и bezumnoe.ru перейдите по ссылке ниже и авторизуйтесь:',
                {
                  reply_markup: {
                    inline_keyboard: [[{
                      text: 'Перейти в чат',
                      url: 'http://bezumnoe.ru/t/' + body.uuid
                    }]]
                  }
                }
              );
            });
        } else {
          this.bot.sendMessage(message.chat.id, 'Необходимо обратиться к боту @bezumnoe_bot в приватном чате');
        }
        break;
      default:
        if (fromMainChannel) {
          this.postToChat(message.from.first_name, text, message.from.id)
            .then(body => {
            });
        } else {
          this.bot.sendMessage(message.chat.id, 'Привет, ' + message.from.first_name + '! Заходи в группу https://t.me/bezumnoe');
        }
      }
  }

  processChatUpdate(message) {
    console.log('Chat', JSON.stringify(message));
    var text = message.text;
    var boldLinks = false;
    if (message.user_id === '') {
      // Topic change
      text = '<i>' +  (text.replace(/&[lr]aquo;/g, '"')) + '</i>';
      text = '&#127988; ' + (text.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, ''));
    } else if (message.user_id === message.to_user_id) {
      // /me message
      text = '<i>' + message.user_name + ' ' + text + '</i>';
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
    this.bot.sendMessage(settings.channelId, text, {parse_mode: 'HTML'});
  };

  sendPost(endpoint, data) {
    var options = {
        method: 'POST',
        uri: 'http://bezumnoe.ru/services/' + endpoint + '.php',
        form: data,
        json: true
    }
    return request(options);
  }

  sendPostNew(data) {
    var options = {
        method: 'POST',
        uri: 'https://bzmn.xyz/api/1.0/telegram',
        form: data,
        json: true
    }
    return request(options);
  }

  postToChat(userName, message, userId) {
    this.sendPostNew({user: userName, message: message, user_id: userId});

    return this.sendPost(
      'external_messages.service',
      {user: userName, message: message, user_id: userId}
    );
  }

  linkAccounts(userId, userName) {
    return this.sendPost('telegram_linker.service', {user_id: userId, username: userName});
  }

  kickActions(message, isKick) {
    var reply = message.reply_to_message;
    var fromId = message.from.id;
    var chatId = message.chat.id;
    if (!reply) {
      return this.bot.sendMessage(chatId, 'Это работает только в ответе на сообщение');
    }
    return this.bot.getMe()
      .then(me => {
        if (reply.from.id === me.id) {
          return this.bot.sendMessage(chatId, 'Не балуй!');
        }
        return this.sendPost(
          'rights.service',
          {mtid: fromId, ttid: reply.from.id}
        )
          .then(body => {
            var isAllowed = body.me >= 20 && body.me >= body.target;
            if (isAllowed) {
              var name = reply.from.first_name;
              if (isKick) {
                return this.bot.kickChatMember(chatId, reply.from.id)
                  .then(result => {
                    if (result) {
                      this.bot.sendMessage(chatId, '<i>' + name + ' занесён в черный список</i>', {parse_mode: 'HTML'});
                    }
                  });
              } else {
                return this.bot.unbanChatMember(chatId, reply.from.id)
                  .then(result => {
                    if (result) {
                      this.bot.sendMessage(chatId, '<i>' + name + ' удалён из черного списка</i>', {parse_mode: 'HTML'});
                    }
                  });
              }
            } else {
              return this.bot.sendMessage(chatId, 'Прав маловато...');
            }
          })
      });
  }
};

module.exports = BezumnoeBot;
