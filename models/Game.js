const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  firstName: { type: String, required: true },
  username: String,
  giftRecipient: Number // ID користувача, якому дарує подарунок
});

const gameSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  chatTitle: String,
  participants: [participantSchema],
  isStarted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  startedAt: Date
});

module.exports = mongoose.model('Game', gameSchema);
