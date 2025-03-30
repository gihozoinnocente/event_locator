const userController = require('../../src/controllers/user.controller');
const db = require('../../src/config/database');

// Mock the database module
jest.mock('../../src/config/database');

describe('User Controller', () => {
  // Mock request and response objects
  let req;
  let res;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup request mock
    req = {
      user: { id: 1 },
      t: jest.fn().mockImplementation(key => key) // Mock i18n translate function
    };
    
    // Setup response mock
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });
  
  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      // Mock database responses
      db.query.mockImplementation((query) => {
        if (query.includes('SELECT id, username, email, location')) {
          return { 
            rows: [{ 
              id: 1, 
              username: 'testuser', 
              email: 'test@example.com',
              location: 'POINT(10.123 20.456)',
              preferred_language: 'en',
              created_at: new Date()
            }] 
          };
        } else if (query.includes('SELECT c.id, c.name')) {
          return { 
            rows: [
              { id: 1, name: 'Music' },
              { id: 2, name: 'Sports' }
            ] 
          };
        } else if (query.includes('SELECT e.id, e.title')) {
          return { 
            rows: [
              { id: 1, title: 'Event 1' },
              { id: 2, title: 'Event 2' }
            ] 
          };
        }
        return { rows: [] };
      });
      
      // Call the controller method
      await userController.getUserProfile(req, res);
      
      // Assertions
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(res.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          coordinates: { lat: 20.456, lng: 10.123 }
        }),
        preferences: [
          { id: 1, name: 'Music' },
          { id: 2, name: 'Sports' }
        ],
        favorites: [
          { id: 1, title: 'Event 1' },
          { id: 2, title: 'Event 2' }
        ]
      });
    });
    
    it('should return 404 if user not found', async () => {
      // Mock database response for user not found
      db.query.mockResolvedValueOnce({ rows: [] });
      
      // Call the controller method
      await userController.getUserProfile(req, res);
      
      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'users.not_found' });
    });
    
    it('should handle server error', async () => {
      // Mock database error
      db.query.mockRejectedValueOnce(new Error('Database error'));
      
      // Call the controller method
      await userController.getUserProfile(req, res);
      
      // Assertions
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'server_error' });
    });
  });
  
  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      // Setup request body
      req.body = {
        username: 'newusername',
        email: 'newemail@example.com',
        preferredLanguage: 'es'
      };
      
      // Mock database responses
      db.query.mockImplementation((query) => {
        if (query.includes('SELECT id FROM users WHERE email =')) {
          return { rows: [] }; // Email not taken
        } else if (query.includes('UPDATE users SET')) {
          return { 
            rows: [{ 
              id: 1, 
              username: 'newusername', 
              email: 'newemail@example.com',
              preferred_language: 'es'
            }] 
          };
        }
        return { rows: [] };
      });
      
      // Call the controller method
      await userController.updateUserProfile(req, res);
      
      // Assertions
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({
        message: 'users.updated',
        user: expect.objectContaining({
          id: 1,
          username: 'newusername',
          email: 'newemail@example.com',
          preferred_language: 'es'
        })
      });
    });
    
    it('should return 400 if email is already taken', async () => {
      // Setup request body
      req.body = {
        email: 'taken@example.com'
      };
      
      // Mock database response for email check
      db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // Email taken by another user
      
      // Call the controller method
      await userController.updateUserProfile(req, res);
      
      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'auth.email_exists' });
    });
  });
  
  // Add more tests for other methods...
});