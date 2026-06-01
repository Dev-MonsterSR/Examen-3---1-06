// 404 para rutas no encontradas.
function notFound(req, res, next) {
  res.status(404).json({
    error: 'NotFound',
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

// Error handler global. express-async-errors propaga los rechazos de async
// al middleware de errores. Distinguimos entre errores operacionales y bugs.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // eslint-disable-next-line no-console
  console.error('ERROR', { msg: err.message, stack: err.stack });

  // Errores de MySQL
  if (err && err.code && typeof err.code === 'string' && err.code.startsWith('ER_')) {
    return res.status(400).json({
      error: 'DatabaseError',
      message: err.message,
      code: err.code,
    });
  }

  // Joi (por si escapó al middleware)
  if (err && err.isJoi) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Datos inválidos',
      details: err.details?.map((d) => ({ field: d.path.join('.'), message: d.message })),
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'InternalServerError',
    message: status >= 500 ? 'Error interno del servidor' : err.message,
  });
}

module.exports = { notFound, errorHandler };
