const Sequelize = require('sequelize');
const sequelize = require('./seq.js');

const User = sequelize.define('utenti', {
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    primaryKey: true,
  },
  psw: Sequelize.STRING,
  nome: Sequelize.STRING,
}, {
  tableName: 'utenti',
  freezeTableName: true
});

const Oggetto = sequelize.define('oggetti', {
  id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  nome: Sequelize.STRING,
  prezzo: Sequelize.DOUBLE,
  descrizione: Sequelize.STRING,
  sesso: Sequelize.STRING,
  foto: Sequelize.STRING,
}, {
  tableName: 'oggetti',
  freezeTableName: true
});


const Tipo_oggetto = sequelize.define('tipi_oggetti', {
  id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  id_oggetto: Sequelize.INTEGER,
  id_tipologia: Sequelize.INTEGER,
}, {
  tableName: 'tipi_oggetti',
  freezeTableName: true
});


const Tipologia = sequelize.define('tipologie', {
  id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  nome: Sequelize.STRING,
}, {
  tableName: 'tipologie',
  freezeTableName: true
});

Oggetto.belongsToMany(Tipologia, { through: Tipo_oggetto, foreignKey: 'id_oggetto' });
Tipologia.belongsToMany(Oggetto, { through: Tipo_oggetto, foreignKey: 'id_tipologia' });



module.exports = {User, Oggetto, Tipologia, Tipo_oggetto};
