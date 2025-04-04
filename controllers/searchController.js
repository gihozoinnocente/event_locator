const { validationResult } = require('express-validator');
const Event = require('../models/Event');
const User = require('../models/User');

// Search for events based on location and filters
const searchEvents = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: req.t('common:validationError'),
        errors: errors.array()
      });
    }
    
    const { latitude, longitude, radius, categoryIds, startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Default to user's location if not provided
    let searchLatitude = latitude;
    let searchLongitude = longitude;
    
    if ((!latitude || !longitude) && req.user) {
      const user = await User.findById(req.user.id);
      searchLatitude = user.location.latitude;
      searchLongitude = user.location.longitude;
    }
    
    // Default radius
    const searchRadius = radius || process.env.DEFAULT_SEARCH_RADIUS || 10;
    
    // Parse category IDs
    let parsedCategoryIds;
    if (categoryIds) {
      parsedCategoryIds = Array.isArray(categoryIds) 
        ? categoryIds 
        : categoryIds.split(',').map(id => parseInt(id.trim()));
    }
    
    // Search events
    const events = await Event.search({
      latitude: searchLatitude,
      longitude: searchLongitude,
      radius: searchRadius,
      categoryIds: parsedCategoryIds,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      page,
      limit
    });
    
    res.status(200).json({
      success: true,
      query: {
        latitude: searchLatitude,
        longitude: searchLongitude,
        radius: searchRadius,
        categoryIds: parsedCategoryIds,
        startDate,
        endDate
      },
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// Search for nearby events (simplified version)
const nearbyEvents = async (req, res, next) => {
  try {
    // Get user's location
    let latitude, longitude;
    
    if (req.user) {
      const user = await User.findById(req.user.id);
      latitude = user.location.latitude;
      longitude = user.location.longitude;
    } else {
      // If not authenticated, require location parameters
      latitude = req.query.latitude;
      longitude = req.query.longitude;
      
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: req.t('search:locationRequired')
        });
      }
    }
    
    const radius = req.query.radius || process.env.DEFAULT_SEARCH_RADIUS || 10;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Search events
    const events = await Event.search({
      latitude,
      longitude,
      radius,
      page,
      limit
    });
    
    res.status(200).json({
      success: true,
      location: {
        latitude,
        longitude,
        radius
      },
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// Recommended events based on user preferences
const recommendedEvents = async (req, res, next) => {
  try {
    // Check if authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: req.t('auth:unauthorized')
      });
    }
    
    // Get user's preferences
    const preferences = await User.getCategoryPreferences(req.user.id);
    
    if (!preferences || preferences.length === 0) {
      return res.status(200).json({
        success: true,
        message: req.t('search:noPreferences'),
        data: {
          events: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 10,
            pages: 0
          }
        }
      });
    }
    
    // Get user's location
    const user = await User.findById(req.user.id);
    const { latitude, longitude } = user.location;
    
    const radius = req.query.radius || process.env.DEFAULT_SEARCH_RADIUS || 10;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Get category IDs from preferences
    const categoryIds = preferences.map(pref => pref.id);
    
    // Search events based on preferences
    const events = await Event.search({
      latitude,
      longitude,
      radius,
      categoryIds,
      page,
      limit
    });
    
    res.status(200).json({
      success: true,
      preferences: preferences.map(pref => pref.name).join(', '),
      location: {
        latitude,
        longitude,
        radius
      },
      data: events
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchEvents,
  nearbyEvents,
  recommendedEvents
};