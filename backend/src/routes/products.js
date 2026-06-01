const express = require('express');
const ctrl = require('../controllers/productsController');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const {
  createProductSchema,
  updateProductSchema,
  idParamSchema,
} = require('../validations/productValidation');

const router = express.Router();

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(ctrl.getById));
router.post('/', validate(createProductSchema), asyncHandler(ctrl.create));
router.put('/:id', validate(idParamSchema, 'params'), validate(updateProductSchema), asyncHandler(ctrl.update));
router.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(ctrl.remove));

module.exports = router;
