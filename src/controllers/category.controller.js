const db = require('../config/database');

/**
 * Get all categories
 */
const getAllCategories = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, created_at FROM categories ORDER BY name'
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Create a new category
 */
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    
    // Check if category already exists
    const { rows: existingRows } = await db.query(
      'SELECT id FROM categories WHERE name = $1',
      [name]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ message: req.t('categories.exists') });
    }
    
    // Create category
    const { rows } = await db.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at',
      [name]
    );
    
    res.status(201).json({
      message: req.t('categories.created'),
      category: rows[0]
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Update a category
 */
const updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name } = req.body;
    
    // Check if category exists
    const { rows: categoryRows } = await db.query(
      'SELECT id FROM categories WHERE id = $1',
      [categoryId]
    );
    
    if (categoryRows.length === 0) {
      return res.status(404).json({ message: req.t('categories.not_found') });
    }
    
    // Check if name is already taken
    const { rows: existingRows } = await db.query(
      'SELECT id FROM categories WHERE name = $1 AND id != $2',
      [name, categoryId]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ message: req.t('categories.exists') });
    }
    
    // Update category
    const { rows } = await db.query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name, created_at',
      [name, categoryId]
    );
    
    res.json({
      message: req.t('categories.updated'),
      category: rows[0]
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Delete a category
 */
const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Check if category exists
    const { rows } = await db.query(
      'SELECT id FROM categories WHERE id = $1',
      [categoryId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: req.t('categories.not_found') });
    }
    
    // Delete category
    await db.query(
      'DELETE FROM categories WHERE id = $1',
      [categoryId]
    );
    
    res.json({ message: req.t('categories.deleted') });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory
};