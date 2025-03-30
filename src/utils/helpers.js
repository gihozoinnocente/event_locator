/**
 * Generate a geospatial point from latitude and longitude
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} - PostGIS point as WKT (Well-Known Text)
 */
const generatePoint = (lat, lng) => {
    if (!lat || !lng) return null;
    return `POINT(${lng} ${lat})`;
  };
  
  /**
   * Extract latitude and longitude from a PostGIS geography point
   * @param {string} point - PostGIS geography point
   * @returns {Object|null} - Object with lat and lng properties or null
   */
  const extractCoordinates = (point) => {
    if (!point) return null;
    
    // Convert POINT(lng lat) to coordinates
    try {
      // Remove POINT( and ) and split by space
      const pointStr = point.substring(6, point.length - 1);
      const [lng, lat] = pointStr.split(' ').map(parseFloat);
      return { lat, lng };
    } catch (error) {
      console.error('Error extracting coordinates:', error);
      return null;
    }
  };
  
  /**
   * Validate if latitude and longitude are valid coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {boolean} - Whether the coordinates are valid
   */
  const validateCoordinates = (lat, lng) => {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
  };
  
  /**
   * Format a PostgreSQL event row with its categories
   * @param {Object} event - Event row from database
   * @param {Array} categories - Categories array
   * @returns {Object} - Formatted event object
   */
  const formatEvent = (event, categories = []) => {
    const location = extractCoordinates(event.location);
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: location,
      address: event.address,
      startDate: event.start_date,
      endDate: event.end_date,
      categories: categories,
      createdBy: event.created_by,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    };
  };
  
  module.exports = {
    generatePoint,
    extractCoordinates,
    validateCoordinates,
    formatEvent
  };