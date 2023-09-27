/*jshint esversion: 8 */

const BaseController = require('./base.controller');
var express = require('express');
var router = express.Router();


const Participant = require('./../models/participant');
const ObjectId = require('mongoose').Types.ObjectId;

class ParticipantController extends BaseController{

  constructor() {
    super(Participant, 'participants');

  }

}

module.exports = ParticipantController
