// Punto de entrada. Los handlers async se envuelven con `asyncHandler` en
// routes/products.js para que sus rechazos lleguen al middleware de errores.

const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { env } = require('./config/env');
const { ping } = require('./db/pool');
const { initSchema } = require('./db/init');
const productsRouter = require('./routes/products');
const logger = require('./middleware/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Seguridad: helmet desactiva CSP por defecto, pero sirve para X-Frame-Options etc.
// El frontend se sirve desde el mismo origen, así que no hay problema.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS configurable via env (default * en dev, o CORS_ORIGIN=https://mi-frontend en prod)
app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));

// Parseo de body
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Logger custom (reemplaza a morgan como middleware principal)
app.use(logger);
// morgan como bonus en dev (no bloqueante)
if (env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Healthcheck para Docker / Render
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: env.NODE_ENV }));

// API principal
app.use('/api/products', productsRouter);

// Frontend estático servido por el mismo backend (evita nginx, evita CORS)
// Path al build/public: __dirname/../public
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback: cualquier GET no /api/* devuelve index.html
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 + error handler
app.use('/api', notFound);
app.use(errorHandler);

// Arranque con init de schema y ping
async function start() {
  try {
    // 1. Esperar MySQL (puede tardar unos segundos en el primer arranque)
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      try {
        await ping();
        break;
      } catch (e) {
        attempts += 1;
        if (attempts >= maxAttempts) throw e;
        // eslint-disable-next-line no-console
        console.log(`[startup] MySQL no listo (intento ${attempts}/${maxAttempts}), reintentando en 2s…`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    // 2. Crear tabla si no existe
    await initSchema();
    // eslint-disable-next-line no-console
    console.log('[startup] Schema OK');

    // 3. Listen
    app.listen(env.PORT, '0.0.0.0', () => {
      // eslint-disable-next-line no-console
      console.log(`[startup] API + Frontend listening on http://0.0.0.0:${env.PORT}`);
      // eslint-disable-next-line no-console
      console.log(`[startup] Endpoints: GET  /api/products  · POST  /api/products  · PUT    /api/products/:id  · DELETE /api/products/:id`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[startup] FATAL', err);
    process.exit(1);
  }
}

// Shutdown limpio
function shutdown(sig) {
  // eslint-disable-next-line no-console
  console.log(`[shutdown] received ${sig}, closing server…`);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
