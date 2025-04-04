const express = require('express');
const { check } = require('express-validator');
const searchController = require('../controllers/searchController');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /search/events:
 *   get:
 *     summary: Search for events based on location and filters
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *         description: Latitude for location-based search (defaults to user's location if authenticated)
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *         description: Longitude for location-based search (defaults to user's location if authenticated)
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *         description: Search radius in kilometers
 *       - in: query
 *         name: categoryIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of category IDs to filter by
 *         example: "1,3,5"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events starting on or after this date
 *         example: "2023-09-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events ending on or before this date
 *         example: "2023-12-31"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 query:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                       example: 40.7128
 *                     longitude:
 *                       type: number
 *                       example: -74.0060
 *                     radius:
 *                       type: number
 *                       example: 10
 *                     categoryIds:
 *                       type: array
 *                       items:
 *                         type: integer
 *                       example: [1, 3, 5]
 *                     startDate:
 *                       type: string
 *                       example: "2023-09-01"
 *                     endDate:
 *                       type: string
 *                       example: "2023-12-31"
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Event'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 23
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                         pages:
 *                           type: integer
 *                           example: 3
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/events',
  [
    check('latitude', 'Latitude must be a number').optional().isNumeric(),
    check('longitude', 'Longitude must be a number').optional().isNumeric(),
    check('radius', 'Radius must be a number').optional().isNumeric(),
    check('startDate', 'Start date must be a valid date').optional().isISO8601(),
    check('endDate', 'End date must be a valid date').optional().isISO8601()
  ],
  searchController.searchEvents
);

/**
 * @swagger
 * /search/nearby:
 *   get:
 *     summary: Get nearby events
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *         description: Latitude for location-based search (required if not authenticated)
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *         description: Longitude for location-based search (required if not authenticated)
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *         description: Search radius in kilometers
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of nearby events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 location:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                       example: 40.7128
 *                     longitude:
 *                       type: number
 *                       example: -74.0060
 *                     radius:
 *                       type: number
 *                       example: 10
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Event'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 15
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                         pages:
 *                           type: integer
 *                           example: 2
 *       400:
 *         description: Validation error or missing location
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/nearby', searchController.nearbyEvents);

/**
 * @swagger
 * /search/recommended:
 *   get:
 *     summary: Get recommended events based on user preferences
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *         description: Search radius in kilometers
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of recommended events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 preferences:
 *                   type: string
 *                   example: "Music, Tech, Food"
 *                 location:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                       example: 40.7128
 *                     longitude:
 *                       type: number
 *                       example: -74.0060
 *                     radius:
 *                       type: number
 *                       example: 10
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Event'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 12
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                         pages:
 *                           type: integer
 *                           example: 2
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/recommended', isAuthenticated, searchController.recommendedEvents);

module.exports = router;