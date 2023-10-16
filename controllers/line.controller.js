/*jshint esversion: 8 */

const BaseController = require('./base.controller');
var express = require('express');
var router = express.Router();


const Line = require('../models/line').model;
const ObjectId = require('mongoose').Types.ObjectId;

class LineController extends BaseController{

  constructor() {
    super(Line, 'lines');

  }

}

module.exports = LineController
