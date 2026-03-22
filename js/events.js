// ══ Event Binding + Init ══

const bindEvents = () => {
  // Top-level Event Delegation
  document.addEventListener('click', (e) => {
    // Home: Category Card Click
    const catCard = e.target.closest('.cat-card');
    if (catCard) {
      openCategory(catCard.dataset.catId);
      return;
    }

    // Category: Theme Card Click
    const themeCard = e.target.closest('.theme-card');
    if (themeCard) {
      openTheme(themeCard.dataset.id);
      return;
    }

    // Related Chip Click
    const relChip = e.target.closest('.rel-chip');
    if (relChip) {
      closeSheet();
      setTimeout(() => showCard(relChip.dataset.id), 200);
      return;
    }

    // Click outside graph search: collapse
    const searchWrap = $('g-search-wrap');
    if (searchWrap && !searchWrap.contains(e.target)) {
      closeGraphSearch();
    }
  });

  // Category page: back button
  if (DOM.btnCatBack) {
    DOM.btnCatBack.addEventListener('click', goBackToHome);
  }

  // Graph page: back button (goes to category page)
  DOM.btnBack.addEventListener('click', goBack);

  // Sheet
  DOM.sheetOverlay.addEventListener('click', closeSheet);
  DOM.phonRow.addEventListener('click', speakWord);

  // Graph search
  const gSearch = $('g-search');
  const gResults = $('g-search-results');
  if (gSearch) {
    gSearch.addEventListener('focus', () => {
      gSearch.classList.add('expanded');
      if (gSearch.value.trim()) renderSearchResults(gSearch.value.trim());
    });
    gSearch.addEventListener('input', () => {
      const q = gSearch.value.trim();
      if (q) renderSearchResults(q);
      else { gResults.innerHTML = ''; gResults.classList.remove('show'); }
    });
    gSearch.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeGraphSearch();
    });
  }

  // Category page search
  if (DOM.catSearchInput) {
    DOM.catSearchInput.addEventListener('input', () => {
      State.catSearchQuery = DOM.catSearchInput.value.trim();
      renderCatGrid();
    });
  }
};

const init = () => {
  initWordMap();
  buildHome();
  bindEvents();

  // Swipe down to close sheet
  let _sy = 0;
  DOM.bsInner.addEventListener('touchstart', e => { _sy = e.touches[0].clientY; }, { passive: true });
  DOM.bsInner.addEventListener('touchmove', e => {
    if (e.touches[0].clientY - _sy > 65) closeSheet();
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (State.fg && State.themeId) State.fg.width(window.innerWidth).height(window.innerHeight);
  });

  // Loader
  setTimeout(() => {
    if (typeof DB !== 'undefined') {
      DOM.loader.classList.add('gone');
    } else {
      DOM.loader.querySelector('.lt').textContent = '数据加载失败，请刷新页面';
      DOM.loader.querySelector('.lr').style.display = 'none';
    }
  }, 600);

  setTimeout(() => {
    if (!DOM.loader.classList.contains('gone')) {
      DOM.loader.querySelector('.lt').textContent = '加载超时，请检查网络后刷新';
      DOM.loader.querySelector('.lr').style.display = 'none';
    }
  }, 6000);
};
