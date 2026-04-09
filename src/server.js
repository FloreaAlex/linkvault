const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { randomUUID } = crypto;
const app = express();
// Basic security headers (similar to helmet)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
// Simple CORS middleware (replaces external cors package)
function allowCORS(req, res, next) {
  const allowedOrigin = process.env.CORS_ORIGIN; // No default wildcard
  if (allowedOrigin && (allowedOrigin === '*' || req.headers.origin === allowedOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}
// Apply CORS middleware; if CORS_ORIGIN is not set, no Access-Control-Allow-Origin header will be sent
app.use(allowCORS); // Enable CORS for all routes
// Serve static files (UI)
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.ip} ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
}
app.use(requestLogger);
// Parse JSON bodies (limit 1mb)
app.use(express.json({ limit: '1mb' }));

// Rate limiting – simple in‑memory token bucket per IP (10 req/s, burst 20)
const rateLimits = new Map();
function rateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const limit = rateLimits.get(ip) || { tokens: 20, last: now };
  const elapsed = (now - limit.last) / 1000;
  limit.tokens = Math.min(20, limit.tokens + elapsed * 10);
  limit.last = now;
  if (limit.tokens >= 1) {
    limit.tokens -= 1;
    rateLimits.set(ip, limit);
    next();
  } else {
    res.status(429).json({ error: 'Too Many Requests' });
  }
}
app.use(rateLimiter);

// In-memory storage for bookmarks; persisted to disk in DATA_FILE
let bookmarks = [];

/** Load bookmarks from disk (or memory if already loaded) */
function loadBookmarks() {
  // If already loaded, return cached version
  if (bookmarks.length) return bookmarks;
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    bookmarks = JSON.parse(data);
  } catch (err) {
    // If file doesn't exist or is invalid, start with empty array
    bookmarks = [];
  }
  return bookmarks;
}
/** Persist bookmarks to disk */
function saveBookmarks(updated) {
  // Write atomically: first to a temp file then rename
  const tmpPath = DATA_FILE + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DATA_FILE);
    bookmarks = updated;
  } catch (err) {
    console.error('Failed to write bookmarks atomically:', err);
  }
}

// Data file for persistence
const DATA_FILE = path.join(__dirname, 'data.json');

// Helper: sanitize strings to prevent XSS
function sanitize(str) {
  if (typeof str !== 'string') return '';
  // Escape &, <, >, " and '
  return str.replace(/[&<>"']/g, function (c) {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
    }
  });
}

// Helper: validate bookmark payload
function authRequired(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  const expected = process.env.API_TOKEN;
  // If a token is configured, enforce it; otherwise allow all requests
  if (expected) {
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    // Use constant‑time compare only when lengths match to avoid RangeError
    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
}
function validateBookmark(payload) {
  // Ensure payload is an object
  if (!payload || typeof payload !== 'object') {
    return ['invalid request body'];
  }
  const errors = [];
  if (!payload.title || typeof payload.title !== 'string') errors.push('title is required and must be a string');
  else if (payload.title.length > 200) errors.push('title must be at most 200 characters');

  if (!payload.url || typeof payload.url !== 'string') {
    errors.push('url is required and must be a string');
  } else {
    try {
      const u = new URL(payload.url);
      if (!['http:', 'https:'].includes(u.protocol)) errors.push('url protocol must be http or https');
    } catch (_) { errors.push('url must be a valid URL'); }
  }

  if (payload.description && typeof payload.description !== 'string') errors.push('description must be a string');
  else if (payload.description && payload.description.length > 1000) errors.push('description must be at most 1000 characters');

  if (payload.tags) {
    if (!Array.isArray(payload.tags)) errors.push('tags must be an array of strings');
    else if (payload.tags.length > 20) errors.push('maximum of 20 tags allowed');
    else if (!payload.tags.every(t => typeof t === 'string')) errors.push('each tag must be a string');
    else if (payload.tags.some(t => t.length > 30)) errors.push('individual tags must be at most 30 characters');
  }
  return errors;
}

// Create bookmark
app.post('/bookmarks', authRequired, (req, res) => {
  // Load current bookmarks from disk
  const bookmarks = loadBookmarks();
  const payload = req.body;
  const errors = validateBookmark(payload);
  if (errors.length) return res.status(400).json({ errors });
  const newBm = {
    id: randomUUID(),
    title: sanitize(payload.title),
    url: payload.url,
    description: sanitize(payload.description || ''),
    tags: payload.tags ? payload.tags.map(t => sanitize(t.trim())).filter(Boolean) : [],
    createdAt: new Date().toISOString()
  };
  const updated = [...bookmarks, newBm];
  saveBookmarks(updated);
  res.status(201).json(newBm);
});

// List bookmarks, optional tag filter – protected endpoint
app.get('/bookmarks', authRequired, (req, res) => {
  const bookmarks = loadBookmarks();
  const { tag } = req.query;
  let result = bookmarks;
  if (tag && typeof tag === 'string') {
    result = result.filter(bm => bm.tags.includes(tag));
  }
  res.json(result);
});

// Search bookmarks by title or description (case‑insensitive) – protected endpoint
app.get('/search', authRequired, (req, res) => {
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

// Statistics: total count and most popular tags – protected endpoint
app.get('/stats', authRequired, (req, res) => {
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
// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Generic error handler to avoid leaking stack traces
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Update endpoint – modify existing bookmark
app.put('/bookmarks/:id', authRequired, (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  const errors = validateBookmark(payload);
  if (errors.length) return res.status(400).json({ errors });
  const bookmarks = loadBookmarks();
  const index = bookmarks.findIndex(b => b.id === id);
  if (index === -1) return res.status(404).json({ error: 'Bookmark not found' });
  const existing = bookmarks[index];
  const updatedBm = {
    ...existing,
    title: sanitize(payload.title),
    url: payload.url,
    description: sanitize(payload.description || ''),
    tags: payload.tags ? payload.tags.map(t => sanitize(t.trim())).filter(Boolean) : [],
    updatedAt: new Date().toISOString()
  };
  const updated = [...bookmarks];
  updated[index] = updatedBm;
  saveBookmarks(updated);
  res.json(updatedBm);
});

// Delete endpoint – remove bookmark by id
app.delete('/bookmarks/:id', authRequired, (req, res) => {
  const { id } = req.params;
  const bookmarks = loadBookmarks();
  const index = bookmarks.findIndex(b => b.id === id);
  if (index === -1) return res.status(404).json({ error: 'Bookmark not found' });
  const updated = bookmarks.filter(b => b.id !== id);
  saveBookmarks(updated);
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`LinkVault server listening on port ${PORT}`));
}

module.exports = { app, DATA_FILE, resetData: () => {
  bookmarks = [];
  // Clear persisted file as well for test isolation
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to reset data file:', err);
  }
} };
