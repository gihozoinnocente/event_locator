const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Find a user by ID
  static async findById(id) {
    try {
      const result = await db.query(
        'SELECT id, username, email, full_name, ST_AsGeoJSON(location) as location, preferred_language, created_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) return null;
      
      const user = result.rows[0];
      const locationData = JSON.parse(user.location);
      user.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Find a user by username or email
  static async findByCredentials(usernameOrEmail) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE username = $1 OR email = $1',
        [usernameOrEmail]
      );
      
      if (result.rows.length === 0) return null;
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Create a new user
  static async create(userData) {
    const { username, email, password, fullName, latitude, longitude, preferredLanguage } = userData;
    
    try {
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Insert the user
      const result = await db.query(
        `INSERT INTO users 
        (username, email, password, full_name, location, preferred_language)
        VALUES 
        ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)
        RETURNING id, username, email, full_name, ST_AsGeoJSON(location) as location, preferred_language, created_at`,
        [username, email, hashedPassword, fullName, longitude, latitude, preferredLanguage || 'en']
      );
      
      const user = result.rows[0];
      const locationData = JSON.parse(user.location);
      user.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Update user details
  static async update(id, updateData) {
    try {
      const { fullName, latitude, longitude, preferredLanguage } = updateData;
      let query = 'UPDATE users SET ';
      const values = [];
      const queryParts = [];
      
      let paramIndex = 1;
      
      if (fullName) {
        queryParts.push(`full_name = $${paramIndex}`);
        values.push(fullName);
        paramIndex++;
      }
      
      if (latitude && longitude) {
        queryParts.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
        values.push(longitude, latitude);
        paramIndex += 2;
      }
      
      if (preferredLanguage) {
        queryParts.push(`preferred_language = $${paramIndex}`);
        values.push(preferredLanguage);
        paramIndex++;
      }
      
      queryParts.push(`updated_at = CURRENT_TIMESTAMP`);
      
      query += queryParts.join(', ');
      query += ` WHERE id = $${paramIndex} RETURNING id, username, email, full_name, ST_AsGeoJSON(location) as location, preferred_language, updated_at`;
      values.push(id);
      
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) return null;
      
      const user = result.rows[0];
      const locationData = JSON.parse(user.location);
      user.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Update user category preferences
  static async updateCategoryPreferences(userId, categoryIds) {
    try {
      // First, delete existing preferences
      await db.query('DELETE FROM user_category_preferences WHERE user_id = $1', [userId]);
      
      // Then, insert new preferences if there are any
      if (categoryIds && categoryIds.length > 0) {
        const values = categoryIds.map(categoryId => `(${userId}, ${categoryId})`).join(', ');
        await db.query(`INSERT INTO user_category_preferences (user_id, category_id) VALUES ${values}`);
      }
      
      // Return the updated preferences
      const result = await db.query(
        `SELECT c.id, c.name, c.description
         FROM categories c
         JOIN user_category_preferences ucp ON c.id = ucp.category_id
         WHERE ucp.user_id = $1`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Get user category preferences
  static async getCategoryPreferences(userId) {
    try {
      const result = await db.query(
        `SELECT c.id, c.name, c.description
         FROM categories c
         JOIN user_category_preferences ucp ON c.id = ucp.category_id
         WHERE ucp.user_id = $1`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Compare password for login
  static async comparePassword(candidatePassword, hashedPassword) {
    try {
      return await bcrypt.compare(candidatePassword, hashedPassword);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;