// Frontend script for LinkVault UI
(() => {
  const apiBase = '';
  const getToken = () => document.getElementById('token').value.trim();
  const authHeader = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Helper to escape HTML content safely
  function esc(text) { const el = document.createElement('div'); el.textContent = text; return el.innerHTML; }

  // Elements
  const bookmarkListEl = document.getElementById('bookmark-list');
  const statsEl = document.getElementById('stats');
  const form = document.getElementById('bookmark-form');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const clearSearchBtn = document.getElementById('clear-search');
  // Modal controls
  const openAddModalBtn = document.getElementById('open-add-modal');
  const closeAddModalBtn = document.getElementById('close-add-modal');
  const addModal = document.getElementById('add-modal');

  // Modal toggle listeners
  if (openAddModalBtn) {
    openAddModalBtn.addEventListener('click', () => addModal.classList.remove('hidden'));
  }
  if (closeAddModalBtn) {
    closeAddModalBtn.addEventListener('click', () => addModal.classList.add('hidden'));
  }

  // Load all bookmarks initially
  let currentBookmarks = [];
  const appState = { filterTag: null }; // single source of truth for filter

  function renderStats(total, popularTags) {
    const tagsHtml = popularTags.map(t => `<span class="tag" data-tag="${t.tag}">${t.tag} (${t.count})</span>`).join(' ');
    statsEl.innerHTML = `<h2>Stats</h2><p>Total bookmarks: ${total}</p><p>Popular tags: ${tagsHtml}</p>`;
    // Attach click listeners to popular tag filters
    statsEl.querySelectorAll('.tag').forEach(el => {
      el.addEventListener('click', () => { filterTag = el.dataset.tag; loadBookmarks(); });
    });
  }

  function renderBookmarks(list, _filterTag) { // added param for compatibility
    if (list.length === 0) {
      bookmarkListEl.innerHTML = '<div class="empty-state">No bookmarks found.</div>';
      return;
    }
    const html = list.map(b => {
      const safeTitle = esc(b.title);
      const safeDesc = b.description ? esc(b.description) : '';
      const tagsHtml = b.tags.map(t => `<span class="tag" data-tag="${esc(t)}">${esc(t)}</span>`).join(' ');
      const urlValid = /^https?:\/\//i.test(b.url);
      const titleLink = urlValid ? `<a href="${b.url}" target="_blank" rel="noopener" class="bookmark-title">${safeTitle}</a>` : `<span class="bookmark-title">${safeTitle}</span>`;
      return `
        <div class="bookmark-item" data-id="${b.id}">
          ${titleLink}
          ${safeDesc ? `<p>${safeDesc}</p>` : ''}
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

  async function loadBookmarks(passedTag) {
    try {
      const url = new URL('/bookmarks', window.location.origin);
      const tag = passedTag !== undefined ? passedTag : filterTag;
      if (tag) url.searchParams.append('tag', tag);
      const res = await fetch(url, { headers: authHeader() });
      if (!res.ok) throw new Error('Failed to load bookmarks');
      currentBookmarks = await res.json();
      renderBookmarks(currentBookmarks, passedTag);
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
      // Close modal after adding
      addModal.classList.add('hidden');
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
  loadBookmarks(filterTag);
  loadStats();

  // expose functions for testing / external use
  window.loadBookmarks = loadBookmarks;
  window.loadStats = loadStats;
  window.renderBookmarks = renderBookmarks;
})();
