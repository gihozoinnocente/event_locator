const db = require('../config/database');

class Event {
  // Find an event by ID
  static async findById(id) {
    try {
      // Get the event details
      const eventResult = await db.query(
        `SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at
        FROM events e
        JOIN users u ON e.creator_id = u.id
        WHERE e.id = $1`,
        [id]
      );
      
      if (eventResult.rows.length === 0) return null;
      
      const event = eventResult.rows[0];
      
      // Parse the location
      const locationData = JSON.parse(event.location);
      event.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      
      // Get the event categories
      const categoriesResult = await db.query(
        `SELECT c.id, c.name, c.description
        FROM categories c
        JOIN event_categories ec ON c.id = ec.category_id
        WHERE ec.event_id = $1`,
        [id]
      );
      
      event.categories = categoriesResult.rows;
      
      // Get the event ratings
      const ratingsResult = await db.query(
        `SELECT AVG(rating) as average_rating, COUNT(*) as review_count
        FROM reviews
        WHERE event_id = $1`,
        [id]
      );
      
      event.ratings = {
        averageRating: parseFloat(ratingsResult.rows[0].average_rating) || 0,
        reviewCount: parseInt(ratingsResult.rows[0].review_count) || 0
      };
      
      return event;
    } catch (error) {
      throw error;
    }
  }

  // Create a new event
  static async create(eventData) {
    const { title, description, latitude, longitude, address, startTime, endTime, creatorId, categoryIds } = eventData;
    
    try {
      // Start a transaction
      await db.query('BEGIN');
      
      // Insert the event
      const eventResult = await db.query(
        `INSERT INTO events 
        (title, description, location, address, start_time, end_time, creator_id)
        VALUES 
        ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8)
        RETURNING id, title, description, ST_AsGeoJSON(location) as location, address, start_time, end_time, creator_id, created_at`,
        [title, description, longitude, latitude, address, startTime, endTime, creatorId]
      );
      
      const event = eventResult.rows[0];
      const eventId = event.id;
      
      // Parse the location
      const locationData = JSON.parse(event.location);
      event.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      
      // Insert event categories
      if (categoryIds && categoryIds.length > 0) {
        const categoryValues = categoryIds.map(categoryId => `(${eventId}, ${categoryId})`).join(', ');
        await db.query(`INSERT INTO event_categories (event_id, category_id) VALUES ${categoryValues}`);
        
        // Get the categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [eventId]
        );
        
        event.categories = categoriesResult.rows;
      } else {
        event.categories = [];
      }
      
      // Commit the transaction
      await db.query('COMMIT');
      
      return event;
    } catch (error) {
      // Rollback the transaction in case of error
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Update an event
  static async update(id, updateData) {
    const { title, description, latitude, longitude, address, startTime, endTime, categoryIds } = updateData;
    
    try {
      // Start a transaction
      await db.query('BEGIN');
      
      // Update event details
      let query = 'UPDATE events SET ';
      const values = [];
      const queryParts = [];
      
      let paramIndex = 1;
      
      if (title) {
        queryParts.push(`title = $${paramIndex}`);
        values.push(title);
        paramIndex++;
      }
      
      if (description) {
        queryParts.push(`description = $${paramIndex}`);
        values.push(description);
        paramIndex++;
      }
      
      if (latitude && longitude) {
        queryParts.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
        values.push(longitude, latitude);
        paramIndex += 2;
      }
      
      if (address) {
        queryParts.push(`address = $${paramIndex}`);
        values.push(address);
        paramIndex++;
      }
      
      if (startTime) {
        queryParts.push(`start_time = $${paramIndex}`);
        values.push(startTime);
        paramIndex++;
      }
      
      if (endTime) {
        queryParts.push(`end_time = $${paramIndex}`);
        values.push(endTime);
        paramIndex++;
      }
      
      if (queryParts.length === 0) {
        // No updates to make
        return await Event.findById(id);
      }
      
      query += queryParts.join(', ');
      query += ` WHERE id = $${paramIndex} RETURNING id`;
      values.push(id);
      
      // Update event
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        await db.query('ROLLBACK');
        return null;
      }
      
      // Update categories if provided
      if (categoryIds && categoryIds.length > 0) {
        // Remove existing categories
        await db.query('DELETE FROM event_categories WHERE event_id = $1', [id]);
        
        // Add new categories
        const categoryValues = categoryIds.map(categoryId => `(${id}, ${categoryId})`).join(', ');
        await db.query(`INSERT INTO event_categories (event_id, category_id) VALUES ${categoryValues}`);
      }
      
      // Commit the transaction
      await db.query('COMMIT');
      
      // Return the updated event
      return await Event.findById(id);
    } catch (error) {
      // Rollback the transaction in case of error
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Delete an event
  static async delete(id) {
    try {
      await db.query('DELETE FROM events WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Get all events (with pagination)
  static async getAll(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Get events
      const eventsResult = await db.query(
        `SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at
        FROM events e
        JOIN users u ON e.creator_id = u.id
        ORDER BY e.created_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      
      // Get total count
      const countResult = await db.query('SELECT COUNT(*) FROM events');
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Process each event
      const events = await Promise.all(eventsResult.rows.map(async (event) => {
        // Parse the location
        const locationData = JSON.parse(event.location);
        event.location = {
          latitude: locationData.coordinates[1],
          longitude: locationData.coordinates[0]
        };
        
        // Get the event categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [event.id]
        );
        
        event.categories = categoriesResult.rows;
        
        // Get the event ratings
        const ratingsResult = await db.query(
          `SELECT AVG(rating) as average_rating, COUNT(*) as review_count
          FROM reviews
          WHERE event_id = $1`,
          [event.id]
        );
        
        event.ratings = {
          averageRating: parseFloat(ratingsResult.rows[0].average_rating) || 0,
          reviewCount: parseInt(ratingsResult.rows[0].review_count) || 0
        };
        
        return event;
      }));
      
      return {
        events,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Search for events based on location, radius, and categories
  static async search(params) {
    const { latitude, longitude, radius = 10, categoryIds, startDate, endDate, page = 1, limit = 10 } = params;
    
    // Debug parameters
    console.log('Search parameters:', { 
      latitude, 
      longitude, 
      radius, 
      categoryIds, 
      startDate, 
      endDate, 
      page, 
      limit 
    });
    
    // Validate coordinates are present
    if (!latitude || !longitude) {
      console.error('Missing coordinates for search. Latitude:', latitude, 'Longitude:', longitude);
      return { events: [], pagination: { total: 0, page, limit, pages: 0 } };
    }
    
    // Convert to numbers to ensure proper type
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseFloat(radius);
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    try {
      const offset = (pageNum - 1) * limitNum;
      let query = `
        SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at,
        ST_Distance(e.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000 as distance
        FROM events e
        JOIN users u ON e.creator_id = u.id
      `;
      
      let countQuery = `
        SELECT COUNT(*) 
        FROM events e
      `;
      
      let paramCounter = 3; // Starting with 3 because we've used $1, $2 for lat/lng and $3 for radius
      
      // Add category filter if provided
      if (categoryIds && categoryIds.length > 0) {
        query += `
          JOIN event_categories ec ON e.id = ec.event_id
          WHERE ec.category_id IN (${categoryIds.join(',')})
        `;
        
        countQuery += `
          JOIN event_categories ec ON e.id = ec.event_id
          WHERE ec.category_id IN (${categoryIds.join(',')})
        `;
        
        // Add location filter - IMPORTANT: Note we're using lat as $1 and lng as $2
        query += ` AND ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3 * 1000)`;
        countQuery += ` AND ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3 * 1000)`;
      } else {
        // Add location filter without categories
        query += ` WHERE ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3 * 1000)`;
        countQuery += ` WHERE ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3 * 1000)`;
      }
      
      // Add date filter if provided
      if (startDate) {
        paramCounter++;
        query += ` AND e.start_time >= $${paramCounter}`;
        countQuery += ` AND e.start_time >= $${paramCounter}`;
      }
      
      if (endDate) {
        paramCounter++;
        query += ` AND e.end_time <= $${paramCounter}`;
        countQuery += ` AND e.end_time <= $${paramCounter}`;
      }
      
      // Add LIMIT and OFFSET with correct parameter numbering
      paramCounter++;
      const limitParam = paramCounter;
      paramCounter++;
      const offsetParam = paramCounter;
      
      // Order by distance and add pagination with correct parameter numbering
      query += ` ORDER BY distance LIMIT $${limitParam} OFFSET $${offsetParam}`;
      
      // Prepare query parameters - IMPORTANT: Latitude first, then longitude
      const queryParams = [lat, lng, rad];
      if (startDate) queryParams.push(startDate);
      if (endDate) queryParams.push(endDate);
      queryParams.push(limitNum, offset);
      
      // Prepare count parameters
      const countParams = [lat, lng, rad];
      if (startDate) countParams.push(startDate);
      if (endDate) countParams.push(endDate);
      
      // Debug SQL
      console.log('Event search SQL:', { query, params: queryParams });
      console.log('Count SQL:', { countQuery, params: countParams });
      
      // Execute the queries
      const eventsResult = await db.query(query, queryParams);
      const countResult = await db.query(countQuery, countParams);
      
      const totalCount = parseInt(countResult.rows[0].count);
      console.log(`Found ${totalCount} events matching search criteria`);
      
      // Process each event
      const events = await Promise.all(eventsResult.rows.map(async (event) => {
        // Parse the location
        const locationData = JSON.parse(event.location);
        event.location = {
          latitude: locationData.coordinates[1],
          longitude: locationData.coordinates[0]
        };
        
        // Get the event categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [event.id]
        );
        
        event.categories = categoriesResult.rows;
        
        // Get the event ratings
        const ratingsResult = await db.query(
          `SELECT AVG(rating) as average_rating, COUNT(*) as review_count
          FROM reviews
          WHERE event_id = $1`,
          [event.id]
        );
        
        event.ratings = {
          averageRating: parseFloat(ratingsResult.rows[0].average_rating) || 0,
          reviewCount: parseInt(ratingsResult.rows[0].review_count) || 0
        };
        
        return event;
      }));
      
      return {
        events,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum)
        }
      };
    } catch (error) {
      console.error('Error in search method:', error);
      throw error;
    }
  }

  // Save an event as favorite
  static async saveAsFavorite(userId, eventId) {
    try {
      await db.query(
        'INSERT INTO saved_events (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, eventId]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Remove an event from favorites
  static async removeFromFavorites(userId, eventId) {
    try {
      await db.query(
        'DELETE FROM saved_events WHERE user_id = $1 AND event_id = $2',
        [userId, eventId]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Get user's favorite events
  static async getFavorites(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Get events
      const eventsResult = await db.query(
        `SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at, se.created_at as saved_at
        FROM events e
        JOIN users u ON e.creator_id = u.id
        JOIN saved_events se ON e.id = se.event_id
        WHERE se.user_id = $1
        ORDER BY se.created_at DESC
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      // Get total count
      const countResult = await db.query(
        'SELECT COUNT(*) FROM saved_events WHERE user_id = $1',
        [userId]
      );
      
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Process each event
      const events = await Promise.all(eventsResult.rows.map(async (event) => {
        // Parse the location
        const locationData = JSON.parse(event.location);
        event.location = {
          latitude: locationData.coordinates[1],
          longitude: locationData.coordinates[0]
        };
        
        // Get the event categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [event.id]
        );
        
        event.categories = categoriesResult.rows;
        
        // Get the event ratings
        const ratingsResult = await db.query(
          `SELECT AVG(rating) as average_rating, COUNT(*) as review_count
          FROM reviews
          WHERE event_id = $1`,
          [event.id]
        );
        
        event.ratings = {
          averageRating: parseFloat(ratingsResult.rows[0].average_rating) || 0,
          reviewCount: parseInt(ratingsResult.rows[0].review_count) || 0
        };
        
        return event;
      }));
      
      return {
        events,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Event;
