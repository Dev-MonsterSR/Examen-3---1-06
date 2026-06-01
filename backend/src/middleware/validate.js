// Validador genérico basado en Joi. Lanza 400 con detalle si falla.
const validate = (schema, source = 'body') => (req, res, next) => {
  const data = source === 'body' ? req.body : source === 'params' ? req.params : req.query;
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Datos inválidos',
      details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
    });
  }
  if (source === 'body') req.body = value;
  else if (source === 'params') req.params = value;
  else req.query = value;
  next();
};

module.exports = validate;
