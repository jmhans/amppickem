/*jshint esversion: 8 */

const BaseController = require('./base.controller');
var express = require('express');
var router = express.Router();


const Game = require('../models/game');
const ObjectId = require('mongoose').Types.ObjectId;

class GameController extends BaseController{

  constructor() {
    super(Game, 'nflgames');

  }

}

module.exports = GameController
