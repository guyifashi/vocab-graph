// ══ Bottom Sheet / Word Detail Card ══
      const goBack = () => {
        // 🌟 修复：立刻强制隐藏弹窗和遮罩，不等动画结束
        // closeSheet() 只是移除 class 触发过渡动画，但 bottom-sheet 是 fixed 定位
        // 不在 #p-graph 内部，.off 的 opacity:0 管不到它，返回第一页时会闪一下
        DOM.bottomSheet.classList.remove('open');
        DOM.bottomSheet.style.display = 'none';
        DOM.sheetOverlay.classList.remove('on');
        DOM.sheetOverlay.style.display = 'none';
        DOM.gHint.style.opacity = '1';
        State.wordId = null;
        State.activeNodeId = null;
        State.prevView = null;

        // 清理定时器
        if (State.zoomTimer) { clearTimeout(State.zoomTimer); State.zoomTimer = null; }

        // 停止音频
        if (State.audio) { State.audio.pause(); State.audio = null; }

        State._removeUserActListeners?.();
        if (State.fg) { State.fg._destructor?.(); State.fg = null; }
        DOM.fgWrap.innerHTML = '';
        State.userInteracted = false;
        State._interactReadyAt = 0;
        showPage(DOM.pCat);
        State._starfieldActive = true;

        // 下次打开弹窗时恢复 display
        setTimeout(() => {
          DOM.bottomSheet.style.display = '';
          DOM.sheetOverlay.style.display = '';
        }, 400);
      };

      const showCard = (wordId) => {
        const w = State.wordMap[wordId];
        if (!w) return;
        State.wordId = wordId;
        const color = w.themeColor;
        const posColor = getPosColor(w.pos);

        // ── 三级图片降级策略 ──
        // 第一级：手动配图（w.img 有值）
        // 第二级：Unsplash API 在线搜图
        // 第三级：默认 emoji + 渐变背景

        const showDefaultImg = () => {
          DOM.img.src = '';
          DOM.imgZone.style.background = `linear-gradient(135deg, ${color}22 0%, #0a0d1a 100%)`;
          DOM.imgPlaceholder.textContent = w.themeIcon || '✨';
          DOM.imgPlaceholder.style.color = `${posColor}44`;
          DOM.imgPlaceholder.style.textShadow = `0 0 20px ${color}88`;
        };

        const loadImg = (src) => {
          DOM.img.classList.remove('loaded');
          DOM.img.onload = () => {
            DOM.imgZone.style.background = '#0a0d1a';
            DOM.imgPlaceholder.textContent = '';
            DOM.img.classList.add('loaded');
          };
          DOM.img.onerror = () => showDefaultImg();
          DOM.img.src = src;
        };

        // 重置状态
        DOM.img.classList.remove('loaded');
        DOM.imgPlaceholder.textContent = w.themeIcon || '✨'; // 先显示占位，避免白屏
        DOM.imgPlaceholder.style.color = `${posColor}44`;
        DOM.imgPlaceholder.style.textShadow = `0 0 20px ${posColor}88`;
        DOM.imgZone.style.background = `linear-gradient(135deg, ${posColor}22 0%, #0a0d1a 100%)`;

        if (w.img && w.img.trim() !== '') {
          // 第一级：手动配图
          loadImg(w.img);
        } else {
          // 第二级：Pixabay API
          const zhKeyword = (w.zh || '').split('；')[0].trim();
          const query = encodeURIComponent(`${wordId} ${zhKeyword}`);
          const PIXABAY_KEY = '41128213-ce4087b124818e3e434c35698';

          if (PIXABAY_KEY !== 'YOUR_PIXABAY_KEY') {
            // 第一次请求：editors_choice精选，质量高
            fetch(
              `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${query}&image_type=photo&orientation=horizontal&safesearch=true&per_page=5&min_width=800&editors_choice=true`
            )
              .then(r => r.ok ? r.json() : Promise.reject())
              .then(data => {
                const hits = data?.hits;
                if (hits && hits.length > 0) {
                  // 随机取一张，避免每次都是同一图
                  const pick = hits[Math.floor(Math.random() * hits.length)];
                  loadImg(pick.webformatURL);
                } else {
                  // editors_choice无结果，降级去掉限制再搜一次
                  return fetch(
                    `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${query}&image_type=photo&orientation=horizontal&safesearch=true&per_page=5&min_width=800`
                  )
                    .then(r => r.ok ? r.json() : Promise.reject())
                    .then(data2 => {
                      const url = data2?.hits?.[0]?.webformatURL;
                      if (url) loadImg(url);
                      else showDefaultImg();
                    });
                }
              })
              .catch(() => showDefaultImg());
          } else {
            // 没有 Key：直接降到第三级，不发无效请求
            showDefaultImg();
          }
        }

        DOM.bsInner.style.boxShadow = `0 -10px 40px rgba(0,0,0,0.6), 0 0 80px ${posColor}1a`;
        DOM.wordBig.textContent = wordId;
        DOM.posTag.textContent = w.pos ? w.pos.toUpperCase() : '';
        DOM.posTag.style.color = posColor;
        DOM.phonetic.textContent = w.ph || '';

        // Style the phonetic pill
        DOM.phonRow.style.background = posColor + '15';
        DOM.phonRow.style.border = `1px solid ${posColor}30`;
        DOM.phonRow.style.color = posColor;
        DOM.phonRow.style.setProperty('--wave-color', posColor + '88'); 

        DOM.logicTag.textContent = w.logic || '';
        if (w.logic) {
          DOM.logicTag.style.display = 'inline-block';
          DOM.logicTag.style.cssText = `background:${posColor}11;border:1px solid ${posColor}33;color:${posColor};`;
        } else {
          DOM.logicTag.style.display = 'none';
        }

        DOM.meaning.textContent = w.zh || '';
        const meaningRow = document.getElementById('bs-meaning-row');
        if (meaningRow) meaningRow.style.borderLeftColor = posColor;

        // Replace related chips with stylized 'notes' text
        const notesObj = w.notes;
        const relLabel = document.getElementById('bs-rel-label');
        if (notesObj && notesObj.trim() !== '') {
          relLabel.textContent = '详细笔记';
          // 🌟 核心优化：动态注入词性颜色作为左边框（带有一点点透明度 88）
          DOM.chips.innerHTML = `<div class="notes-card" style="border-left: 2px solid ${posColor}88;">${escapeHTML(notesObj)}</div>`;
        } else {
          relLabel.textContent = '';
          DOM.chips.innerHTML = '';
        }

        // POSITION LOGIC
        
        DOM.bottomSheet.classList.add('open');
        DOM.sheetOverlay.classList.add('on');
        DOM.gHint.style.opacity = '0';
      };

      const closeSheet = () => {
        DOM.bottomSheet.classList.remove('open');
        DOM.sheetOverlay.classList.remove('on');
        DOM.gHint.style.opacity = '1';
        State.wordId = null;
        State.activeNodeId = null;

        if (State.prevView && State.fg) {
          State.fg.centerAt(State.prevView.x, State.prevView.y, 600);
          State.fg.zoom(State.prevView.zoom, 600);
          State.prevView = null;
        }

        State.fg?.refresh?.();
      };

      const speakWord = () => {
        if (!State.wordId) return;
        const icon = DOM.speakIcon;
        const phonRow = DOM.phonRow;

        if (State.audio) {
          State.audio.pause();
          State.audio.currentTime = 0;
        }

        icon.textContent = '🔈';
        icon.style.transform = 'scale(0.9)';
        phonRow.classList.add('playing-audio'); 

        // Default Youdao API
        const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(State.wordId)}&type=1`;
        State.audio = new Audio(audioUrl);

        // 封装一个停止播放的恢复逻辑
        const stopRipple = () => {
          icon.textContent = '♪';
          icon.style.transform = 'scale(1)';
          phonRow.classList.remove('playing-audio'); // 停止声波特效
        };

        State.audio.onended = stopRipple;

        State.audio.onerror = () => {
          // Fallback to Web Speech API
          const utterance = new SpeechSynthesisUtterance(State.wordId);
          utterance.lang = 'en-US';
          utterance.onend = () => {
            icon.textContent = '♪';
            icon.style.transform = 'scale(1)';
          };
          utterance.onerror = () => {
            icon.textContent = '♪';
            icon.style.transform = 'scale(1)';
          };
          window.speechSynthesis.speak(utterance);
        };

        State.audio.play().catch(e => {
          State.audio.onerror(); // trigger fallback
        });
      };

