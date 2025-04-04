const db = require('../config/database');

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  return distance;
};

// Find locations within a radius
const findLocationsWithinRadius = async (latitude, longitude, radiusKm, entityType) => {
  try {
    let table, locationColumn, query;
    
    if (entityType === 'events') {
      table = 'events';
      locationColumn = 'location';
      query = `
        SELECT id, title, description, ST_AsGeoJSON(${locationColumn}) as location, 
        address, start_time, end_time, creator_id,
        ST_Distance(${locationColumn}, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 as distance
        FROM ${table}
        WHERE ST_DWithin(${locationColumn}, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
        ORDER BY distance
      `;
    } else if (entityType === 'users') {
      table = 'users';
      locationColumn = 'location';
      query = `
        SELECT id, username, ST_AsGeoJSON(${locationColumn}) as location,
        ST_Distance(${locationColumn}, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 as distance
        FROM ${table}
        WHERE ST_DWithin(${locationColumn}, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
        ORDER BY distance
      `;
    } else {
      throw new Error('Invalid entity type');
    }
    
    const result = await db.query(query, [longitude, latitude, radiusKm]);
    
    // Process each entity to format location
    return result.rows.map(entity => {
      const locationData = JSON.parse(entity.location);
      entity.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      return entity;
    });
  } catch (error) {
    console.error(`Error in findLocationsWithinRadius for ${entityType}:`, error);
    throw error;
  }
};

// Get nearby events
const getNearbyEvents = async (latitude, longitude, radiusKm = 10) => {
  return findLocationsWithinRadius(latitude, longitude, radiusKm, 'events');
};

// Get nearby users
const getNearbyUsers = async (latitude, longitude, radiusKm = 10) => {
  return findLocationsWithinRadius(latitude, longitude, radiusKm, 'users');
};

// Create a point geography
const createPoint = (longitude, latitude) => {
  return `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
};

module.exports = {
  calculateDistance,
  getNearbyEvents,
  getNearbyUsers,
  createPoint
};