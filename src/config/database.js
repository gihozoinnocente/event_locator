const { Pool } = require('pg');

// Create a new PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// Initialize PostGIS extension if it doesn't exist
const initializePostGIS = async () => {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    console.log('PostGIS extension initialized');
  } catch (error) {
    console.error('Error initializing PostGIS:', error);
  } finally {
    client.release();
  }
};

// Function to initialize database tables
const initializeTables = async () => {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        location GEOGRAPHY(POINT) NULL,
        preferred_language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        location GEOGRAPHY(POINT) NOT NULL,
        address VARCHAR(255),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create event_categories junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_categories (
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (event_id, category_id)
      )
    `);

    // Create user_category_preferences junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_category_preferences (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, category_id)
      )
    `);

    // Create event_ratings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_ratings (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        review TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      )
    `);

    // Create user_favorite_events junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_favorite_events (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, event_id)
      )
    `);

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Error initializing database tables:', error);
  } finally {
    client.release();
  }
};

// Initialize database with PostGIS and tables
const connect = async () => {
  try {
    await pool.query('SELECT NOW()'); // Test query
    await initializePostGIS();
    await initializeTables();
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

// Export the pool and helper functions
module.exports = {
  query: (text, params) => pool.query(text, params),
  connect,
  end: () => pool.end()
};