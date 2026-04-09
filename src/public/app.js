// Frontend script for LinkVault UI
(() => {
  // State variables for import/export and edit functionality
  let editMode = false;
  let editId = null;
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
      // Favicon using Google's service based on hostname
      let faviconUrl = '';
      try { const u = new URL(b.url); faviconUrl = `https://www.google.com/s2/favicons?domain=${u.hostname}`; } catch (_) {}
      const createdAt = b.createdAt ? new Date(b.createdAt).toLocaleString() : '';
      return `
        <div class="bookmark-item" data-id="${b.id}">
          ${faviconUrl ? `<img src="${faviconUrl}" alt="Favicon" class="favicon">` : ''}
          <a href="${b.url}" target="_blank" rel="noopener" class="bookmark-title">${b.title}</a>
          ${createdAt ? `<span class="date">${createdAt}</span>` : ''}
          ${b.description ? `<p>${b.description}</p>` : ''}
          <div>${tagsHtml}</div>
          <button class="edit-btn" title="Edit">✎</button>
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
    // Edit handlers
    bookmarkListEl.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.bookmark-item');
        editId = item.dataset.id;
        const bm = currentBookmarks.find(b => b.id === editId);
        if (!bm) return;
        // Populate form fields
        document.getElementById('title').value = bm.title;
        document.getElementById('url').value = bm.url;
        document.getElementById('description').value = bm.description || '';
        document.getElementById('tags').value = (bm.tags || []).join(', ');
        editMode = true;
        addModal.classList.remove('hidden');
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

  // Form submit handler for adding or editing bookmark
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const urlVal = document.getElementById('url').value.trim();
    const description = document.getElementById('description').value.trim();
    const tagsRaw = document.getElementById('tags').value;
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const payload = { title, url: urlVal, description, tags };
    try {
      let res;
      if (editMode && editId) {
        // Update existing bookmark
        res = await fetch(`/bookmarks/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new bookmark
        res = await fetch('/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error('Failed to save bookmark');
      // Reset form and exit edit mode
      form.reset();
      editMode = false;
      editId = null;
      addModal.classList.add('hidden');
      filterTag = null;
      await loadBookmarks();
      await loadStats();
    } catch (err) {
      console.error(err);
    }
  });
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

  // Export button handler
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/export', { headers: authHeader() });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bookmarks.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) { console.error(e); }
    });
  }

  // Import button handler
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file');
  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch('/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Import failed');
        // Reset file input
        importFileInput.value = '';
        await loadBookmarks();
        await loadStats();
      } catch (err) { console.error(err); }
    });
  }

  // Initial load
  loadBookmarks();
  loadStats();
})();
