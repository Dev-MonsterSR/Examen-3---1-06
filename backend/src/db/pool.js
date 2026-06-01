// Pool de conexiones MySQL. Singleton.
const mysql = require('mysql2/promise');
const { env } = require('../config/env');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      decimalNumbers: true, // DECIMAL → number (no string)
    });
  }
  return pool;
}

async function ping() {
  const conn = await getPool().getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { getPool, ping };
