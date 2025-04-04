const User = require('../../../models/User');
const db = require('../../../config/database');
const bcrypt = require('bcryptjs');

// Mock the database module
jest.mock('../../../config/database');

describe('User Model', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      // Mock location data
      const mockLocation = {
        coordinates: [10.1234, 20.5678]
      };
      
      // Mock database response
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          full_name: 'Test User',
          location: JSON.stringify(mockLocation),
          preferred_language: 'en',
          created_at: new Date()
        }]
      });

      const user = await User.findById(1);

      // Assertions
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
      expect(user).toHaveProperty('id', 1);
      expect(user).toHaveProperty('username', 'testuser');
      expect(user.location).toEqual({
        latitude: 20.5678,
        longitude: 10.1234
      });
    });

    it('should return null when user not found', async () => {
      // Mock empty database response
      db.query.mockResolvedValue({
        rows: []
      });

      const user = await User.findById(999);

      // Assertions
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [999]
      );
      expect(user).toBeNull();
    });

    it('should throw an error when database query fails', async () => {
      // Mock database error
      const error = new Error('Database error');
      db.query.mockRejectedValue(error);

      // Assertions
      await expect(User.findById(1)).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    it('should create a new user and return it', async () => {
      // Mock bcrypt
      jest.spyOn(bcrypt, 'genSalt').mockResolvedValue('mocksalt');
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedpassword');

      // Mock location data
      const mockLocation = {
        coordinates: [10.1234, 20.5678]
      };

      // Mock database response for user creation
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          username: 'newuser',
          email: 'new@example.com',
          full_name: 'New User',
          location: JSON.stringify(mockLocation),
          preferred_language: 'en',
          created_at: new Date()
        }]
      });

      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User',
        latitude: 20.5678,
        longitude: 10.1234
      };

      const newUser = await User.create(userData);

      // Assertions
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'mocksalt');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          'newuser',
          'new@example.com',
          'hashedpassword',
          'New User',
          10.1234,
          20.5678,
          'en'
        ])
      );
      expect(newUser).toHaveProperty('id', 1);
      expect(newUser).toHaveProperty('username', 'newuser');
      expect(newUser.location).toEqual({
        latitude: 20.5678,
        longitude: 10.1234
      });
    });
  });

  describe('comparePassword', () => {
    it('should return true if passwords match', async () => {
      // Mock bcrypt compare
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await User.comparePassword('password123', 'hashedpassword');

      // Assertions
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(result).toBe(true);
    });

    it('should return false if passwords do not match', async () => {
      // Mock bcrypt compare
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const result = await User.comparePassword('wrongpassword', 'hashedpassword');

      // Assertions
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedpassword');
      expect(result).toBe(false);
    });
  });

  describe('update', () => {
    it('should update a user and return the updated user', async () => {
      // Mock location data
      const mockLocation = {
        coordinates: [11.4321, 22.8765]
      };

      // Mock database response
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          full_name: 'Updated Name',
          location: JSON.stringify(mockLocation),
          preferred_language: 'fr',
          updated_at: new Date()
        }]
      });

      const updateData = {
        fullName: 'Updated Name',
        latitude: 22.8765,
        longitude: 11.4321,
        preferredLanguage: 'fr'
      };

      const updatedUser = await User.update(1, updateData);

      // Assertions
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining([
          'Updated Name',
          11.4321,
          22.8765,
          'fr',
          1
        ])
      );
      expect(updatedUser).toHaveProperty('id', 1);
      expect(updatedUser).toHaveProperty('full_name', 'Updated Name');
      expect(updatedUser).toHaveProperty('preferred_language', 'fr');
      expect(updatedUser.location).toEqual({
        latitude: 22.8765,
        longitude: 11.4321
      });
    });
  });

  describe('updateCategoryPreferences', () => {
    it('should update category preferences and return them', async () => {
      // Mock database responses
      db.query
        // First call - delete existing preferences
        .mockResolvedValueOnce({})
        // Second call - insert new preferences
        .mockResolvedValueOnce({})
        // Third call - get updated preferences
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Music', description: 'Music events' },
            { id: 3, name: 'Tech', description: 'Technology events' }
          ]
        });

      const categoryIds = [1, 3];
      const preferences = await User.updateCategoryPreferences(1, categoryIds);

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        'DELETE FROM user_category_preferences WHERE user_id = $1',
        [1]
      );
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO user_category_preferences'),
        undefined
      );
      expect(preferences).toHaveLength(2);
      expect(preferences[0]).toHaveProperty('id', 1);
      expect(preferences[0]).toHaveProperty('name', 'Music');
      expect(preferences[1]).toHaveProperty('id', 3);
      expect(preferences[1]).toHaveProperty('name', 'Tech');
    });
  });
});