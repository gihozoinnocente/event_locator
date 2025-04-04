const searchController = require('../../../controllers/searchController');
const Event = require('../../../models/Event');
const User = require('../../../models/User');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../../models/Event');
jest.mock('../../../models/User');
jest.mock('express-validator');

describe('Search Controller', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request, response, and next function
    req = {
      query: {},
      user: { id: 1 },
      t: jest.fn().mockImplementation(key => key) // Mock i18n translate function
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    // Mock validation result
    validationResult.mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    });

    // Mock env variables
    process.env.DEFAULT_SEARCH_RADIUS = '10';
  });

  describe('searchEvents', () => {
    it('should search events with provided parameters', async () => {
      // Mock request query parameters
      req.query = {
        latitude: '20.5678',
        longitude: '10.1234',
        radius: '5',
        categoryIds: '1,2,3',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        page: '1',
        limit: '10'
      };

      // Mock Event.search to return results
      const mockSearchResults = {
        events: [
          {
            id: 1,
            title: 'Test Event',
            description: 'Event Description',
            location: {
              latitude: 20.5678,
              longitude: 10.1234
            },
            distance: 2.5,
            categories: [
              { id: 1, name: 'Music' }
            ]
          }
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          pages: 1
        }
      };
      Event.search.mockResolvedValue(mockSearchResults);

      await searchController.searchEvents(req, res, next);

      // Assertions
      expect(Event.search).toHaveBeenCalledWith(expect.objectContaining({
        latitude: '20.5678',
        longitude: '10.1234',
        radius: '5',
        categoryIds: [1, 2, 3],
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        page: 1,
        limit: 10
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockSearchResults
      }));
    });

    it('should use user location if lat/lng not provided', async () => {
      // Mock request without lat/lng
      req.query = {
        radius: '5',
        page: '1',
        limit: '10'
      };

      // Mock User.findById to return user with location
      User.findById.mockResolvedValue({
        id: 1,
        location: {
          latitude: 20.5678,
          longitude: 10.1234
        }
      });

      // Mock Event.search to return results
      const mockSearchResults = {
        events: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          pages: 0
        }
      };
      Event.search.mockResolvedValue(mockSearchResults);

      await searchController.searchEvents(req, res, next);

      // Assertions
      expect(User.findById).toHaveBeenCalledWith(1);
      expect(Event.search).toHaveBeenCalledWith(expect.objectContaining({
        latitude: 20.5678,
        longitude: 10.1234,
        radius: '5',
        page: 1,
        limit: 10
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if validation fails', async () => {
      // Mock validation failure
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Latitude must be a number' }])
      });

      await searchController.searchEvents(req, res, next);

      // Assertions
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        errors: expect.any(Array)
      }));
      expect(Event.search).not.toHaveBeenCalled();
    });

    it('should call next with error if Event.search throws', async () => {
      // Mock request query parameters
      req.query = {
        latitude: '20.5678',
        longitude: '10.1234'
      };

      // Mock Event.search to throw error
      const error = new Error('Database error');
      Event.search.mockRejectedValue(error);

      await searchController.searchEvents(req, res, next);

      // Assertions
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('nearbyEvents', () => {
    it('should get nearby events using user location', async () => {
      // Mock User.findById to return user with location
      User.findById.mockResolvedValue({
        id: 1,
        location: {
          latitude: 20.5678,
          longitude: 10.1234
        }
      });

      // Mock Event.search to return results
      const mockSearchResults = {
        events: [
          {
            id: 1,
            title: 'Nearby Event',
            distance: 1.5
          }
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          pages: 1
        }
      };
      Event.search.mockResolvedValue(mockSearchResults);

      await searchController.nearbyEvents(req, res, next);

      // Assertions
      expect(User.findById).toHaveBeenCalledWith(1);
      expect(Event.search).toHaveBeenCalledWith(expect.objectContaining({
        latitude: 20.5678,
        longitude: 10.1234,
        radius: '10'
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        location: {
          latitude: 20.5678,
          longitude: 10.1234,
          radius: '10'
        },
        data: mockSearchResults
      }));
    });

    it('should get nearby events using query parameters if not authenticated', async () => {
      // Remove user from request
      req.user = null;
      
      // Add location to query
      req.query = {
        latitude: '30.5678',
        longitude: '20.1234',
        radius: '15'
      };

      // Mock Event.search to return results
      const mockSearchResults = {
        events: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          pages: 0
        }
      };
      Event.search.mockResolvedValue(mockSearchResults);

      await searchController.nearbyEvents(req, res, next);

      // Assertions
      expect(User.findById).not.toHaveBeenCalled();
      expect(Event.search).toHaveBeenCalledWith(expect.objectContaining({
        latitude: '30.5678',
        longitude: '20.1234',
        radius: '15'
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if not authenticated and no location provided', async () => {
      // Remove user from request
      req.user = null;
      
      // Empty query
      req.query = {};

      await searchController.nearbyEvents(req, res, next);

      // Assertions
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'search:locationRequired'
      }));
      expect(Event.search).not.toHaveBeenCalled();
    });
  });

  describe('recommendedEvents', () => {
    it('should get recommended events based on user preferences', async () => {
      // Mock User.getCategoryPreferences to return preferences
      const mockPreferences = [
        { id: 1, name: 'Music', description: 'Music events' },
        { id: 3, name: 'Tech', description: 'Tech events' }
      ];
      User.getCategoryPreferences.mockResolvedValue(mockPreferences);

      // Mock User.findById to return user with location
      User.findById.mockResolvedValue({
        id: 1,
        location: {
          latitude: 20.5678,
          longitude: 10.1234
        }
      });

      // Mock Event.search to return results
      const mockSearchResults = {
        events: [
          {
            id: 1,
            title: 'Recommended Event',
            categories: [{ id: 1, name: 'Music' }]
          }
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          pages: 1
        }
      };
      Event.search.mockResolvedValue(mockSearchResults);

      await searchController.recommendedEvents(req, res, next);

      // Assertions
      expect(User.getCategoryPreferences).toHaveBeenCalledWith(1);
      expect(User.findById).toHaveBeenCalledWith(1);
      expect(Event.search).toHaveBeenCalledWith(expect.objectContaining({
        latitude: 20.5678,
        longitude: 10.1234,
        categoryIds: [1, 3]
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        preferences: 'Music, Tech',
        data: mockSearchResults
      }));
    });

    it('should return 401 if not authenticated', async () => {
      // Remove user from request
      req.user = null;

      await searchController.recommendedEvents(req, res, next);

      // Assertions
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'auth:unauthorized'
      }));
      expect(User.getCategoryPreferences).not.toHaveBeenCalled();
    });

    it('should return empty results if user has no preferences', async () => {
      // Mock User.getCategoryPreferences to return empty array
      User.getCategoryPreferences.mockResolvedValue([]);

      await searchController.recommendedEvents(req, res, next);

      // Assertions
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'search:noPreferences',
        data: expect.objectContaining({
          events: [],
          pagination: expect.any(Object)
        })
      }));
      expect(Event.search).not.toHaveBeenCalled();
    });
  });
});