// Frontend script for LinkVault UI
(() => {
  const apiBase = '';
  const getToken = () => document.getElementById('token').value.trim();
  const authHeader = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Elements
  const bookmarkListEl = document.getElementById('bookmark-list');
  const statsEl = document.getElementById('stats');
  const form = document.getElementById('bookmark-form');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const clearSearchBtn = document.getElementById('clear-search');

  // Load all bookmarks initially
  let currentBookmarks = [];
  let filterTag = null; // active tag filter

  function renderStats(total, popularTags) {
    const tagsHtml = popularTags.map(t => `<span class="tag" data-tag="${t.tag}">${t.tag} (${t.count})</span>`).join(' ');
    statsEl.innerHTML = `<h2>Stats</h2><p>Total bookmarks: ${total}</p><p>Popular tags: ${tagsHtml}</p>`;
    // Attach click listeners to popular tag filters
    statsEl.querySelectorAll('.tag').forEach(el => {
      el.addEventListener('click', () => { filterTag = el.dataset.tag; loadBookmarks(); });
    });
  }

  function renderBookmarks(list) {
    if (list.length === 0) {
      bookmarkListEl.innerHTML = '<p>No bookmarks found.</p>';
      return;
    }
    const html = list.map(b => {
      const tagsHtml = b.tags.map(t => `<span class="tag" data-tag="${t}">${t}</span>`).join(' ');
      return `
        <div class="bookmark-item" data-id="${b.id}">
          <a href="${b.url}" target="_blank" rel="noopener" class="bookmark-title">${b.title}</a>
          ${b.description ? `<p>${b.description}</p>` : ''}
          <div>${tagsHtml}</div>
          <button class="delete-btn" title="Delete">✕</button>
        </div>`;
    }).join('');
    bookmarkListEl.innerHTML = html;
    // Tag click filter
    bookmarkListEl.querySelectorAll('.tag').forEach(el => {
      el.addEventListener('click', () => { filterTag = el.dataset.tag; loadBookmarks(); });
    });
    // Delete handlers
    bookmarkListEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('.bookmark-item').dataset.id;
        await fetch(`${apiBase}/bookmarks/${id}`, { method: 'DELETE', headers: authHeader() });
        loadBookmarks();
      });
    });
  }

  async function loadBookmarks() {
    try {
      const url = new URL('/bookmarks', window.location.origin);
      if (filterTag) url.searchParams.append('tag', filterTag);
      const res = await fetch(url, { headers: authHeader() });
      if (!res.ok) throw new Error('Failed to load bookmarks');
      currentBookmarks = await res.json();
      renderBookmarks(currentBookmarks);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch('/stats', { headers: authHeader() });
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      renderStats(data.totalBookmarks, data.popularTags);
    } catch (e) {
      console.error(e);
    }
  }

  // Search handler
  async function performSearch(term) {
    if (!term) return loadBookmarks();
    const url = new URL('/search', window.location.origin);
    url.searchParams.append('q', term);
    const res = await fetch(url, { headers: authHeader() });
    if (res.ok) {
      const results = await res.json();
      renderBookmarks(results);
    }
  }

  // Form submit handler to add bookmark
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const urlVal = document.getElementById('url').value.trim();
    const description = document.getElementById('description').value.trim();
    const tagsRaw = document.getElementById('tags').value;
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const payload = { title, url: urlVal, description, tags };
    try {
      const res = await fetch('/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add');
      // Reset form
      form.reset();
      filterTag = null;
      await loadBookmarks();
      await loadStats();
    } catch (err) {
      console.error(err);
    }
  });

  searchBtn.addEventListener('click', () => performSearch(searchInput.value.trim()));
  clearSearchBtn.addEventListener('click', () => { searchInput.value = ''; filterTag = null; loadBookmarks(); });

  // Initial load
  loadBookmarks();
  loadStats();
})();
