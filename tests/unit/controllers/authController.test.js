const authController = require('../../../controllers/authController');
const User = require('../../../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../../models/User');
jest.mock('jsonwebtoken');
jest.mock('express-validator');

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request, response, and next function
    req = {
      body: {},
      t: jest.fn().mockImplementation(key => key) // Mock i18n translate function
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    // Mock validation result
    validationResult.mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    });
  });

  describe('register', () => {
    it('should register a new user and return token', async () => {
      // Mock request data
      req.body = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User',
        latitude: 20.5678,
        longitude: 10.1234
      };

      // Mock User.findByCredentials to return null (user doesn't exist)
      User.findByCredentials.mockResolvedValue(null);

      // Mock User.create to return a new user
      User.create.mockResolvedValue({
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        full_name: 'New User',
        location: {
          latitude: 20.5678,
          longitude: 10.1234
        },
        preferred_language: 'en'
      });

      // Mock JWT sign
      jwt.sign.mockReturnValue('mocktoken');

      await authController.register(req, res, next);

      // Assertions
      expect(User.findByCredentials).toHaveBeenCalledWith('new@example.com');
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      }));
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        token: 'mocktoken',
        user: expect.any(Object)
      }));
    });

    it('should return 400 if validation fails', async () => {
      // Mock validation failure
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Email is required' }])
      });

      await authController.register(req, res, next);

      // Assertions
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        errors: expect.any(Array)
      }));
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should return 400 if user already exists', async () => {
      // Mock request data
      req.body = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123'
      };

      // Mock User.findByCredentials to return an existing user
      User.findByCredentials.mockResolvedValue({
        id: 1,
        email: 'existing@example.com'
      });

      await authController.register(req, res, next);

      // Assertions
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'auth:userExists'
      }));
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should call next with error if User.create throws', async () => {
      // Mock request data
      req.body = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      };

      // Mock User.findByCredentials to return null (user doesn't exist)
      User.findByCredentials.mockResolvedValue(null);

      // Mock User.create to throw error
      const error = new Error('Database error');
      User.create.mockRejectedValue(error);

      await authController.register(req, res, next);

      // Assertions
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login user and return token', async () => {
      // Mock request data
      req.body = {
        email: 'user@example.com',
        password: 'password123'
      };

      // Mock User.findByCredentials to return a user
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'user@example.com',
        password: 'hashedpassword',
        full_name: 'Test User',
        preferred_language: 'en'
      };
      User.findByCredentials.mockResolvedValue(mockUser);
      
      // Mock User.findById to return user with location
      User.findById.mockResolvedValue({
        ...mockUser,
        location: {
          latitude: 20.5678,
          longitude: 10.1234
        }
      });

      // Mock User.comparePassword to return true
      User.comparePassword.mockResolvedValue(true);

      // Mock JWT sign
      jwt.sign.mockReturnValue('mocktoken');

      await authController.login(req, res, next);

      // Assertions
      expect(User.findByCredentials).toHaveBeenCalledWith('user@example.com');
      expect(User.comparePassword).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        token: 'mocktoken',
        user: expect.any(Object)
      }));
    });

    it('should return 401 if user not found', async () => {
      // Mock request data
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      // Mock User.findByCredentials to return null
      User.findByCredentials.mockResolvedValue(null);

      await authController.login(req, res, next);

      // Assertions
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'auth:invalidCredentials'
      }));
      expect(User.comparePassword).not.toHaveBeenCalled();
    });

    it('should return 401 if password is incorrect', async () => {
      // Mock request data
      req.body = {
        email: 'user@example.com',
        password: 'wrongpassword'
      };

      // Mock User.findByCredentials to return a user
      User.findByCredentials.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        password: 'hashedpassword'
      });

      // Mock User.comparePassword to return false
      User.comparePassword.mockResolvedValue(false);

      await authController.login(req, res, next);

      // Assertions
      expect(User.comparePassword).toHaveBeenCalledWith('wrongpassword', 'hashedpassword');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'auth:invalidCredentials'
      }));
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user profile', async () => {
      // Mock authenticated user in request
      req.user = {
        id: 1
      };

      // Mock User.findById to return a user
      User.findById.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'user@example.com',
        full_name: 'Test User',
        location: {
          latitude: 20.5678,
          longitude: 10.1234
        },
        preferred_language: 'en'
      });

      await authController.getCurrentUser(req, res, next);

      // Assertions
      expect(User.findById).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        user: expect.objectContaining({
          id: 1,
          username: 'testuser'
        })
      }));
    });

    it('should call next with error if User.findById throws', async () => {
      // Mock authenticated user in request
      req.user = {
        id: 1
      };

      // Mock User.findById to throw error
      const error = new Error('Database error');
      User.findById.mockRejectedValue(error);

      await authController.getCurrentUser(req, res, next);

      // Assertions
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});