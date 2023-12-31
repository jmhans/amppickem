/*jshint esversion: 8 */

const qs = require('qs');
const fs = require('fs');
const axios = require('axios');

var express = require('express');
var router = express.Router();
const NFLGame = require('./../models/game').NFLGame;
const Line = require('./../models/line').model;


  const ABBREV_MAP = {
    "GREEN BAY PACKERS": "GB",
    "ATLANTA FALCONS": "ATL",
    "BALTIMORE RAVENS": "BAL",
    "BUFFALO BILLS": "BUF",
    "DETROIT LIONS": "DET",
    "HOUSTON TEXANS": "HOU",
    "INDIANAPOLIS COLTS": "IND",
    "MIAMI DOLPHINS": "MIA",
    "NEW YORK GIANTS": "NYG",
    "ARIZONA CARDINALS": "ARI",
    "LOS ANGELES RAMS": "LA",
    "CHICAGO BEARS": "CHI",
    "DENVER BRONCOS": "DEN",
    "NEW ORLEANS SAINTS": "NO",
    "PITTSBURGH STEELERS": "PIT",
    "PHILADELPHIA EAGLES": "PHI",
    "TENNESSEE TITANS": "TEN",
    "CLEVELAND BROWNS": "CLE",
    "NEW ENGLAND PATRIOTS": "NE",
    "KANSAS CITY CHIEFS": "KC",
    "CAROLINA PANTHERS": "CAR",
    "OAKLAND RAIDERS": "OAK",
    "LOS ANGELES CHARGERS": "LAC",
    "WASHINGTON REDSKINS": "WAS",
    "SEATTLE SEAHAWKS": "SEA",
    "TAMPA BAY BUCCANEERS": "TB",
    "MINNESOTA VIKINGS": "MIN",
    "JACKSONVILLE JAGUARS": "JAX",
    "DALLAS COWBOYS": "DAL",
    "CINCINNATI BENGALS": "CIN",
    "LAS VEGAS RAIDERS" : "LV"
  }


class NFLController {

  scoreboard() { return `${this.NFL}`}

  constructor() {
    this.NFL = `http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`;

  }

  async makeAPIrequest(url) {
        let response;

        try {
            response = await axios({
            url: url,
                method: 'get',
                timeout: 10000,
            });

            const jsonData = response.data
            return jsonData;
        } catch (err) {
            console.error(`Error in makeAPIrequest(): ${err}`);
        }
    }


  async getFullScoreboard(wk) {
    const extra = wk ? `?week=${wk}` : ''
    try {
      const results = await this.makeAPIrequest(this.NFL + extra);
      return {events: results.events, leagues: results.leagues};
    } catch (err) {
      console.error(`Error in getFullScoreboard(): ${err}`);
    }
  }


  async gameSched(wk) {
    const sb = await this.getFullScoreboard(wk);

    var gameDates = sb.events.map((evt)=> new Date(evt.date)).sort((a, b)=> {
      if (a<b)return -1;
      if (b<a) return 1;
      return 0;
    });
    return  sb


  }


  async _getScoreboard(req, res, next) {

    try {

        //this.WEEK = req.params.weekId ? req.params.weekId : this.WEEK;
        const sb = await this.getFullScoreboard(req.params.weekId);
        return res.send(sb);

    } catch (err) {
      console.error(`Error in getScoreboard(): ${err}`);
      return res.status(500).send({message: err.message});

    }



  }


  async _saveNFLGameToDB(nflGame) {

    const query = {'nflGameId': nflGame.nflGameId}
    try {
      let loadedGame = await NFLGame.findOneAndUpdate(query,  nflGame, {upsert: true, new: true})

      return loadedGame
    }
    catch (err) {
      console.log(`Error in _saveNFLGameToDB: ${err}`)
    }
  }
  async _saveGames(req, res, next) {
    try {

        //this.WEEK = req.params.weekId ? req.params.weekId : this.WEEK;
        const sb = await this.getFullScoreboard(req.params.weekId);
        const updateOdds = req.query.updateOdds || false
        let translated = []
        for(let evt of sb.events) {
          for (let comp of evt.competitions ) {

            //let comp = evt.competitions[comp_i]
            let homeTeam =comp.competitors.find((c)=> {return c.homeAway== 'home'})
            let awayTeam =comp.competitors.find((c)=> {return c.homeAway== 'away'})

              let baseObj ={
                  nflGameId: evt.id,
                  gameTime: evt.date,
                  status: evt.status.type.description,
                  homeTeam: {fullName: homeTeam.team.displayName, abbreviation: homeTeam.team.abbreviation},
                  awayTeam: {fullName: awayTeam.team.displayName, abbreviation: awayTeam.team.abbreviation},
                  score: {"home": parseInt(homeTeam.score), "away": parseInt(awayTeam.score), "total": parseInt(homeTeam.score)+parseInt(awayTeam.score)},
                  season: evt.season.year,
                  week: evt.week.number,
                  location: comp.venue.fullName
                }

                if (updateOdds && comp.odds && comp.odds.length >=1 ) {
                  const spreadReg = new RegExp('^(?<tm>.*) (?<spread>.*)$', 'gm')
                  if (comp.odds && comp.odds.length >=1 ) {
                    let baseOdds = spreadReg.exec(comp.odds[0].details).groups
                    //console.log(baseOdds)
                    let newObj ={...baseObj, odds: { team: baseOdds.tm, spread: baseOdds.spread,...comp.odds[0]}}
                    console.log(newObj)
                    let saved = await this._saveNFLGameToDB(newObj)
                    translated.push(saved)

                  }

                } else {
                  let saved = await this._saveNFLGameToDB(baseObj)
                  translated.push(saved)
                }

              }

            }

        return res.send(translated);

    } catch (err) {
      console.error(`Error in _saveGames(): ${err}`);
      return res.status(500).send({message: err.message});

    }
  }



  translateSpread(tm, spreadInfo) {

  }

  route() {
    router.get('/nfl/scoreboard', (...args) => this._getScoreboard(...args))
    router.get('/nfl/scoreboard/:weekId', (...args)=> this._getScoreboard(...args))
    router.get('/nfl/scores/save', (...args) => this._saveGames(...args))
    router.get('/nfl/scores/save/:weekId', (...args) => this._saveGames(...args))
    return router;
  }
}

module.exports = NFLController
