const Sequelize = require('sequelize');

const sequelize = new Sequelize('negozio', 'root', '', {
  host: 'localhost',
  dialect: 'mysql', 
  port: 3306, // Porta predefinita di MySQL
  define: {
    timestamps: false, // Opzionale: disabilita la generazione automatica dei timestamp
    autoIncrement: false, // Disabilita l'auto incremento per l'attributo id
    freezeTableName: true,
  },
});

module.exports = sequelize;