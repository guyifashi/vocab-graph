// ══ Graph Search ══
      const renderSearchResults = (q) => {
        const gResults = $('g-search-results');
        if (!gResults) return;
        const lower = q.toLowerCase();

        // 所有词里搜索（id匹配 or 中文含）
        const all = Object.entries(State.wordMap)
          .filter(([id, w]) =>
            id.toLowerCase().includes(lower) ||
            (w.zh || '').includes(q)
          )
          .slice(0, 12);

        if (!all.length) {
          gResults.innerHTML = `<div class="gsr-empty">没有找到「${escapeHTML(q)}」</div>`;
          gResults.classList.add('show');
          return;
        }

        // 分组：当前主题 vs 其他主题
        const inCurrent = all.filter(([, w]) => w.themeId === State.themeId);
        const inOther   = all.filter(([, w]) => w.themeId !== State.themeId);

        let html = '';

        if (inCurrent.length) {
          html += `<div class="gsr-label">当前主题</div>`;
          html += inCurrent.map(([id, w]) => `
            <div class="gsr-item" data-word="${escapeHTML(id)}" data-theme="${escapeHTML(w.themeId)}">
              <div class="gsr-dot" style="background:${escapeHTML(w.themeColor)}"></div>
              <div class="gsr-word">${escapeHTML(id)}</div>
              <div class="gsr-zh">${escapeHTML((w.zh||'').split('；')[0])}</div>
            </div>
          `).join('');
        }

        if (inOther.length) {
          html += `<div class="gsr-label">其他主题</div>`;
          html += inOther.map(([id, w]) => {
            const theme = DB[w.themeId];
            return `
              <div class="gsr-item" data-word="${escapeHTML(id)}" data-theme="${escapeHTML(w.themeId)}">
                <div class="gsr-dot" style="background:${escapeHTML(w.themeColor)}"></div>
                <div class="gsr-word">${escapeHTML(id)}</div>
                <div class="gsr-zh">${escapeHTML((w.zh||'').split('；')[0])}</div>
                <div class="gsr-badge" style="color:${escapeHTML(w.themeColor)};border-color:${escapeHTML(w.themeColor)}44;background:${escapeHTML(w.themeColor)}11">
                  ${escapeHTML(theme?.icon||'')} ${escapeHTML(theme?.label||w.themeId)}
                </div>
              </div>
            `;
          }).join('');
        }

        gResults.innerHTML = html;
        gResults.classList.add('show');

        // 点击某个结果
        gResults.querySelectorAll('.gsr-item').forEach(el => {
          el.addEventListener('click', () => {
            const wordId  = el.dataset.word;
            const themeId = el.dataset.theme;
            closeGraphSearch();

            if (themeId === State.themeId) {
              // 情况A：当前主题内，直接飞过去
              jumpToNode(wordId);
            } else {
              // 情况B：跨主题，切换后再定位
              openTheme(themeId);
              // 等图谱渲染完再定位（等物理引擎稳定）
              setTimeout(() => jumpToNode(wordId), 1800);
            }
          });
        });
      };

      // ── 镜头飞向节点并激活 ──
      const jumpToNode = (wordId) => {
        if (!State.fg) return;
        const node = State.fg.graphData().nodes.find(n => n.id === wordId);
        if (!node) return;

        // 1. 立刻打断其他正在进行的缩放动画
        if (State.zoomTimer) {
          clearTimeout(State.zoomTimer);
          State.zoomTimer = null;
        }

        if (!State.activeNodeId && State.fg) {
          const center = State.fg.centerAt();
          State.prevView = { x: center.x, y: center.y, zoom: State.fg.zoom() };
        }

        State.activeNodeId = wordId;

        // 2. 统一提速：镜头平移 350ms
        State.fg.centerAt(node.x, node.y, 350);
        State.zoomTimer = setTimeout(() => {
          if (!State.fg || State.activeNodeId !== wordId) return;
          const currentZoom = State.fg.zoom() || 1;
          State.fg.zoom(Math.min(currentZoom * 1.35, 2.8), 350); // 缩放 350ms
          
          // 3. 搜索跳转比较特殊：用户主动搜索通常是想直接看详情，所以这里保留自动弹窗，但衔接得更紧凑
          setTimeout(() => showCard(wordId), 350); 
        }, 200);

        State.fg.refresh?.();
      };

      // ── 收起搜索框 ──
      const closeGraphSearch = () => {
        const gSearch  = $('g-search');
        const gResults = $('g-search-results');
        if (gSearch)  { gSearch.value = ''; gSearch.classList.remove('expanded'); gSearch.blur(); }
        if (gResults) { gResults.innerHTML = ''; gResults.classList.remove('show'); }
      };

