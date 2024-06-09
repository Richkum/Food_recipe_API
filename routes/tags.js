import express from 'express';
import pool from '../db.config/index.js';

const router = express.Router();

// Fetch all tags
router.get('/', async (req, res, next) => {
  try {
    const query = 'SELECT * FROM tags';
    const { rows: tags } = await pool.query(query);
    res.status(200).json(tags);
  } catch (error) {
    next(error);
  }
});

// Create a new tag
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    const query = 'INSERT INTO tags (name) VALUES ($1) RETURNING *';
    const {
      rows: [tag],
    } = await pool.query(query, [name]);
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
});

// Fetch a tag by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM tags WHERE tag_id = $1';
    const {
      rows: [tag],
    } = await pool.query(query, [id]);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json(tag);
  } catch (error) {
    next(error);
  }
});

// Update a tag
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const query = 'UPDATE tags SET name = $1 WHERE tag_id = $2 RETURNING *';
    const {
      rows: [tag],
    } = await pool.query(query, [name, id]);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json(tag);
  } catch (error) {
    next(error);
  }
});

// Delete a tag
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM tags WHERE tag_id = $1 RETURNING *';
    const {
      rows: [tag],
    } = await pool.query(query, [id]);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
