const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "mispris",
  password: "1234",
  port: 5432
});
console.log("Подключение к Базе Данных прошло успешно!");

module.exports = {
  pool
}