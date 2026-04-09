const express = require('express');
const router = express.Router();

const { db, serializeTags, parseTags } = require('../db');

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    tags: parseTags(row.tags),
  };
}

// GET all bookmarks
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM bookmarks').all();
    res.json(rows.map(mapRow));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// GET bookmark by id
router.get('/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM bookmarks WHERE id = ?');
  const row = stmt.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Bookmark not found' });
  res.json(mapRow(row));
});

// CREATE bookmark
router.post('/', (req, res) => {
  const { title, url, description = null, tags = [] } = req.body;
  if (!title || !url) return res.status(400).json({ error: 'Title and URL are required' });
  try {
    const insert = db.prepare('INSERT INTO bookmarks (title, url, description, tags) VALUES (?, ?, ?, ?)');
    const info = insert.run(title, url, description, serializeTags(tags));
    const newRow = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(mapRow(newRow));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create bookmark' });
  }
});

// UPDATE bookmark
router.put('/:id', (req, res) => {
  const { title, url, description, tags } = req.body;
  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (url !== undefined) { fields.push('url = ?'); values.push(url); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (tags !== undefined) { fields.push('tags = ?'); values.push(serializeTags(tags)); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  const sql = `UPDATE bookmarks SET ${fields.join(', ')} WHERE id = ?`;
  values.push(req.params.id);
  try {
    const stmt = db.prepare(sql);
    const info = stmt.run(...values);
    if (info.changes === 0) return res.status(404).json({ error: 'Bookmark not found' });
    const updated = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
    res.json(mapRow(updated));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update bookmark' });
  }
});

// DELETE bookmark
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM bookmarks WHERE id = ?');
    const info = stmt.run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Bookmark not found' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

module.exports = router;
