let mongoose = require('mongoose')
const Schema = mongoose.Schema;

let Game = require('./game');

var lineSchema = new mongoose.Schema({
  game: {type: Schema.Types.ObjectId, ref: 'NFLGame', required: true},
  type: {type: String, enum:['over', 'under', 'home', 'away'], default: 'home', required: true},
  line: {type: Number, required: true},
  result: {type: Boolean, required: false}

})

module.exports = mongoose.model('Line', lineSchema);

