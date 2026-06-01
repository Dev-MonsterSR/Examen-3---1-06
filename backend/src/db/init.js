// Crea la tabla `products` si no existe. Idempotente.
const { getPool } = require('./pool');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(200) NOT NULL,
  description  TEXT         NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  stock        INT          NOT NULL DEFAULT 0,
  image_url    VARCHAR(500) NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function initSchema() {
  const sql = SCHEMA.trim().split('\n').map((l) => l.trim()).join(' ');
  await getPool().query(sql);
}

module.exports = { initSchema };
