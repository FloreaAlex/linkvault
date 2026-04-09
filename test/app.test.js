/**
 * Test that loadBookmarks renders bookmark cards correctly.
 */

// @jest-environment jsdom

describe('Bookmark rendering', () => {
  let originalFetch;
  const mockBookmarks = [
    { id: '1', title: 'Google', url: 'https://google.com', description: '', tags: ['search'], createdAt: new Date().toISOString() },
    { id: '2', title: 'GitHub', url: 'https://github.com', description: 'Code host', tags: [], createdAt: new Date().toISOString() }
  ];

  beforeAll(() => {
    // Load the app script into the jsdom environment
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../src/public/app.js'), 'utf8');
    // eslint-disable-next-line no-eval
    eval(code);
  });

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn((url) => {
      if (typeof url === 'string' && url.includes('/bookmarks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBookmarks) });
      }
      // default mock
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('loadBookmarks populates bookmark list', async () => {
    // Ensure DOM element exists (index.html structure)
    document.body.innerHTML = `
      <div id="bookmark-list"></div>
      <button id="search-btn"></button>
      <input id="search-input" />
      <button id="clear-search"></button>
    `;

    // Call the loadBookmarks function defined in app.js (it is global)
    await window.loadBookmarks();

    const listEl = document.getElementById('bookmark-list');
    expect(listEl).not.toBeNull();
    // Should contain two bookmark-item divs
    expect(listEl.querySelectorAll('.bookmark-item').length).toBe(mockBookmarks.length);
  });
});
