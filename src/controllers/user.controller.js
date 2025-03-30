const db = require('../config/database');
const { generatePoint, extractCoordinates } = require('../utils/helpers');

/**
 * Get user profile
 */
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user data
    const { rows: userRows } = await db.query(
      'SELECT id, username, email, location, preferred_language, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ message: req.t('users.not_found') });
    }
    
    const user = userRows[0];
    
    // Extract coordinates from PostGIS point
    if (user.location) {
      user.coordinates = extractCoordinates(user.location);
      delete user.location; // Remove raw PostGIS point
    }
    
    // Get user's category preferences
    const { rows: preferenceRows } = await db.query(
      `SELECT c.id, c.name 
       FROM categories c
       JOIN user_category_preferences ucp ON c.id = ucp.category_id
       WHERE ucp.user_id = $1`,
      [userId]
    );
    
    // Get user's favorite events
    const { rows: favoriteRows } = await db.query(
      `SELECT e.id, e.title 
       FROM events e
       JOIN user_favorite_events ufe ON e.id = ufe.event_id
       WHERE ufe.user_id = $1`,
      [userId]
    );
    
    // Return user profile with preferences and favorites
    res.json({
      user,
      preferences: preferenceRows,
      favorites: favoriteRows
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Update user profile
 */
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, preferredLanguage } = req.body;
    
    // Check if email is already taken by another user
    if (email) {
      const { rows } = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      
      if (rows.length > 0) {
        return res.status(400).json({ message: req.t('auth.email_exists') });
      }
    }
    
    // Prepare update fields
    let updateQuery = 'UPDATE users SET ';
    const updateValues = [];
    const updateFields = [];
    
    if (username) {
      updateFields.push(`username = $${updateValues.length + 1}`);
      updateValues.push(username);
    }
    
    if (email) {
      updateFields.push(`email = $${updateValues.length + 1}`);
      updateValues.push(email);
    }
    
    if (preferredLanguage) {
      updateFields.push(`preferred_language = $${updateValues.length + 1}`);
      updateValues.push(preferredLanguage);
    }
    
    updateFields.push(`updated_at = $${updateValues.length + 1}`);
    updateValues.push(new Date());
    
    updateQuery += updateFields.join(', ');
    updateQuery += ` WHERE id = $${updateValues.length + 1} RETURNING id, username, email, preferred_language`;
    updateValues.push(userId);
    
    // Update user
    const { rows } = await db.query(updateQuery, updateValues);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: req.t('users.not_found') });
    }
    
    res.json({
      message: req.t('users.updated'),
      user: rows[0]
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Update user location
 */
const updateUserLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;
    
    // Generate PostGIS point
    const point = generatePoint(latitude, longitude);
    
    // Update user location
    const { rows } = await db.query(
      'UPDATE users SET location = ST_SetSRID(ST_GeographyFromText($1), 4326), updated_at = NOW() WHERE id = $2 RETURNING id',
      [point, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: req.t('users.not_found') });
    }
    
    res.json({
      message: req.t('users.location_updated'),
      coordinates: { latitude, longitude }
    });
  } catch (error) {
    console.error('Error updating user location:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Update user category preferences
 */
const updateCategoryPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { categories } = req.body;
    
    // Start a transaction
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete existing preferences
      await client.query(
        'DELETE FROM user_category_preferences WHERE user_id = $1',
        [userId]
      );
      
      // Insert new preferences if provided
      if (categories && categories.length > 0) {
        const values = categories.map((categoryId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        const params = [userId, ...categories];
        
        await client.query(
          `INSERT INTO user_category_preferences (user_id, category_id) VALUES ${values}`,
          params
        );
      }
      
      await client.query('COMMIT');
      
      res.json({
        message: req.t('users.preferences_updated'),
        categories: categories || []
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating category preferences:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Get user's favorite events
 */
const getFavoriteEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { rows } = await db.query(
      `SELECT e.id, e.title, e.description, e.location, e.address, 
              e.start_date, e.end_date, e.created_by, e.created_at, e.updated_at
       FROM events e
       JOIN user_favorite_events ufe ON e.id = ufe.event_id
       WHERE ufe.user_id = $1
       ORDER BY ufe.created_at DESC`,
      [userId]
    );
    
    // Format events
    const formattedEvents = rows.map(event => {
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        location: extractCoordinates(event.location),
        address: event.address,
        startDate: event.start_date,
        endDate: event.end_date,
        createdBy: event.created_by,
        createdAt: event.created_at,
        updatedAt: event.updated_at
      };
    });
    
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error getting favorite events:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateUserLocation,
  updateCategoryPreferences,
  getFavoriteEvents
};