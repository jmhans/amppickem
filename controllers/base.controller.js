var express = require('express');
var router = express.Router();

class BaseController {
  constructor(model, routeString) {
    this.model = model
    this.routeString = routeString;
    }

  //Simple version, without validation or sanitation
_get(req, res, next) {
  this.model.find().then(function(results) {
    res.json(results);
  }).catch(function(err) {
    return next(err)
  });
  }


_getByQuery(req, res, next) {
  console.log(req.query);
  for (var q in req.query) {
    req.query[q] = req.query[q].split(",")
  }
  console.log(req.query);

  this.model.find(req.query).exec( function(err, data) {
    if (err) return next(err);
    res.json(data)
  })
}

_create(req, res, next) {
  if(req.body._id === null) {
    delete req.body._id;
  }
  this.model.create(req.body, function (err, post) {
    if (err) return next(err);
    res.json(post);
  });
}

_getOne(req, res, next) {
  this.model.findById(req.params.id, function (err, post) {
    if (err) return next(err);
    res.json(post);
  });
}

_update (req, res, next) {
  var options = {new : true, upsert : true, useFindAndModify: false};
  this.model.findByIdAndUpdate(req.params.id, req.body, options,  function (err, post) {
    if (err) return next(err);
    res.json(post);
  });
}

_delete(req, res, next) {
  this.model.findByIdAndRemove(req.params.id, req.body, function (err, post) {
    if (err) return next(err);
    res.json(post);
  });
}


  route() {
    router.get('/' + this.routeString, (...args) => this._get(...args));
    router.post('/' + this.routeString , (...args) => this._create(...args));
    router.get('/' + this.routeString + '/:id', (...args) => this._getOne(...args));
    router.put('/' + this.routeString + '/:id', (...args) => this._update(...args));
    router.delete('/' + this.routeString + '/:id', (...args) => this._delete(...args));
    router.get('/' + this.routeString + '/query/q', (...args) => this._getByQuery(...args));
    return router;
  }

}

module.exports = BaseController

