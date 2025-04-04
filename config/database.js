const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create a connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Error executing query', err.stack);
    }
    console.log('Database connected successfully');
    
    // Initialize PostGIS if it's not already enabled
    client.query('CREATE EXTENSION IF NOT EXISTS postgis', (err) => {
      if (err) {
        console.error('Error enabling PostGIS extension', err.stack);
      } else {
        console.log('PostGIS extension enabled');
        
        // Check if tables already exist before initializing schema
        client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')", (checkErr, checkResult) => {
          if (checkErr) {
            console.error('Error checking if tables exist', checkErr.stack);
            return;
          }
          
          // If users table doesn't exist, initialize the schema
          if (!checkResult.rows[0].exists) {
            console.log('Tables do not exist, initializing schema...');
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            
            // Execute the schema SQL
            client.query(schemaSql, (schemaErr) => {
              if (schemaErr) {
                console.error('Error initializing database schema', schemaErr.stack);
              } else {
                console.log('Database schema initialized successfully');
              }
            });
          } else {
            console.log('Database tables already exist, skipping schema initialization');
          }
        });
      }
    });
  });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};