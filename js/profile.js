// ══ Profile Page ══
"use strict";

const PROFILE_KEYS = {
  name: 'wordnet_profile_name',
  avatar: 'wordnet_profile_avatar',
  dailyLog: 'wordnet_daily_log',
};

const AVATAR_OPTIONS = [
  '🚀', '🌌', '🪐', '⭐',
  '🔭', '🧑‍🚀', '🌙', '☄️',
  '🛸', '🌠', '🧬', '💎',
  '🦊', '🐳', '🦉', '🌸',
];

// ── localStorage helpers ──
const getProfileName = () => {
  try { return localStorage.getItem(PROFILE_KEYS.name) || 'Explorer'; } catch { return 'Explorer'; }
};
const setProfileName = (name) => {
  try { localStorage.setItem(PROFILE_KEYS.name, name); } catch {}
};
const getProfileAvatar = () => {
  try { return localStorage.getItem(PROFILE_KEYS.avatar) || '🚀'; } catch { return '🚀'; }
};
const setProfileAvatar = (emoji) => {
  try { localStorage.setItem(PROFILE_KEYS.avatar, emoji); } catch {}
};
const getDailyLog = () => {
  try {
    const raw = localStorage.getItem(PROFILE_KEYS.dailyLog);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const logDailyProgress = () => {
  const log = getDailyLog();
  const today = new Date().toISOString().slice(0, 10);
  log[today] = (log[today] || 0) + 1;
  try { localStorage.setItem(PROFILE_KEYS.dailyLog, JSON.stringify(log)); } catch {}
};

// ── Streak calculation ──
const getStreak = () => {
  const log = getDailyLog();
  let streak = 0;
  const d = new Date();
  // Check if today has activity; if not, start from yesterday
  const todayKey = d.toISOString().slice(0, 10);
  if (!log[todayKey]) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (log[key] && log[key] > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

// ── Build profile page ──
const buildProfile = () => {
  const learned = getLearnedSet();
  const learnedCount = learned.size;
  let totalWords = 0;
  Object.values(DB).forEach(t => { totalWords += t.nodes ? t.nodes.length : 0; });

  const percent = totalWords > 0 ? Math.round(learnedCount / totalWords * 100) : 0;
  const streak = getStreak();

  // Update avatar & name
  const avatar = getProfileAvatar();
  const name = getProfileName();
  const avatarEl = $('profile-avatar');
  const nameEl = $('profile-name');
  if (avatarEl) avatarEl.textContent = avatar;
  if (nameEl) nameEl.textContent = name;

  // Sync home avatar button
  if (DOM.btnAvatar) DOM.btnAvatar.textContent = avatar;

  // Stats
  const elLearned = $('pf-learned');
  const elTotal = $('pf-total');
  const elPercent = $('pf-percent');
  const elStreak = $('pf-streak');
  if (elLearned) elLearned.textContent = learnedCount;
  if (elTotal) elTotal.textContent = totalWords;
  if (elPercent) elPercent.textContent = percent + '%';
  if (elStreak) elStreak.textContent = streak;

  // Week streak dots
  buildWeekStreak();

  // Category grid
  buildCategoryGrid();
};

// ── Week streak visualization ──
const buildWeekStreak = () => {
  const container = $('pf-week');
  if (!container) return;
  container.innerHTML = '';
  const log = getDailyLog();
  const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sunday

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOfWeek + i);
    const key = d.toISOString().slice(0, 10);
    const count = log[key] || 0;
    const isToday = i === dayOfWeek;

    const day = document.createElement('div');
    day.className = 'pf-day';
    day.innerHTML = `
      <div class="pf-day-dot ${count > 0 ? 'active' : ''}" ${isToday ? 'style="border-color:rgba(198,168,75,0.3)"' : ''}>
        ${count > 0 ? count : ''}
      </div>
      <div class="pf-day-label">${dayLabels[i]}</div>
    `;
    container.appendChild(day);
  }
};

// ── Category progress cards (点击可跳转到对应分类页) ──
const buildCategoryGrid = () => {
  const grid = $('profile-grid');
  if (!grid) return;
  grid.innerHTML = '';

  CATEGORIES.forEach((cat, i) => {
    const total = getTotalWordsForCategory(cat);
    const learned = getLearnedCountForCategory(cat);
    const pct = total > 0 ? Math.round(learned / total * 100) : 0;

    const card = document.createElement('div');
    card.className = 'pf-cat-card';
    card.dataset.catId = cat.id;
    card.style.animationDelay = `${0.4 + i * 0.06}s`;
    card.innerHTML = `
      <div class="pf-cat-aurora" style="background:${cat.color}"></div>
      <div class="pf-cat-icon">${cat.icon}</div>
      <div class="pf-cat-name" style="color:${cat.color}">${cat.name}</div>
      <div class="pf-cat-progress">
        <div class="pf-cat-progress-fill" style="background:${cat.color}"></div>
      </div>
      <div class="pf-cat-stat">${learned} / ${total} · ${pct}%</div>
    `;
    // 点击跳转到分类页
    card.addEventListener('click', () => {
      if (typeof openCategory === 'function') {
        openCategory(cat.id);
      }
    });
    grid.appendChild(card);
  });

  // Animate progress bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      grid.querySelectorAll('.pf-cat-progress-fill').forEach((bar, i) => {
        const cat = CATEGORIES[i];
        const total = getTotalWordsForCategory(cat);
        const learned = getLearnedCountForCategory(cat);
        bar.style.width = total > 0 ? (learned / total * 100) + '%' : '0%';
      });
    }, 100);
  });
};

// ── Navigation ──
const openProfile = () => {
  buildProfile();
  showPage(DOM.pProfile);
};

const closeProfile = () => {
  showPage(DOM.pHome);
  buildHome();
};

// ── Avatar picker ──
const initAvatarPicker = () => {
  const picker = $('profile-avatar-picker');
  const pickerGrid = $('pf-picker-grid');
  if (!picker || !pickerGrid) return;

  // Build emoji grid
  pickerGrid.innerHTML = '';
  const currentAvatar = getProfileAvatar();
  AVATAR_OPTIONS.forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'pf-picker-item' + (emoji === currentAvatar ? ' selected' : '');
    item.textContent = emoji;
    item.addEventListener('click', () => {
      setProfileAvatar(emoji);
      // Update all avatar displays
      const avatarEl = $('profile-avatar');
      if (avatarEl) avatarEl.textContent = emoji;
      if (DOM.btnAvatar) DOM.btnAvatar.textContent = emoji;
      // Update selection
      pickerGrid.querySelectorAll('.pf-picker-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      // Close picker after short delay
      setTimeout(() => picker.classList.add('pf-picker-hidden'), 200);
    });
    pickerGrid.appendChild(item);
  });

  // Close on background click
  picker.addEventListener('click', (e) => {
    if (e.target === picker) picker.classList.add('pf-picker-hidden');
  });
};

// ── Name editing ──
const initNameEdit = () => {
  const nameEl = $('profile-name');
  if (!nameEl) return;

  nameEl.addEventListener('click', () => {
    const current = nameEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.maxLength = 20;
    input.style.cssText = `
      font-family: var(--serif); font-size: 22px; font-weight: 600;
      color: var(--text-primary); background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
      padding: 4px 12px; text-align: center; outline: none;
      width: 200px;
    `;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const save = () => {
      const newName = input.value.trim() || 'Explorer';
      setProfileName(newName);
      const newEl = document.createElement('div');
      newEl.id = 'profile-name';
      newEl.textContent = newName;
      input.replaceWith(newEl);
      // Re-bind click
      initNameEdit();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
  });
};

// ── Export data ──
const exportData = () => {
  const data = {
    learned: JSON.parse(localStorage.getItem('wordnet_learned') || '[]'),
    dailyLog: getDailyLog(),
    profileName: getProfileName(),
    profileAvatar: getProfileAvatar(),
    exportDate: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wordnet-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Reset Panel ──
const openResetPanel = () => {
  const panel = $('pf-reset-panel');
  if (!panel) return;

  // 构建分类列表
  const catsContainer = $('pf-reset-cats');
  if (catsContainer) {
    catsContainer.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const themes = getThemesForCategory(cat);
      const learned = getLearnedCountForCategory(cat);

      const catDiv = document.createElement('div');
      catDiv.className = 'pf-reset-cat';

      // 分类头（点击展开子主题）
      const header = document.createElement('button');
      header.className = 'pf-reset-cat-header';
      header.innerHTML = `
        <span class="pf-reset-icon">${cat.icon}</span>
        <span class="pf-reset-text">${cat.name}</span>
        <span class="pf-reset-count">${learned} 词</span>
        <span class="pf-reset-chevron">▸</span>
      `;
      header.addEventListener('click', () => {
        catDiv.classList.toggle('expanded');
      });
      catDiv.appendChild(header);

      // 子主题列表
      const themesDiv = document.createElement('div');
      themesDiv.className = 'pf-reset-themes';

      // 整个分类重置行
      const resetCatRow = document.createElement('div');
      resetCatRow.className = 'pf-reset-theme-row pf-danger-row';
      resetCatRow.style.color = '#f06060';
      resetCatRow.innerHTML = `
        <span class="pf-reset-theme-icon">🗑</span>
        <span class="pf-reset-theme-name">重置整个「${cat.name}」</span>
      `;
      resetCatRow.addEventListener('click', () => {
        if (!confirm(`确定要重置「${cat.name}」的所有学习进度吗？`)) return;
        resetCategory(cat);
        closeResetPanel();
        buildProfile();
      });
      themesDiv.appendChild(resetCatRow);

      // 每个子主题
      themes.forEach(([tid, theme]) => {
        const themeCount = getLearnedCountForTheme(tid);
        const totalCount = theme.nodes ? theme.nodes.length : 0;
        const row = document.createElement('div');
        row.className = 'pf-reset-theme-row';
        if (themeCount === 0) row.style.opacity = '0.35';
        row.innerHTML = `
          <span class="pf-reset-theme-icon">${theme.icon || '📖'}</span>
          <span class="pf-reset-theme-name">${theme.label}</span>
          <span class="pf-reset-count">${themeCount}/${totalCount}</span>
        `;
        if (themeCount > 0) {
          row.addEventListener('click', () => {
            if (!confirm(`确定要重置「${theme.label}」的学习进度吗？`)) return;
            resetTheme(tid);
            closeResetPanel();
            buildProfile();
          });
        }
        themesDiv.appendChild(row);
      });

      catDiv.appendChild(themesDiv);
      catsContainer.appendChild(catDiv);
    });
  }

  panel.classList.toggle('pf-reset-open');
  // 展开时滚动到可见
  if (panel.classList.contains('pf-reset-open')) {
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
};

const closeResetPanel = () => {
  const panel = $('pf-reset-panel');
  if (panel) panel.classList.remove('pf-reset-open');
};

// 重置所有进度
const resetAllProgress = () => {
  if (!confirm('确定要重置所有学习进度吗？此操作不可撤销。')) return;
  try {
    localStorage.removeItem('wordnet_learned');
    localStorage.removeItem(PROFILE_KEYS.dailyLog);
  } catch {}
  closeResetPanel();
  buildProfile();
};

// 重置单个分类
const resetCategory = (cat) => {
  const themes = getThemesForCategory(cat);
  const learned = getLearnedSet();
  themes.forEach(([, theme]) => {
    theme.nodes.forEach(n => learned.delete(n.id));
  });
  try { localStorage.setItem(LEARNED_KEY, JSON.stringify([...learned])); } catch {}
};

// 重置单个主题
const resetTheme = (themeId) => {
  const theme = DB[themeId];
  if (!theme) return;
  const learned = getLearnedSet();
  theme.nodes.forEach(n => learned.delete(n.id));
  try { localStorage.setItem(LEARNED_KEY, JSON.stringify([...learned])); } catch {}
};
