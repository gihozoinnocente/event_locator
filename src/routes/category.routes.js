const express = require('express');
const { body, param } = require('express-validator');
const categoryController = require('../controllers/category.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const validationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

/**
 * @route GET /api/categories
 * @desc Get all categories
 * @access Public
 */
router.get('/', categoryController.getAllCategories);

/**
 * @route POST /api/categories
 * @desc Create a new category
 * @access Private
 */
router.post(
  '/',
  [
    authenticateToken,
    body('name').notEmpty().withMessage('validation.required_field'),
    validationMiddleware
  ],
  categoryController.createCategory
);

/**
 * @route PUT /api/categories/:id
 * @desc Update a category
 * @access Private
 */
router.put(
  '/:id',
  [
    authenticateToken,
    param('id').isInt().withMessage('validation.invalid_id'),
    body('name').notEmpty().withMessage('validation.required_field'),
    validationMiddleware
  ],
  categoryController.updateCategory
);

/**
 * @route DELETE /api/categories/:id
 * @desc Delete a category
 * @access Private
 */
router.delete(
  '/:id',
  [
    authenticateToken,
    param('id').isInt().withMessage('validation.invalid_id'),
    validationMiddleware
  ],
  categoryController.deleteCategory
);

module.exports = router;