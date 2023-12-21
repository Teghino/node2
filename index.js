const express = require('express');
const app = express();

const utentiRout = require('./router/utenti');

const bodyParser = require('body-parser');
var cors = require('cors');
const corsOptions = {
    origin: 'http://localhost:4200',
    credentials: true,
    optionSuccessStatus: 200
  }
  
  app.use(cors(corsOptions))
  
  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', "http://localhost:4200");
    res.header('Access-Control-Allow-Headers', true);
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    next();
  });

  
app.use('/api', utentiRout);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));


app.get('/', (req, res) => {
    res.sendFile('login.html', {root: __dirname + '/public'});
});


app.listen(3000);