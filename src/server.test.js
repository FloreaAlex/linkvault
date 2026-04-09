const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Import the app and DATA_FILE constant
const { app, DATA_FILE, resetData } = require('./server');

// Helper to reset in-memory data before each test
function resetInMemory() {
  // Use the exported resetData function from server module
  resetData();
}

// Set a test API token for authentication
process.env.API_TOKEN = 'test-secret-token';
function authHeader() {
  return { Authorization: `Bearer ${process.env.API_TOKEN}` };
}

describe('LinkVault API', () => {
  beforeEach(() => {
    resetInMemory();
  });

  test('POST /bookmarks creates a bookmark', async () => {
    const payload = {
      title: 'OpenAI',
      url: 'https://openai.com',
      description: 'AI research lab',
      tags: ['ai', 'research']
    };
    const res = await request(app).post('/bookmarks').set(authHeader()).send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      title: payload.title,
      url: payload.url,
      description: payload.description,
      tags: payload.tags
    });
    expect(typeof res.body.id).toBe('string');
  });

  test('GET /bookmarks returns list and can filter by tag', async () => {
    // Create two bookmarks
    await request(app).post('/bookmarks').set(authHeader()).send({ title: 'A', url: 'http://a.com', tags: ['foo'] });
    await request(app).post('/bookmarks').set(authHeader()).send({ title: 'B', url: 'http://b.com', tags: ['bar'] });

    const allRes = await request(app).get('/bookmarks').set(authHeader());
    expect(allRes.statusCode).toBe(200);
    expect(allRes.body.length).toBe(2);

    const fooRes = await request(app).get('/bookmarks').set(authHeader()).query({ tag: 'foo' });
    expect(fooRes.statusCode).toBe(200);
    expect(fooRes.body.length).toBe(1);
    expect(fooRes.body[0].title).toBe('A');
  });

  test('GET /search finds bookmarks by title or description', async () => {
    await request(app).post('/bookmarks').set(authHeader()).send({ title: 'Node.js', url: 'http://nodejs.org', description: 'JavaScript runtime' });
    const res = await request(app).get('/search').set(authHeader()).query({ q: 'javascript' });
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Node.js');
  });

  test('GET /stats returns total count and popular tags', async () => {
    await request(app).post('/bookmarks').set(authHeader()).send({ title: 'One', url: 'http://one', tags: ['common'] });
    await request(app).post('/bookmarks').set(authHeader()).send({ title: 'Two', url: 'http://two', tags: ['common', 'extra'] });
    const res = await request(app).get('/stats').set(authHeader());
    expect(res.statusCode).toBe(200);
    expect(res.body.totalBookmarks).toBe(2);
    // popularTags should include 'common' with count 2
    const commonTag = res.body.popularTags.find(t => t.tag === 'common');
    expect(commonTag).toBeDefined();
    expect(commonTag.count).toBe(2);
  });
});
