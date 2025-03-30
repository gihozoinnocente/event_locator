/**
 * Jest setup file
 * 
 * This file runs before each test file to set up the test environment.
 */

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DEFAULT_SEARCH_RADIUS = '10000';

// Mock i18next
jest.mock('i18next', () => ({
  init: jest.fn().mockResolvedValue({}),
  use: jest.fn().mockReturnThis(),
  t: jest.fn((key) => key)
}));

// Mock Redis
jest.mock('../src/config/redis', () => {
  return {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    quit: jest.fn().mockResolvedValue(true),
    publish: jest.fn().mockResolvedValue(true),
    subscribe: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([])
  };
});

// Global teardown - runs after all tests
global.afterAll(async () => {
  // Clean up any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});