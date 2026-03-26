// ══ Event Binding + Init ══

const bindEvents = () => {
  // Top-level Event Delegation
  document.addEventListener('click', (e) => {
    // Home: Continue Card Click
    const continueCard = e.target.closest('.continue-card');
    if (continueCard) {
      const themeId = continueCard.dataset.themeId;
      const theme = DB[themeId];
      if (theme) {
        const cat = CATEGORIES.find(c => c.name === theme.class_id);
        if (cat) State.currentCatId = cat.id; // required for 'back' to work correctly
        openTheme(themeId);
      }
      return;
    }
    
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

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // 1. ESC Key Dismiss / Back
    if (e.key === 'Escape') {
      // 1.1 Close search if focused
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
        if (typeof closeGraphSearch === 'function') closeGraphSearch();
        return;
      }

      // 1.2 Close bottom sheet 
      if (DOM.bottomSheet && DOM.bottomSheet.classList.contains('open')) {
        if (typeof closeSheet === 'function') closeSheet();
        return;
      }

      // 1.3 Graph -> Category (if graph is active)
      if (DOM.pGraph && !DOM.pGraph.classList.contains('off-left') && !DOM.pGraph.classList.contains('off-right')) {
        if (typeof goBack === 'function') goBack();
        return;
      }

      // 1.4 Category -> Home (if category is active)
      if (DOM.pCat && !DOM.pCat.classList.contains('off-left') && !DOM.pCat.classList.contains('off-right')) {
        if (typeof goBackToHome === 'function') goBackToHome();
        return;
      }

      // 1.5 Profile -> Home
      if (DOM.pProfile && !DOM.pProfile.classList.contains('off-left') && !DOM.pProfile.classList.contains('off-right')) {
        if (typeof closeProfile === 'function') closeProfile();
        return;
      }
    }

    // 2. A-Z Quick Jump on Graph Page
    if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const isGraphActive = DOM.pGraph && !DOM.pGraph.classList.contains('off-left') && !DOM.pGraph.classList.contains('off-right');
      const isSheetClosed = DOM.bottomSheet && !DOM.bottomSheet.classList.contains('open');
      const noInputFocused = document.activeElement.tagName !== 'INPUT';

      if (isGraphActive && isSheetClosed && noInputFocused && State.themeId && DB[State.themeId]) {
        const letter = e.key.toLowerCase();
        // Skip roots, only match standard words starting with the letter
        const matches = DB[State.themeId].nodes.filter(n => n.id.toLowerCase().startsWith(letter) && n.type !== 'root');
        
        if (matches.length > 0) {
          State._jumpIndex = State._jumpIndex || {};
          let idx = State._jumpIndex[letter] || 0;
          if (idx >= matches.length) idx = 0;
          
          const targetId = matches[idx].id;
          State._jumpIndex[letter] = idx + 1; // ready for next press

          // Find node in graph memory to trigger camera & card
          if (State.fg) {
            const nData = State.fg.graphData().nodes.find(n => n.id === targetId);
            if (nData && nData.x !== undefined) {
              if (State.zoomTimer) clearTimeout(State.zoomTimer);
              
              if (!State.activeNodeId) {
                const center = State.fg.centerAt();
                State.prevView = { x: center.x, y: center.y, zoom: State.fg.zoom() };
              }

              State.activeNodeId = targetId;
              State.fg.centerAt(nData.x, nData.y, 350);
              
              const currentZoom = State.fg.zoom() || 1;
              State.fg.zoom(Math.min(currentZoom * 1.35, 2.8), 350);
              
              if (typeof showCard === 'function') showCard(targetId);
              State.fg.refresh?.();
            }
          }
        }
      }
    }
  });

  // Profile page: avatar button on home
  if (DOM.btnAvatar) {
    DOM.btnAvatar.addEventListener('click', openProfile);
  }

  // Profile page: back button
  if (DOM.btnProfileBack) {
    DOM.btnProfileBack.addEventListener('click', closeProfile);
  }

  // Profile page: avatar picker
  const avatarWrap = $('profile-avatar-wrap');
  if (avatarWrap) {
    avatarWrap.addEventListener('click', () => {
      const picker = $('profile-avatar-picker');
      if (picker) {
        initAvatarPicker();
        picker.classList.remove('pf-picker-hidden');
      }
    });
  }

  // Profile page: action buttons
  const btnExport = $('pf-btn-export');
  if (btnExport) btnExport.addEventListener('click', exportData);

  // Reset panel: toggle open/close
  const btnResetOpen = $('pf-btn-reset');
  if (btnResetOpen) btnResetOpen.addEventListener('click', openResetPanel);
  const btnResetAll = $('pf-reset-all');
  if (btnResetAll) btnResetAll.addEventListener('click', resetAllProgress);

  // Category page: back button
  if (DOM.btnCatBack) {
    DOM.btnCatBack.addEventListener('click', goBackToHome);
  }

  // Graph page: back button (goes to category page)
  DOM.btnBack.addEventListener('click', goBack);

  // Refresh current graph (re-render)
  const btnReset = $('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (State.themeId && DB[State.themeId]) {
        openTheme(State.themeId);
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
    if (touch && touch.clientY < 60 && DOM.pGraph && !DOM.pGraph.classList.contains('off-left') && !DOM.pGraph.classList.contains('off-right')) {
      showTopbar();
      scheduleHideTopbar(4000);
    }
  }, { passive: true });

  // Reveal topbar on mouse move near top (desktop)
  document.addEventListener('mousemove', (e) => {
    if (e.clientY < 50 && DOM.pGraph && !DOM.pGraph.classList.contains('off-left') && !DOM.pGraph.classList.contains('off-right')) {
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
  showPage(DOM.pHome);
  bindEvents();

  // Profile: sync avatar to home button & init name editing
  if (DOM.btnAvatar) DOM.btnAvatar.textContent = getProfileAvatar();
  if (typeof initNameEdit === 'function') initNameEdit();

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
