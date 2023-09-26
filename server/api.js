// server/api.js
/*
 |--------------------------------------
 | Dependencies
 |--------------------------------------
 */

const { expressjwt: jwt} = require('express-jwt');
const jwks = require('jwks-rsa');

const https = require('https');

/*
 |--------------------------------------
 | Authentication Middleware
 |--------------------------------------
 */

module.exports = function(app) {
  // Authentication middleware
  const jwtCheck = jwt({
    secret: jwks.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
    }),
    audience: process.env.AUTH0_API_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
  });

  const adminCheck = (req, res, next) => {
    const roles = req.user[process.env.NAMESPACE] || [];

    if (roles.indexOf('admin') > -1) {
      next();
    } else {
      res.status(401).send({message: 'Not authorized for admin access'});
    }
  }


/*
 |--------------------------------------
 | API Routes
 |--------------------------------------
 */

  // GET API root

  app.get('/api/', (req, res) => {
    res.send('API works');
  });



  var api = require('../routes/api.route');
  app.use('/api', api);

};

