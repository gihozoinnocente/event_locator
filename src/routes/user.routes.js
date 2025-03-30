const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const validationMiddleware = require('../middleware/validation.middleware');
const { validateCoordinates } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/users/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', authenticateToken, userController.getUserProfile);

/**
 * @route PUT /api/users/profile
 * @desc Update user profile
 * @access Private
 */
router.put(
  '/profile',
  [
    authenticateToken,
    body('username').optional(),
    body('email').optional().isEmail().withMessage('validation.invalid_email'),
    body('preferredLanguage').optional(),
    validationMiddleware
  ],
  userController.updateUserProfile
);

/**
 * @route PUT /api/users/location
 * @desc Update user location
 * @access Private
 */
router.put(
  '/location',
  [
    authenticateToken,
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('validation.invalid_coordinates'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('validation.invalid_coordinates'),
    body().custom(({ latitude, longitude }) => {
      if (!validateCoordinates(latitude, longitude)) {
        throw new Error('validation.invalid_coordinates');
      }
      return true;
    }),
    validationMiddleware
  ],
  userController.updateUserLocation
);

/**
 * @route PUT /api/users/preferences
 * @desc Update user category preferences
 * @access Private
 */
router.put(
  '/preferences',
  [
    authenticateToken,
    body('categories').isArray(),
    validationMiddleware
  ],
  userController.updateCategoryPreferences
);

/**
 * @route GET /api/users/favorites
 * @desc Get user's favorite events
 * @access Private
 */
router.get('/favorites', authenticateToken, userController.getFavoriteEvents);

module.exports = router;