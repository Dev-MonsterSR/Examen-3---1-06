// Wrapper para handlers async: propaga el rechazo de la promesa al middleware
// de errores de Express. Reemplaza a `express-async-errors` sin dependencias.
// Uso:  router.get('/', asyncHandler(ctrl.list));
module.exports = function asyncHandler(fn) {
  return function asyncWrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
