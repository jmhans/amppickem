var express = require('express');
var router = express.Router();

//const players_controller = require('../controllers/players.controller');

//Middle ware that is specific to this router
router.use(function timeLog(req, res, next) {
  console.log('Time: ', Date.now());
  next();
});

var NFLController = require('../controllers/nfl.controller');
var ParticipantController = require('../controllers/participant.controller');
var GameController = require('../controllers/game.controller');
var LineController = require('../controllers/line.controller');


router.use(new NFLController().route());
router.use(new ParticipantController().route());
router.use(new GameController().route());
router.use(new LineController().route());

module.exports = router;
