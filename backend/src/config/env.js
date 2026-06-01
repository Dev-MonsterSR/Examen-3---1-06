// Carga y valida variables de entorno al inicio. Falla rápido si falta algo crítico.
require('dotenv').config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === null || v === '') {
    throw new Error(`Variable de entorno requerida: ${name}`);
  }
  return v;
}

function intEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Variable de entorno inválida (no es entero): ${name}=${v}`);
  return n;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: intEnv('PORT', 3000),

  DB_HOST: required('DB_HOST', 'mysql'),
  DB_PORT: intEnv('DB_PORT', 3306),
  DB_USER: required('DB_USER', 'examen'),
  DB_PASSWORD: process.env.DB_PASSWORD ?? '',
  DB_NAME: required('DB_NAME', 'examen3'),

  EXTERNAL_IMAGE_BASE_URL: process.env.EXTERNAL_IMAGE_BASE_URL || 'https://picsum.photos',
  EXTERNAL_IMAGE_WIDTH: intEnv('EXTERNAL_IMAGE_WIDTH', 600),
  EXTERNAL_IMAGE_HEIGHT: intEnv('EXTERNAL_IMAGE_HEIGHT', 400),

  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

module.exports = { env };
