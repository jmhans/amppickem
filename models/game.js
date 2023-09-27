let mongoose = require('mongoose')

var gameSchema = new mongoose.Schema({

  homeTeam: {type: String, required: true},
  awayTeam: {type: String, required: true},
  score: {type: {home: Number, away: Number}, required: false},
  gameTime: {type: Date, required: true},
  status: {type: String, required: false}

})

module.exports = mongoose.model('NFLGame', gameSchema);

