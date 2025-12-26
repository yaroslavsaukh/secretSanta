require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const Game = require('./models/Game');
const express = require('express');

// Підключення до MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Підключено до MongoDB'))
  .catch(err => console.error('❌ Помилка підключення до MongoDB:', err));

// Створення бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// HTTP сервер для Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🎅 Secret Santa Bot is running!');
});

app.listen(PORT, () => {
  console.log(`🌐 HTTP сервер запущено на порту ${PORT}`);
});

console.log('🎅 Бот Секретного Санти запущено!');

// Команда /start у приватному чаті
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, 
      '🎄 Вітаю! Я бот для гри в Секретного Санту!\n\n' +
      '📝 Щоб почати:\n' +
      '1. Додайте мене до групового чату\n' +
      '2. Надайте мені права адміністратора\n' +
      '3. Використайте команду /join щоб приєднатися до гри\n' +
      '4. Коли всі учасники приєднаються, використайте /startgame\n\n' +
      '📋 Інші команди:\n' +
      '/help - Список команд\n' +
      '/participants - Список учасників\n' +
      '/cancel - Скасувати гру'
    );
  }
});

// Команда /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId,
    '📋 Доступні команди:\n\n' +
    '/start - Почати роботу з ботом\n' +
    '/join - Приєднатися до гри (у групі)\n' +
    '/participants - Переглянути учасників\n' +
    '/startgame - Почати гру і розподілити учасників\n' +
    '/cancel - Скасувати гру і очистити учасників\n' +
    '/help - Показати цю довідку'
  );
});

// Команда /join - приєднання до гри
bot.onText(/\/join/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const username = msg.from.username;
  
  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, '❌ Ця команда працює тільки в групових чатах!');
    return;
  }
  
  try {
    let game = await Game.findOne({ chatId });
    
    if (!game) {
      game = new Game({
        chatId,
        chatTitle: msg.chat.title,
        participants: []
      });
    }
    
    if (game.isStarted) {
      bot.sendMessage(chatId, '❌ Гра вже розпочата! Неможливо додати нових учасників.');
      return;
    }
    
    // Перевірка чи користувач вже доданий
    const alreadyJoined = game.participants.some(p => p.userId === userId);
    
    if (alreadyJoined) {
      bot.sendMessage(chatId, `${firstName}, ви вже приєдналися до гри! 🎁`);
      return;
    }
    
    // Додавання учасника
    game.participants.push({
      userId,
      firstName,
      username
    });
    
    await game.save();
    
    bot.sendMessage(chatId, 
      `✅ ${firstName} приєднався до гри!\n\n` +
      `👥 Всього учасників: ${game.participants.length}\n\n` +
      `Мінімум 3 учасники потрібно для початку гри.`
    );
    
  } catch (error) {
    console.error('Помилка при додаванні учасника:', error);
    bot.sendMessage(chatId, '❌ Виникла помилка. Спробуйте ще раз.');
  }
});

// Команда /participants - показати учасників
bot.onText(/\/participants/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, '❌ Ця команда працює тільки в групових чатах!');
    return;
  }
  
  try {
    const game = await Game.findOne({ chatId });
    
    if (!game || game.participants.length === 0) {
      bot.sendMessage(chatId, '📝 Ще немає учасників. Використайте /join щоб приєднатися!');
      return;
    }
    
    let message = '👥 Учасники гри:\n\n';
    game.participants.forEach((p, index) => {
      message += `${index + 1}. ${p.firstName}${p.username ? ' (@' + p.username + ')' : ''}\n`;
    });
    
    message += `\n🎁 Всього: ${game.participants.length} учасників`;
    
    if (game.isStarted) {
      message += '\n\n✅ Гра розпочата!';
    } else {
      message += '\n\n⏳ Очікування початку гри...';
    }
    
    bot.sendMessage(chatId, message);
    
  } catch (error) {
    console.error('Помилка при отриманні учасників:', error);
    bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
});

// Команда /startgame - почати гру
bot.onText(/\/startgame/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, '❌ Ця команда працює тільки в групових чатах!');
    return;
  }
  
  try {
    const game = await Game.findOne({ chatId });
    
    if (!game || game.participants.length === 0) {
      bot.sendMessage(chatId, '❌ Немає учасників! Спочатку приєднайтеся за допомогою /join');
      return;
    }
    
    if (game.participants.length < 3) {
      bot.sendMessage(chatId, 
        `❌ Недостатньо учасників! Потрібно мінімум 3, зараз: ${game.participants.length}`
      );
      return;
    }
    
    if (game.isStarted) {
      bot.sendMessage(chatId, '❌ Гра вже розпочата!');
      return;
    }
    
    // Розподіл учасників
    const shuffled = shuffleArray([...game.participants]);
    
    // Кожен учасник дарує наступному (останній дарує першому)
    for (let i = 0; i < shuffled.length; i++) {
      const giver = shuffled[i];
      const receiver = shuffled[(i + 1) % shuffled.length];
      
      // Оновлення інформації про отримувача
      const participant = game.participants.find(p => p.userId === giver.userId);
      participant.giftRecipient = receiver.userId;
      
      // Відправка особистого повідомлення
      try {
        await bot.sendMessage(
          giver.userId,
          `🎅 Секретний Санта!\n\n` +
          `🎁 Ви дарує подарунок для: ${receiver.firstName}${receiver.username ? ' (@' + receiver.username + ')' : ''}\n\n` +
          `🤫 Тримайте це в таємниці!\n\n` +
          `Група: ${game.chatTitle}`
        );
      } catch (error) {
        console.error(`Не вдалося надіслати повідомлення користувачу ${giver.firstName}:`, error);
        bot.sendMessage(chatId, 
          `⚠️ Не можу надіслати повідомлення ${giver.firstName}. ` +
          `Переконайтеся, що користувач спочатку написав боту /start у приватному чаті.`
        );
      }
    }
    
    game.isStarted = true;
    game.startedAt = new Date();
    await game.save();
    
    bot.sendMessage(chatId,
      '✅ Гру розпочато!\n\n' +
      `🎄 ${game.participants.length} учасників отримали повідомлення про своїх одержувачів подарунків.\n\n` +
      '📬 Якщо хтось не отримав повідомлення, переконайтеся що ви написали боту /start у приватному чаті!'
    );
    
  } catch (error) {
    console.error('Помилка при запуску гри:', error);
    bot.sendMessage(chatId, '❌ Виникла помилка при запуску гри.');
  }
});

// Команда /cancel - скасувати гру
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, '❌ Ця команда працює тільки в групових чатах!');
    return;
  }
  
  try {
    const game = await Game.findOne({ chatId });
    
    if (!game) {
      bot.sendMessage(chatId, '❌ Немає активної гри для скасування.');
      return;
    }
    
    await Game.deleteOne({ chatId });
    
    bot.sendMessage(chatId, 
      '🗑 Гру скасовано і всі дані очищено.\n\n' +
      'Використайте /join щоб почати нову гру!'
    );
    
  } catch (error) {
    console.error('Помилка при скасуванні гри:', error);
    bot.sendMessage(chatId, '❌ Виникла помилка.');
  }
});

// Функція для перемішування масиву (Fisher-Yates shuffle)
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Обробка помилок
bot.on('polling_error', (error) => {
  console.error('Помилка polling:', error);
});
