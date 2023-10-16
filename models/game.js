let mongoose = require('mongoose')
let Line = require('./line').schema;


var gameSchema = new mongoose.Schema({

  homeTeam: {type: {fullName: String, abbreviation: String}, required: true},
  awayTeam: {type: {fullName: String, abbreviation: String}, required: true},
  score: {type: {home: Number, away: Number, total: Number}, required: false},
  gameTime: {type: Date, required: true},
  status: {type: String, required: false},
  nflGameId: {type: String, required: false},
  week: {type: Number, required: false},
  season: {type: Number, required: false},
  location: {type: String, required: false},
  odds: {type: {details: String, overUnder: Number}, required: false}

})
var gamelineSchema = new mongoose.Schema({

  homeTeam: {type: {fullName: String, abbreviation: String}, required: true},
  awayTeam: {type: {fullName: String, abbreviation: String}, required: true},
  score: {type: {home: Number, away: Number, total: Number}, required: false},
  gameTime: {type: Date, required: true},
  status: {type: String, required: false},
  nflGameId: {type: String, required: false},
  week: {type: Number, required: false},
  season: {type: Number, required: false},
  location: {type: String, required: false},
  line: [{type: Line , required: false}]

})


module.exports = {NFLGame: mongoose.model('NFLGame', gameSchema) , GameLine: mongoose.model('gameline', gamelineSchema, 'gameswithlines')};

