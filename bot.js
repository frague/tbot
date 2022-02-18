const {Telegraf} = require('telegraf');

const fetch = require('node-fetch');
const {URLSearchParams} = require('url');

const {channelId, webhookPath, botName} = require('./settings.json');
const {TOKEN, HEROKU_URL, NODE_ENV} = process.env;

const isProduction = NODE_ENV === 'production';

class BezumnoeBot {
  bot;
  
  constructor() {
    this.bot = new Telegraf(TOKEN);

    this.bot.catch((error, ctx) => {
      console.warn(`Bot error occured for ${ctx.updateType}:`, error);
    });

    // Handle commands
    this.registerCommandsHandlers();
    
    // Handle channel messages
    this.bot.on('text', (ctx) => this.processMessage(ctx));
    
    if (isProduction) {
      this.bot.launch({
        webhook: {
          domain: HEROKU_URL,
          hookPath: webhookPath
        }
      });
    } else {
      this.bot.launch();
    };

    console.log(`Telegram bot has started in ${isProduction ? 'production' : 'development'} mode`);

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  webhookCallback() {
    return this.bot.webhookCallback(webhookPath);
  }

  // Handle bot commands
  registerCommandsHandlers() {
    // Kick user (results in banning them in chat/channel)
    this.bot.command('kick', ({message}) => this.kickActions(message, true));

    // Unban user (unbans them in both chat and channel)
    this.bot.command('unban', ({message}) => this.kickActions(message, false));

    this.bot.command('test', (ctx) => {
      console.log('Command', ctx);
    });
    
    // Handles linking chat account with the telegram one
    this.bot.command(
      'link', 
      async ({message, chat, telegram}) => {
        if (chat.type === 'private') {
          const {uuid} = await (await this.linkAccounts(message.from.id, message.from.first_name)).json();

          if (!uuid) {
            return sendMessage(chat.id, 'Невозможно получить ссылку для привязки аккаунта');
          }
            
          telegram.sendMessage(
            chat.id,
            `${message.from.first_name}, для связи аккаунтов telegram и bezumnoe.ru перейдите по ссылке ниже и авторизуйтесь:`,
            {
              reply_markup: {
                inline_keyboard: [[{
                  text: 'Перейти в чат',
                  url: `http://bezumnoe.ru/t/${uuid}`
                }]]
              }
            }
          );
        } else {
          telegram.sendMessage(chat.id, 'Необходимо обратиться к боту @bezumnoe_bot в приватном чате');
        }      
      }
    );
  }

  // Repost telegram messages to web-chats
  processMessage(ctx) {
    const {message: {text, from, message_id}, chat, telegram} = ctx;
    console.log(`${from.first_name}: ${text}`);

    const fromMainChannel = chat.id === channelId;
    if (fromMainChannel) {
      this.postToChats(from, text)
        .then(() => {
          console.log('Message acknowledged:', message_id);
        });
    } else {
      telegram.sendMessage(chat.id, 'Привет, ' + from.first_name + '! Заходи в группу https://t.me/bezumnoe');
    }
  }

  // Repost web-chat messages to telegram
  processChatUpdate(message) {
    console.log('Chat:', message);
    var text = message.text.replace(/&[lr]aquo;/g, '"');
    var boldLinks = false;
    if (message.user_id === '') {
      // Topic change
      text = `&#127988; <i>${text.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '')}</i>`;
    } else if (message.user_id === message.to_user_id) {
      // /me message
      text = `<i>${message.user_name} ${text}</i>`;
    } else if (message.user_id < 0) {
      // Entering: -2, leaving: -3
      text = `${message.user_id === -2 ? '&#10219;' : '&#10218;'} ${text}`;
      boldLinks = true;
    } else {
      // Everything else
      text = `<b>${message.user_name}</b>: ${text}`;
    }
    if (boldLinks) {
      text = text.replace(/<a[^>]*>/g, '<b>').replace(/<\/a>/g, '</b>');
    }
    this.bot.telegram.sendMessage(channelId, text, {parse_mode: 'HTML'});
  };

  postToChats({id, first_name: user, username: tlogin}, message) {
    const data = {user, message, user_id: id, tlogin};
    
    return Promise.all([
      this.postJson('telegram', data),
      this.post('external_messages.service', data)
    ]);
  }

  post(endpoint, data) {
    const body = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => body.append(key, value));
    return fetch(
      `http://bezumnoe.ru/services/${endpoint}.php`,
      {method: 'post', body}
    ).catch((error) => {
      console.log(`Failed to query bezumnoe.ru`, error);
    });
  }

  postJson(endpoint, data) {
    return fetch(
      `https://bzmn.xyz/api/${endpoint}`,
      {
        method: 'post',
        body: JSON.stringify(data),
        headers: {'Content-Type': 'application/json'}
      }
    ).catch((error) => {
      console.log(`Failed to post message to bzmn.xyz`, error);
    });
  }

  linkAccounts(userId, userName) {
    return this.post('telegram_linker.service', {user_id: userId, username: userName});
  }

  async kickActions({reply_to_message: sourceMessage, from: {id: fromId}, chat: {id: chatId}, reply}, isKick) {
    if (!sourceMessage) {
      return reply('Это работает только в ответе на сообщение');
    }
    
    if (sourceMessage.from.username === botName) {
      return reply('Не балуй!');
    }
    
    const {me, target} = await post(
      'rights.service',
      {
        mtid: fromId,
        ttid: sourceMessage.from.id
      }
    );

    if (me >= 20 && me >= target) {
      var name = sourceMessage.from.first_name;
      if (isKick) {
        return this.bot.kickChatMember(chatId, sourceMessage.from.id)
          .then(result => {
            if (result) {
              this.bot.sendMessage(chatId, '<i>' + name + ' занесён в черный список</i>', {parse_mode: 'HTML'});
            }
          });
      } else {
        return this.bot.unbanChatMember(chatId, sourceMessage.from.id)
          .then(result => {
            if (result) {
              this.bot.sendMessage(chatId, '<i>' + name + ' удалён из черного списка</i>', {parse_mode: 'HTML'});
            }
          });
      }
    } else {
      return this.bot.sendMessage(chatId, 'Прав маловато...');
    }
  }
};

module.exports = BezumnoeBot;
