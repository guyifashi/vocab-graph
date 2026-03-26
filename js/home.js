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

  // ── Continue Learning Shortcut ──
  try {
    const lastThemeId = localStorage.getItem('wordnet_last_theme');
    if (lastThemeId && DB[lastThemeId]) {
      const theme = DB[lastThemeId];
      const wordCount = theme.nodes ? theme.nodes.length : 0;
      const learnedCount = getLearnedCountForTheme(lastThemeId);
      const pct = wordCount > 0 ? Math.round((learnedCount / wordCount) * 100) : 0;
      
      const shortcut = document.createElement('div');
      shortcut.className = 'continue-card';
      shortcut.dataset.themeId = lastThemeId;
      shortcut.style.animationDelay = '0.05s';
      shortcut.innerHTML = `
        <div class="cc-bg" style="background:${theme.color}18"></div>
        <div class="cc-left">
          <div class="cc-icon" style="color:${theme.color}; text-shadow:0 0 12px ${theme.color}44">${theme.icon || '🚀'}</div>
          <div class="cc-info">
            <div class="cc-label">继续学习: <span style="color:${theme.color}">${escapeHTML(theme.label)}</span></div>
            <div class="cc-stat">${learnedCount}/${wordCount} 词已掌握</div>
          </div>
        </div>
        <div class="cc-right">
          <div class="cc-percent" style="color:${theme.color}">${pct}%</div>
          <div class="hc-arrow" style="color:${theme.color}">→</div>
        </div>
      `;
      grid.appendChild(shortcut);
    }
  } catch (e) {}

  CATEGORIES.forEach((cat, i) => {
    const themes = getThemesForCategory(cat);
    const groupCount = themes.length;
    const wordCount = themes.reduce((sum, [, t]) => sum + (t.nodes ? t.nodes.length : 0), 0);
    const learnedCount = getLearnedCountForCategory(cat);
    const pct = wordCount > 0 ? Math.round(learnedCount / wordCount * 100) : 0;

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
        <div class="hc-progress">
          <div class="hc-progress-fill" style="background:${cat.color}" data-width="${pct}%"></div>
        </div>
        <div class="hc-bottom">
          <span class="hc-stat">${learnedCount}/${wordCount} 词 · ${groupCount} 组</span>
          <span class="hc-arrow">→</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Animate progress bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      DOM.homeGrid.querySelectorAll('.hc-progress-fill').forEach(el => {
        el.style.width = el.dataset.width;
      });
    }, 300);
  });
};
