// ══ Home Page: 8 Category Cards ══

const getThemesForCategory = (cat) => {
  if (typeof DB === 'undefined') return [];
  return Object.entries(DB).filter(([id, t]) => {
    return t.class_id === cat.name;
  });
};

const buildHome = () => {
  if (typeof DB === 'undefined') return;
  const grid = DOM.homeGrid;
  if (!grid) return;

  let totalGroups = 0;
  let totalWords = 0;
  Object.values(DB).forEach(t => { totalWords += t.nodes ? t.nodes.length : 0; });
  totalGroups = Object.keys(DB).length;

  const sGroups = $('s-groups'); if (sGroups) sGroups.textContent = totalGroups;
  const sWords = $('s-words'); if (sWords) sWords.textContent = totalWords;

  grid.innerHTML = '';

  CATEGORIES.forEach((cat, i) => {
    const themes = getThemesForCategory(cat);
    const groupCount = themes.length;
    const wordCount = themes.reduce((sum, [, t]) => sum + (t.nodes ? t.nodes.length : 0), 0);

    const card = document.createElement('div');
    card.className = 'hc cat-card';
    card.dataset.catId = cat.id;
    card.style.animationDelay = (0.15 + i * 0.06) + 's';

    card.innerHTML = `
      <div class="hc-aurora" style="background:${cat.color}"></div>
      <div class="hc-icon">${cat.icon}</div>
      <div class="hc-name" style="color:${cat.color}">${escapeHTML(cat.name)}</div>
      <div class="hc-desc">${escapeHTML(cat.desc)}</div>
      <div class="hc-footer">
        <span class="hc-stat">${groupCount} 组 · ${wordCount} 词</span>
        <span class="hc-arrow">→</span>
      </div>
    `;

    grid.appendChild(card);
  });
};
