const express = require('express');
const router = express.Router('../index.js');
const bodyParser = require('body-parser');
const User = require('../sql/modello.js');
const jwt = require('jsonwebtoken');


//bcrypt
const bcrypt = require('bcrypt');
const saltRounds = 10;


require('dotenv').config();

var cors = require('cors');
const corsOptions = {
  origin: 'http://localhost:4200',
  credentials: true,
  optionSuccessStatus: 200
}

router.use(cors(corsOptions))

router.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', "http://localhost:4200");
  res.header('Access-Control-Allow-Headers', true);
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  next();
});
router.use(bodyParser.json());
//router.use(bodyParser.urlencoded({ extended: true }));

router.use(express.static('public'));

  
router.post('/register',  (req, res) => {
  console.log(req.body);
    const dati = req.body;
    let psw;
    bcrypt.hash(dati.password, saltRounds, function(err, hash) {
      psw = hash;
      console.log(psw);
      User.create({
        nome: dati.nome,
        email: dati.username,
        psw: psw,
      })
        .then((user) => {
          const accessToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
            expiresIn: 86400 // scade in 24 ore
          });
          const refreshToken = jwt.sign({ email: user.email }, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: 86400 * 7 // scade in 7 giorni
          });
          res.status(200).json({succes: true, message: 'Registrazione avvenuta con successo', accessToken: accessToken, refreshToken: refreshToken});
          return;
        })
        .catch((error) => {
          console.log('nome utente già registrato');
          if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Email già registrata.' });
          }
          console.error('Errore durante l\'inserimento dell\'utente:', error);
          return res.status(500).json({ error: 'Si è verificato un errore durante la registrazione.' });
        });
    });
    

});
router.post('/login', (req, res) => {
  const dati = req.body;
  User.findOne({
    where: {
      email: dati.username
    },
  })
    .then((utente) => {
      if (utente == null) {
        res.status(200).json({ success: false, message: 'L\'utente non esiste.' });
      } else {
        console.log(utente);
        bcrypt.compare(dati.password, utente.psw, function(err, result) {
          if(result) {
            // Le password corrispondono
            const accessToken = jwt.sign({ email: utente.email }, process.env.JWT_SECRET, {
              expiresIn: 86400 // scade in 24 ore
            });
            const refreshToken = jwt.sign({ email: utente.email }, process.env.REFRESH_TOKEN_SECRET, {
              expiresIn: 86400 * 7 // scade in 7 giorni
            });
            res.status(200).json({ success: true, message: 'L\'utente esiste.', accessToken: accessToken, refreshToken: refreshToken, nome: utente.nome});
          } else {
            // Le password non corrispondono
            res.status(200).json({ success: false, message: 'Password errata.' });
          }
        });
      }
    })
    .catch((error) => {
      res.status(500).send('Internal Server Error', 'errore:', error);
      console.log(error);
    });
});

router.get('/checkUser/:username', (req, res) => {
  const requestedUsername = req.params.username;
  User.findOne({
    where: {
      email: requestedUsername,
    },
  })
    .then((utente) => {
      if (utente == null) {
        res.status(200).json({ exists: false, message: 'L\'utente non esiste.' });
      } else {
        res.status(200).json({ exists: true, message: 'L\'utente esiste.' });
      }
    })
    .catch((error) => {
      res.status(500).send('Internal Server Error', 'errore:', error);
    });
  });
  
router.post('/token', authenticateToken, (req, res) => {
    res.send({'logged' : true});
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // se non c'è un token, restituisci un errore 401

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log(err);
      return res.sendStatus(403);
    } // se c'è un errore durante la verifica, restituisci un errore 403
    req.user = user;
    next(); // passa al prossimo middleware
  });
}

router.post('/refreshToken', (req, res) => {
  const refreshToken = req.headers.authorization.split(' ')[1];

  // Verifica refresh token
  if (refreshToken == null) return res.sendStatus(401); // se non c'è un refreshToken, restituisci un errore 401

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // se c'è un errore durante la verifica, restituisci un errore 403

    const accessToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: 86400 }); // crea un nuovo accessToken
    res.json({ accessToken: accessToken });
  });

  // Se il refresh token è valido, emetti un nuovo token e invialo al client
  const newToken = 'nuovoToken';
  res.json({ token: newToken });
});




module.exports = router;