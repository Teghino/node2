const express = require('express');
const router = express.Router('../index.js');
const bodyParser = require('body-parser');
const {User, Oggetto, Tipologia, Tipo_oggetto, Taglie, Taglie_disponibili, Carrello} = require('../sql/modello.js');
const jwt = require('jsonwebtoken');
const sequelize = require('sequelize');
//caricamento foto
const multer = require('multer');
const {  BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const upload = multer({ storage: multer.memoryStorage() });

let intoStream;

import('into-stream').then((module) => {
  intoStream = module.default;
});

function getStream(buffer) {
  return intoStream(buffer);
}

//bcrypt 
const bcrypt = require('bcrypt');
const saltRounds = 10;

//cookie
const cookieParser = require('cookie-parser');
router.use(cookieParser());

require('dotenv').config();

var cors = require('cors');
const { blob } = require('stream/consumers');
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
router.post('/upload', authenticateToken, upload.single('image'), async (req, res) => {
  const account = 'fotonegozio';
  const accountKey = process.env.PASSKEY;
  const containerName = 'fotoprofilo';
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);

  
  let blobName = req.user.email + '.png';
  blobName = blobName.replace('@', '_');
  blobName = blobName.replace('.', '_');
  blobName = blobName + Date.now();
  
  const stream = getStream(req.file.buffer);
  const streamLength = req.file.buffer.length;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const uploadBlobResponse = await blockBlobClient.uploadStream(stream, streamLength);

  console.log(`Upload block blob ${blobName} successfully`, uploadBlobResponse.requestId);;
  await blockBlobClient.setHTTPHeaders({ blobContentType: 'image/jpeg' });
  const blobUrl = blockBlobClient.url;
  console.log(blobUrl);
  const blobSAS = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse('r'), // 'r' for read
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 86400), // 1 day later
  }, sharedKeyCredential).toString();
  
  const blobUrlWithSAS = `https://${account}.blob.core.windows.net/${containerName}/${blobName}?${blobSAS}`;
  
  console.log(blobUrlWithSAS);

  User.update({foto: blobUrl}, {
    where: {
      email: req.user.email
    }
  }).then((user) => {
    res.status(200).json({success: true, message: 'Foto caricata con successo.', foto: blobUrlWithSAS});
  }).catch((error) => {
    console.error('Errore durante il caricamento della foto:', error);
    res.status(500).json({ error: 'Si è verificato un errore durante il caricamento della foto.' });
  });
});


router.post('/ricercaTipologie', authenticateToken, (req, res) => {
  
  Oggetto.findAll({
    where: {
      sesso: req.body.sesso
    },
    include: [{
      model: Tipologia,
      attributes: [],
      through: { model: Tipo_oggetto, attributes: [] },
      where: { nome: req.body.tipologia}
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


router.post('/carrello', authenticateToken, (req, res) => {
  const email = req.user.email; 
  const { action, itemId, taglia } = req.body;

  if (action === 'add') {
    Carrello.findAll({
      where: {
        email_utente: email,
        id_oggetto: itemId,
      },
      include: [{
        model: Taglie,
        where: { nome: taglia },
        attributes: ['id']
      }]
    }).then((carrello) => {
      if (carrello.length > 0) {
        console.log(carrello);
        // Utilizza l'ID della taglia recuperato dalla query findAll per aggiornare l'elemento corretto
        Carrello.update({
           numero: sequelize.literal('numero + 1')
        },
        {
          where: {
            email_utente: email,
            id_oggetto: itemId,
            id_taglia: carrello[0].dataValues.taglie.dataValues.id  // Accedi all'ID della taglia attraverso dataValues
          }
        }).then((carrello) => {
          res.status(200).json({ success: true, message: 'Aggiunto un elemento', carrello: carrello});
        }).catch((error) => {
          console.error('Errore durante l\'inserimento dell\'oggetto nel carrello:', error);
          return res.status(500).json({ error: 'Si è verificato un errore durante l\'inserimento dell\'oggetto nel carrello.' });
        });
        
      } else {
        Taglie.findOne({
          where: { nome: taglia }
        })
        .then((taglia) => {
          if (!taglia) {
            throw new Error('Taglia non trovata.');
          }
        
          return Carrello.create({
            email_utente: email,
            id_oggetto: itemId,
            id_taglia: taglia.id,
            numero: 1
          });
        })
        .then((carrello) => {
          res.status(200).json({ success: true, message: 'Elemento aggiunto al carrello.', carrello: carrello });
        })
        .catch((error) => {
          console.error('Errore durante l\'aggiunta dell\'elemento al carrello:', error);
          return res.status(500).json({ error: 'Si è verificato un errore durante l\'aggiunta dell\'elemento al carrello.' });
        });
      }
    });
  } else if (action === 'remove') {
    Carrello.findOne({
      where: {
        email_utente: email,
        id_oggetto: itemId,
      },
      include: [{
        model: Taglie,
        where: { nome: taglia },
        attributes: ['id']
      }]
    })
    .then((carrello) => {
      if (carrello.numero > 1) {
        // Se la quantità è maggiore di uno, diminuisci la quantità
        return carrello.update({ numero: sequelize.literal('numero - 1') });
      } else {
        // Altrimenti, rimuovi l'elemento dal carrello
        return carrello.destroy();
      }
    })
    .then(() => {
      res.status(200).json({ success: true, message: 'Oggetto rimosso dal carrello con successo.' });
    })
    .catch((error) => {
      console.error('Errore durante la rimozione dell\'oggetto dal carrello:', error);
      return res.status(500).json({ error: 'Si è verificato un errore durante la rimozione dell\'oggetto dal carrello.' });
    });
  } else if (action === 'get'){
    Carrello.findAll({
      where: {
        email_utente: email,
      },
      include: [{
        model: Oggetto,
        attributes: ['id', 'nome', 'prezzo', 'sesso', 'descrizione', 'foto'],
      }, {
        model: Taglie,
        attributes: ['id', 'nome'],
      }]
    }).then((carrello) => {
      res.status(200).json({ success: true, message: 'Carrello ottenuto con successo.', carrello: carrello });
    }).catch((error) => {
      console.error('Errore durante la ricerca del carrello:', error);
      return res.status(500).json({ error: 'Si è verificato un errore durante la ricerca del carrello.' });
    });
  }
  else {
    return res.status(400).json({ error: 'Azione non valida.' });
  }
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

router.post('/user/image', authenticateToken, (req, res) => {
  const email = req.user.email;
  User.findOne({
    where: {
      email: email
    }
  }).then((user) => {
    res.status(200).json({success: true, message: 'Foto trovata con successo.', foto: user.foto});
  }).catch(error => {
    console.error('Errore durante la ricerca della foto:', error);
    res.status(500).json({ error: 'Si è verificato un errore durante la ricerca della foto.' });
  });
});



module.exports = router;
