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
});

module.exports = User;
