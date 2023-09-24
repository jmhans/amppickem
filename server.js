var express = require("express");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;
var mongoose = require('mongoose');

//const config2 = require('./server/config');
const cors = require('cors');
const methodOverride = require('method-override');
const dotenv = require('dotenv');


var result = dotenv.config();
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true,useUnifiedTopology: true});


var app = express();

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(cors());

// Create link to Angular build directory
var distDir = __dirname + "/dist/";
app.use(express.static(distDir));

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db = mongoose.connection;


// Not actually sure if I want this to be called...
require('./server/api')(app);

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log("Database connection ready");
  // Initialize the app.
  var server = app.listen(process.env.PORT || 3000, '0.0.0.0', function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });




})




// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}




//var api = require('./routes/api.route');
//app.use('/api', api);

app.use('/', function (req, res) {
    res.sendFile(distDir+'/index.html');
});
