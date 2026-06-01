// Esquemas Joi para productos. Coinciden con la tabla MySQL.
const Joi = require('joi');

const priceSchema = Joi.number().positive().precision(2).min(0.01).max(9999999.99);
const stockSchema = Joi.number().integer().min(0).max(2147483647);

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().trim().min(10).max(2000).required(),
  price: priceSchema.required(),
  stock: stockSchema.required(),
  image_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).optional(),
});

const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).optional(),
  description: Joi.string().trim().min(10).max(2000).optional(),
  price: priceSchema.optional(),
  stock: stockSchema.optional(),
  image_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).optional(),
}).min(1); // PUT no permite body vacío

const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  idParamSchema,
};
