const path = require('path');
const Database = require('better-sqlite3');

// Resolve database file location (project root)
const dbPath = path.resolve(__dirname, '..', 'linkvault.db');
const db = new Database(dbPath);

// Initialize schema
const initStmt = `
CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    tags TEXT -- JSON array stored as text
);
`;

db.exec(initStmt);

function serializeTags(tagsArray) {
  if (!Array.isArray(tagsArray)) {
    throw new TypeError('tags must be an array');
  }
  return JSON.stringify(tagsArray);
}

function parseTags(tagsJson) {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
    return [];
  } catch (e) {
    console.error('Failed to parse tags JSON:', e);
    return [];
  }
}

module.exports = { db, serializeTags, parseTags };
