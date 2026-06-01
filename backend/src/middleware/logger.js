// Middleware de logging estructurado. Imprime una línea por request con
// timestamp, método, ruta, status y duración. Más informativo que morgan "combined"
const logger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    const line = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Math.round(durMs * 100) / 100,
      ip: req.ip,
      ua: req.get('user-agent') || '',
    };
    // Nivel por status
    const tag = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN ' : 'INFO ';
    // eslint-disable-next-line no-console
    console.log(`${tag} ${JSON.stringify(line)}`);
  });

  next();
};

module.exports = logger;
