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

    // Click on canvas while sheet is open: close sheet
    // Uses State._nodeClickedThisFrame flag set by onNodeClick
    if (e.target.tagName === 'CANVAS' && DOM.bottomSheet.classList.contains('open')) {
      requestAnimationFrame(() => {
        if (!State._nodeClickedThisFrame) {
          closeSheet();
        }
        State._nodeClickedThisFrame = false;
      });
    }
  });

  // Category page: back button
  if (DOM.btnCatBack) {
    DOM.btnCatBack.addEventListener('click', goBackToHome);
  }

  // Graph page: back button (goes to category page)
  DOM.btnBack.addEventListener('click', goBack);

  // Reset learning progress
  const btnReset = $('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('确定要重置当前主题的学习进度吗？此操作不可撤销。')) {
        const theme = DB[State.themeId];
        if (theme) {
          const learned = getLearnedSet();
          theme.nodes.forEach(n => learned.delete(n.id));
          try { localStorage.setItem(LEARNED_KEY, JSON.stringify([...learned])); } catch {}
          State._refreshLearnedCache?.();
        }
      }
    });
  }

  // Toggle unlearned highlight
  const btnUnlearned = $('btn-unlearned');
  if (btnUnlearned) {
    btnUnlearned.addEventListener('click', () => {
      State._showUnlearned = !State._showUnlearned;
      btnUnlearned.classList.toggle('active', State._showUnlearned);
    });
  }

  // Ghost back button (visible when topbar is hidden)
  const ghostBackBtn = $('ghost-back');
  if (ghostBackBtn) {
    ghostBackBtn.addEventListener('click', () => {
      showTopbar();
      goBack();
    });
  }

  // Reveal topbar when touching near screen top (top 60px zone)
  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (touch && touch.clientY < 60 && DOM.pGraph && !DOM.pGraph.classList.contains('off')) {
      showTopbar();
      scheduleHideTopbar(4000);
    }
  }, { passive: true });

  // Reveal topbar on mouse move near top (desktop)
  document.addEventListener('mousemove', (e) => {
    if (e.clientY < 50 && DOM.pGraph && !DOM.pGraph.classList.contains('off')) {
      showTopbar();
      scheduleHideTopbar(4000);
    }
  });

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
    if (e.touches[0].clientY - _sy > 65) {
      if (DOM.bottomSheet.classList.contains('open')) {
        closeSheet();
      }
    }
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
