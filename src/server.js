const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json());

// Path to JSON file storing bookmarks
const DATA_FILE = path.join(__dirname, 'data.json');

/** Load bookmarks from disk; if missing, start with empty array */
function loadBookmarks() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    // If file does not exist or is malformed, reset it
    if (err.code !== 'ENOENT') console.error('Failed to read data file:', err);
    return [];
  }
}
/** Persist bookmarks array to disk */
function saveBookmarks(bookmarks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(bookmarks, null, 2), 'utf-8');
}

// Helper: validate bookmark payload
function validateBookmark(payload) {
  const errors = [];
  if (!payload.title || typeof payload.title !== 'string') errors.push('title is required and must be a string');
  if (!payload.url || typeof payload.url !== 'string') errors.push('url is required and must be a string');
  if (payload.description && typeof payload.description !== 'string') errors.push('description must be a string');
  if (payload.tags) {
    if (!Array.isArray(payload.tags)) errors.push('tags must be an array of strings');
    else if (!payload.tags.every(t => typeof t === 'string')) errors.push('each tag must be a string');
  }
  return errors;
}

// Create bookmark
app.post('/bookmarks', (req, res) => {
  // Load current bookmarks from disk
  const bookmarks = loadBookmarks();
  const payload = req.body;
  const errors = validateBookmark(payload);
  if (errors.length) return res.status(400).json({ errors });
  const newBm = {
    id: randomUUID(),
    title: payload.title,
    url: payload.url,
    description: payload.description || '',
    tags: payload.tags ? payload.tags.map(t => t.trim()).filter(Boolean) : [],
    createdAt: new Date().toISOString()
  };
  const updated = [...bookmarks, newBm];
  saveBookmarks(updated);
  res.status(201).json(newBm);
});

// List bookmarks, optional tag filter
app.get('/bookmarks', (req, res) => {
  const bookmarks = loadBookmarks();
  const { tag } = req.query;
    let result = bookmarks;
  if (tag && typeof tag === 'string') {
    result = result.filter(bm => bm.tags.includes(tag));
  }
  res.json(result);
});

// Search bookmarks by title or description (case‑insensitive)
app.get('/search', (req, res) => {
  const bookmarks = loadBookmarks();
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.status(400).json({ error: 'query parameter "q" is required' });
  const term = q.toLowerCase();
    const result = bookmarks.filter(bm =>
    bm.title.toLowerCase().includes(term) ||
    (bm.description && bm.description.toLowerCase().includes(term))
  );
  res.json(result);
});

// Statistics: total count and most popular tags
app.get('/stats', (req, res) => {
  const bookmarks = loadBookmarks();
    const total = bookmarks.length;
  const tagCounts = {};
  bookmarks.forEach(bm => {
    bm.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  // Sort tags by frequency descending, take top 5
  const popularTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  res.json({ totalBookmarks: total, popularTags });
});

// Basic health check
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`LinkVault server listening on port ${PORT}`));
}

module.exports = { app, DATA_FILE, resetData: () => {
  bookmarks = [];
  saveBookmarks(bookmarks);
} };
