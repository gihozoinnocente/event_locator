const { createClient } = require('redis');

// Create Redis client
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

// Handle Redis client errors
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Export the Redis client
module.exports = redisClient;