// ══ Category Page: Sub-group List ══

const openCategory = (catId) => {
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return;
  State.currentCatId = catId;
  State.catSearchQuery = '';

  DOM.catTitle.textContent = `${cat.icon} ${cat.name}`;
  DOM.catTitle.style.color = cat.color;

  const themes = getThemesForCategory(cat);
  DOM.catStat.textContent = `${themes.length} 组 · 选择词根进入图谱`;

  if (DOM.catSearchInput) DOM.catSearchInput.value = '';

  renderCatGrid();
  showPage(DOM.pCat);
};

const getCatFilteredThemes = () => {
  const cat = CATEGORIES.find(c => c.id === State.currentCatId);
  if (!cat) return [];
  const themes = getThemesForCategory(cat);
  const q = (State.catSearchQuery || '').toLowerCase();
  if (!q) return themes;
  return themes.filter(([id, t]) => {
    const haystack = `${t.label} ${t.en || ''} ${t.class_id || ''}`.toLowerCase();
    return haystack.includes(q);
  });
};

const renderCatGrid = () => {
  const grid = DOM.catGrid;
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = getCatFilteredThemes();

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="cat-empty">没有匹配的子组</div>';
    return;
  }

  filtered.forEach(([id, t], i) => {
    const card = document.createElement('div');
    card.className = 'tc theme-card';
    if (i === 0 && filtered.length > 2) card.classList.add('featured');
    card.dataset.id = id;
    card.style.animationDelay = (0.05 + i * 0.035) + 's';

    const wordCount = t.nodes ? t.nodes.length : 0;
    const mastered = t.mastered || 0;
    const pct = wordCount > 0 ? Math.round(mastered / wordCount * 100) : 0;

    card.innerHTML = `
      <div class="tc-aurora" style="background:${escapeHTML(t.color)}"></div>
      <span class="tc-icon">${escapeHTML(t.icon)}</span>
      <div class="tc-name" style="color:${escapeHTML(t.color)}">${escapeHTML(t.label)}</div>
      <div class="tc-hint">${escapeHTML(t.en || '')} · ${wordCount} 词</div>
      <div class="tc-footer">
        <div class="tc-progress">
          <div class="tc-progress-fill" style="background:${escapeHTML(t.color)}" data-width="${pct}%"></div>
        </div>
        <div class="tc-bottom">
          <span class="tc-count">${mastered ? mastered + '/' : ''}${wordCount} 词</span>
          <span class="tc-arrow">→</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Animate progress bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      grid.querySelectorAll('.tc-progress-fill').forEach(el => {
        el.style.width = el.dataset.width;
      });
    }, 300);
  });
};

const goBackToHome = () => {
  State.currentCatId = null;
  showPage(DOM.pHome);
};
