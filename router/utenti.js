const express = require('express');
const router = express.Router('../index.js');
const bodyParser = require('body-parser');
const {User, Oggetto, Tipologia, Tipo_oggetto, Taglie, Taglie_disponibili} = require('../sql/modello.js');
const jwt = require('jsonwebtoken');

//caricamento foto
const multer = require('multer');
const fs = require('fs');
const path = require('path');


const dir = path.join(__dirname, 'uploads');

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, dir); // usa 'dir' qui invece di './uploads/'
  },
  filename: function(req, file, cb) {
    //const date = new Date().toISOString().replace(/:/g, '-'); // sostituisci ':' con '-'
    cb(null, req.user.email + '.png');
  }
});

const upload = multer({ storage: storage });


//bcrypt 
const bcrypt = require('bcrypt');
const saltRounds = 10;

//cookie
const cookieParser = require('cookie-parser');
router.use(cookieParser());

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

// router.post('/download', authenticateToken, async (req, res) => {
//   try {
//   Prodotto.findOne({
//     where: {
//       sesso: 'u'
//     },
//   }).then(async (prodotto) => {
//       res.status(200).json({success: true, message: 'File scaricato con successo.', prodotto: 'https://fotonegozio.blob.core.windows.net/foto/' + prodotto.nome + '.png'});
//   });
//   } catch (error) {
//     console.error('Errore durante il download del file:', error);
//     res.status(500).json({ error: 'Si è verificato un errore durante il download del file.' });
//   }
// });

router.post('/ricercaTipologie', authenticateToken, (req, res) => {
  
  Oggetto.findAll({
    include: [{
      model: Tipologia,
      attributes: [],
      through: { model: Tipo_oggetto, attributes: [] },
      where: { nome: req.body.tipologia }
    }]
  }).then(oggetti => {
    console.log(oggetti);
    res.status(200).json({success: true, message: 'Tipologie trovate con successo.', oggetti: oggetti});
  }).catch(error => {
    console.error('Errore durante la ricerca delle tipologie:', error);
    res.status(500).json({ error: 'Si è verificato un errore durante la ricerca delle tipologie.' });
  });
});

router.post('user/email', authenticateToken, (req, res) => {
  res.status(200).json({email: req.user.email});
});
  
router.get('/prodotto/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
    Taglie.findAll({
      include: [{
        model: Oggetto,
        attributes: [],
        through: { model: Taglie_disponibili, attributes: [] },
        where: { id: id }
      }]
    }).then(taglie => {
      console.log(taglie + 'ciao');
      res.status(200).json({success: true, message: 'Oggetto trovato con successo.', taglie: taglie});
    }).catch(error => {
      console.error('Errore durante la ricerca delle taglie:', error);
      res.status(500).json({ error: 'Si è verificato un errore durante la ricerca delle taglie.' });
    });  
});

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
  const token = req.cookies.accessToken; // Leggi il token dal cookie
  if (token == null){
    console.log('token non trovato');
    return res.sendStatus(401); // se non c'è un token, restituisci un errore 401
  } 

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log(err);
      return res.sendStatus(403);
    } // se c'è un errore durante la verifica, restituisci un errore 403
    req.user = user;
    next(); // passa al prossimo middleware
  });
}

router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  // Verifica refresh token
  if (refreshToken == null) return res.sendStatus(401); // se non c'è un refreshToken, restituisci un errore 401


  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // se c'è un errore durante la verifica, restituisci un errore 403
  
    const accessToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
       expiresIn: 86400 
    }); // crea un nuovo accessToken
    const newRefreshToken = jwt.sign({ email: user.email }, process.env.REFRESH_TOKEN_SECRET, { 
       expiresIn: 86400 * 7 
    }); // crea un nuovo refreshToken
  
    res.json({ token: accessToken, refreshToken: newRefreshToken});
  });
  
  
  
});


router.post('/upload', authenticateToken, upload.single('image'), (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send({ success: false, message: 'Nessun file caricato.' });
  }
  res.status(200).send({ success: true, message: 'File caricato con successo.' });
}, (error, req, res, next) => {
  console.log(error);
  res.status(500).send({ success: false, message: 'Si è verificato un errore.' });
});

module.exports = router;

router.post('/user/image', authenticateToken, (req, res) => {
  const userEmail = req.user.email; // Assumendo che l'email dell'utente sia disponibile in req.user.email
  const imagePath = path.join(__dirname, 'uploads', `${userEmail}.png`); // Assumendo che l'immagine sia un PNG
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File non esiste:', err);
      return res.status(404).json({ error: 'Immagine non trovata.' });
    }
    res.sendFile(imagePath);
  });
},error => {
  console.log(error);
  res.status(500).send({ success: false, message: 'Si è verificato un errore.' });
});