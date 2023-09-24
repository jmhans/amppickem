var express = require('express');
var router = express.Router();

//const players_controller = require('../controllers/players.controller');

//Middle ware that is specific to this router
router.use(function timeLog(req, res, next) {
  console.log('Time: ', Date.now());
  next();
});

//var PlayersController = require('../controllers/players.controller');


//router.use(new PlayersController().reroute());

module.exports = router;
