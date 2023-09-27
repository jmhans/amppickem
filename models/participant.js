let mongoose = require('mongoose')
const Schema = mongoose.Schema;
let Line = require('./line');

var participantSchema = new mongoose.Schema({
  name: {type: String, required: false},
  pools: {type: [String], required: false},
  userId: {type: String, required: false},
  picks: [{type: Schema.Types.ObjectId, ref: 'Line', required: false}]
})

module.exports = mongoose.model('Participant', participantSchema);
