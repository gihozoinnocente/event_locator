const { validationResult } = require('express-validator');
const Event = require('../models/Event');
const User = require('../models/User');

// Search for events based on location and filters
const searchEvents = async (req, res, next) => {
  try {
    console.log('Received search request with query:', req.query);
    
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
      console.log('Using user location:', { searchLatitude, searchLongitude });
    }
    
    // Check if we have coordinates to search with
    if (!searchLatitude || !searchLongitude) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates are required for search. Please provide latitude and longitude.',
        data: {
          events: [],
          pagination: { total: 0, page, limit, pages: 0 }
        }
      });
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
    
    // Convert parameters to proper types
    const searchParams = {
      latitude: parseFloat(searchLatitude),
      longitude: parseFloat(searchLongitude),
      radius: parseFloat(searchRadius),
      categoryIds: parsedCategoryIds,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      page,
      limit
    };
    
    console.log('Searching events with parameters:', searchParams);
    
    // Search events
    const events = await Event.search(searchParams);
    
    console.log(`Found ${events.events.length} events out of ${events.pagination.total} total`);
    
    res.status(200).json({
      success: true,
      query: {
        latitude: searchParams.latitude,
        longitude: searchParams.longitude,
        radius: searchParams.radius,
        categoryIds: parsedCategoryIds,
        startDate,
        endDate
      },
      data: events
    });
  } catch (error) {
    console.error('Error in searchEvents:', error);
    next(error);
  }
};

// Search for nearby events (simplified version)
const nearbyEvents = async (req, res, next) => {
  try {
    console.log('Received nearby events request');
    
    // Get user's location
    let latitude, longitude;
    
    if (req.user) {
      const user = await User.findById(req.user.id);
      latitude = user.location.latitude;
      longitude = user.location.longitude;
      console.log('Using authenticated user location:', { latitude, longitude });
    } else {
      // If not authenticated, require location parameters
      latitude = req.query.latitude;
      longitude = req.query.longitude;
      console.log('Using query parameters for location:', { latitude, longitude });
      
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Location coordinates are required. Please provide latitude and longitude parameters.'
        });
      }
    }
    
    // Convert parameters to numbers
    const numLatitude = parseFloat(latitude);
    const numLongitude = parseFloat(longitude);
    const radius = parseFloat(req.query.radius) || parseFloat(process.env.DEFAULT_SEARCH_RADIUS) || 10;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log('Searching for nearby events with:', { 
      latitude: numLatitude, 
      longitude: numLongitude, 
      radius,
      page,
      limit 
    });
    
    // Search events
    const events = await Event.search({
      latitude: numLatitude,
      longitude: numLongitude,
      radius,
      page,
      limit
    });
    
    console.log(`Found ${events.events.length} nearby events out of ${events.pagination.total} total`);
    
    res.status(200).json({
      success: true,
      location: {
        latitude: numLatitude,
        longitude: numLongitude,
        radius
      },
      data: events
    });
  } catch (error) {
    console.error('Error in nearbyEvents:', error);
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