const express = require('express');
const { body, query, param } = require('express-validator');
const eventController = require('../controllers/event.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const validationMiddleware = require('../middleware/validation.middleware');
const { validateCoordinates } = require('../utils/helpers');

const router = express.Router();

/**
 * @route POST /api/events
 * @desc Create a new event
 * @access Private
 */
router.post(
  '/',
  [
    authenticateToken,
    body('title').notEmpty().withMessage('validation.required_field'),
    body('description').optional(),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('validation.invalid_coordinates'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('validation.invalid_coordinates'),
    body().custom(({ latitude, longitude }) => {
      if (!validateCoordinates(latitude, longitude)) {
        throw new Error('validation.invalid_coordinates');
      }
      return true;
    }),
    body('address').optional(),
    body('startDate').isISO8601().withMessage('validation.invalid_date'),
    body('endDate').isISO8601().withMessage('validation.invalid_date'),
    body('categories').optional().isArray(),
    validationMiddleware
  ],
  eventController.createEvent
);

/**
 * @route GET /api/events
 * @desc Get all events with optional filtering
 * @access Public
 */
router.get(
  '/',
  [
    query('latitude').optional().isFloat({ min: -90, max: 90 }),
    query('longitude').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 1 }),
    query('categories').optional(),
    query('startDate').optional().isISO8601().withMessage('validation.invalid_date'),
    query('endDate').optional().isISO8601().withMessage('validation.invalid_date'),
    query('search').optional(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validationMiddleware
  ],
  eventController.getEvents
);

/**
 * @route GET /api/events/:id
 * @desc Get event by ID
 * @access Public
 */
router.get(
  '/:id',
  [
    param('id').isInt().withMessage('validation.invalid_id'),
    validationMiddleware
  ],
  eventController.getEventById
);

/**
 * @route PUT /api/events/:id
 * @desc Update event
 * @access Private
 */
router.put(
  '/:id',
  [
    authenticateToken,
    param('id').isInt().withMessage('validation.invalid_id'),
    body('title').optional(),
    body('description').optional(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('address').optional(),
    body('startDate').optional().isISO8601().withMessage('validation.invalid_date'),
    body('endDate').optional().isISO8601().withMessage('validation.invalid_date'),
    body('categories').optional().isArray(),
    validationMiddleware
  ],
  eventController.updateEvent
);

/**
 * @route DELETE /api/events/:id
 * @desc Delete event
 * @access Private
 */
router.delete(
  '/:id',
  [
    authenticateToken,
    param('id').isInt().withMessage('validation.invalid_id'),
    validationMiddleware
  ],
  eventController.deleteEvent
);

/**
 * @route POST /api/events/:id/rate
 * @desc Rate an event
 * @access Private
 */
router.post(
  '/:id/rate',
  [
    authenticateToken,
    param('id').isInt().withMessage('validation.invalid_id'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('validation.invalid_rating'),
    body('review').optional(),
    validationMiddleware
  ],
  eventController.rateEvent
);

/**
 * @route POST /api/events/:id/favorite
 * @desc Toggle favorite status of an event
 * @access Private
 */
router.post(
  '/:id/favorite',
  [
    authenticateToken,
    param('id').isInt().withMessage('validation.invalid_id'),
    validationMiddleware
  ],
  eventController.toggleFavorite
);

module.exports = router;