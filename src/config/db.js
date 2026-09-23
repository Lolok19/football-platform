const mysql = require('mysql2/promise');
const { dbConfig } = require('./env');

let pool;

async function ensureDatabase() {
  const rootConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
  };

  const connection = await mysql.createConnection(rootConfig);
  await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
  await connection.end();

  pool = mysql.createPool(dbConfig);
  const dbConnection = await pool.getConnection();
  await dbConnection.execute('SELECT 1');
  dbConnection.release();
}

async function run(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(sql, params);
    return result;
  } finally {
    connection.release();
  }
}

async function getOne(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows[0] || null;
  } finally {
    connection.release();
  }
}

async function getAll(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    connection.release();
  }
}

module.exports = { ensureDatabase, run, getOne, getAll };
