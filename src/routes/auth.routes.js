const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const validationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a user
 * @access Public
 */
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('validation.required_field'),
    body('email').isEmail().withMessage('validation.invalid_email'),
    body('password').isLength({ min: 6 }).withMessage('validation.password_length'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('preferredLanguage').optional(),
    validationMiddleware
  ],
  authController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login a user
 * @access Public
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('validation.invalid_email'),
    body('password').notEmpty().withMessage('validation.required_field'),
    validationMiddleware
  ],
  authController.login
);

module.exports = router;