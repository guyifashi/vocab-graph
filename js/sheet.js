// ══ Bottom Sheet / Word Detail Card ══

      // 星辉绽放：从目标元素迸发光脉冲 + 星尘粒子
      const _burstEffect = (anchor, color) => {
        const rect = anchor.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const container = document.createElement('div');
        container.className = 'learned-burst';
        container.style.cssText = `left:0;top:0;width:100vw;height:100vh;position:fixed;`;

        // 光脉冲
        const pulse = document.createElement('div');
        pulse.className = 'learned-pulse';
        pulse.style.cssText = `left:${cx}px;top:${cy}px;box-shadow:0 0 20px ${color}88;border:1.5px solid ${color}66;`;
        container.appendChild(pulse);

        // 星尘粒子
        const count = 8;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
          const dist = 30 + Math.random() * 40;
          const spark = document.createElement('div');
          spark.className = 'learned-spark';
          spark.style.cssText = `left:${cx}px;top:${cy}px;background:${color};box-shadow:0 0 6px ${color};--sx:${Math.cos(angle) * dist}px;--sy:${Math.sin(angle) * dist}px;animation-delay:${Math.random() * 0.1}s;`;
          container.appendChild(spark);
        }

        document.body.appendChild(container);
        setTimeout(() => container.remove(), 1000);
      };

      const goBack = () => {
        DOM.bottomSheet.classList.remove('open');
        DOM.bottomSheet.style.display = 'none';
        DOM.sheetOverlay.classList.remove('on');
        DOM.sheetOverlay.style.display = 'none';

        // Reset topbar state
        showTopbar();
        clearTimeout(_topbarTimer);
        State.wordId = null;
        State.activeNodeId = null;
        State.prevView = null;
        State._showUnlearned = false;
        const unlearnedBtn = $('btn-unlearned');
        if (unlearnedBtn) unlearnedBtn.classList.remove('active');

        // 清理定时器
        if (State.zoomTimer) { clearTimeout(State.zoomTimer); State.zoomTimer = null; }
        if (State._learnTimer) { clearTimeout(State._learnTimer); State._learnTimer = null; }

        // 停止音频
        if (State.audio) { State.audio.pause(); State.audio = null; }

        State._removeUserActListeners?.();
        if (State.fg) { State.fg._destructor?.(); State.fg = null; }
        DOM.fgWrap.innerHTML = '';
        State.userInteracted = false;
        State._interactReadyAt = 0;
        showPage(DOM.pCat);
        State._starfieldActive = true;

        // 刷新二级页进度条（学习记录可能已更新）
        renderCatGrid();

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

        // 清除上一次的学习计时器
        if (State._learnTimer) { clearTimeout(State._learnTimer); State._learnTimer = null; }

        const color = w.themeColor;
        const posColor = getPosColor(w.pos);

        // ── 三级图片降级策略 ──
        // 第一级：手动配图（w.img 有值）
        // 第二级：Unsplash API 在线搜图
        // 第三级：默认 emoji + 渐变背景

        // 捕获当前 wordId，用于异步回调校验（防止快速切换时旧请求覆盖新卡片）
        const _expectedWord = wordId;
        const _isStale = () => State.wordId !== _expectedWord;

        const showDefaultImg = () => {
          if (_isStale()) return;
          DOM.img.src = '';
          DOM.imgZone.style.background = `linear-gradient(135deg, ${color}22 0%, #0a0d1a 100%)`;
          DOM.imgPlaceholder.textContent = w.themeIcon || '✨';
          DOM.imgPlaceholder.style.color = `${posColor}44`;
          DOM.imgPlaceholder.style.textShadow = `0 0 20px ${color}88`;
        };

        const loadImg = (src) => {
          if (_isStale()) return;
          DOM.img.classList.remove('loaded');
          DOM.img.onload = () => {
            if (_isStale()) return;
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
                if (_isStale()) return;
                const hits = data?.hits;
                if (hits && hits.length > 0) {
                  const pick = hits[Math.floor(Math.random() * hits.length)];
                  loadImg(pick.webformatURL);
                } else {
                  // editors_choice无结果，降级去掉限制再搜一次
                  return fetch(
                    `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${query}&image_type=photo&orientation=horizontal&safesearch=true&per_page=5&min_width=800`
                  )
                    .then(r => r.ok ? r.json() : Promise.reject())
                    .then(data2 => {
                      if (_isStale()) return;
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

        // 已学过标签
        const learnedBadge = document.getElementById('bs-learned-badge');
        const alreadyLearned = getLearnedSet().has(wordId);
        if (learnedBadge) {
          if (alreadyLearned) {
            learnedBadge.textContent = '已学过';
            learnedBadge.style.cssText = `display:inline-block;color:${posColor};border-color:${posColor}44;`;
          } else {
            learnedBadge.textContent = '';
            learnedBadge.style.display = 'none';
          }
        }

        // 5 秒后标记为已学习
        if (!alreadyLearned) {
          State._learnTimer = setTimeout(() => {
            if (State.wordId === wordId) {
              markLearned(wordId);
              State._refreshLearnedCache?.();
              if (learnedBadge) {
                learnedBadge.textContent = '已学过';
                learnedBadge.style.cssText = `display:inline-block;color:${posColor};border-color:${posColor}44;opacity:0;`;
                requestAnimationFrame(() => { learnedBadge.style.opacity = '1'; });
                // 星辉绽放特效
                _burstEffect(learnedBadge, posColor);
              }
            }
          }, 3000);
        }
        DOM.phonetic.textContent = w.ph || '';

        // Style the phonetic pill
        DOM.phonRow.style.background = posColor + '15';
        DOM.phonRow.style.border = `1px solid ${posColor}30`;
        DOM.phonRow.style.color = posColor;
        DOM.phonRow.style.setProperty('--wave-color', posColor + '88'); 

        DOM.logicTag.textContent = w.logic || '';
        if (w.logic) {
          DOM.logicTag.style.cssText = `display:inline-block;background:${posColor}11;border:1px solid ${posColor}33;color:${posColor};`;
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
          // 🌟 核心优化：动态注入词性颜色作为左边框（带有一点点透明度 88），并支持换行
          DOM.chips.innerHTML = `<div class="notes-card" style="border-left: 2px solid ${posColor}88; white-space: pre-wrap;">${escapeHTML(notesObj)}</div>`;
        } else {
          relLabel.textContent = '';
          DOM.chips.innerHTML = '';
        }

        // POSITION LOGIC
        
        DOM.bottomSheet.classList.add('open');
        DOM.sheetOverlay.classList.add('on');
      };

      const closeSheet = () => {
        DOM.bottomSheet.classList.remove('open');
        DOM.sheetOverlay.classList.remove('on');
        State.wordId = null;
        State.activeNodeId = null;

        // 清除学习计时器
        if (State._learnTimer) { clearTimeout(State._learnTimer); State._learnTimer = null; }

        // 弹窗关闭后重新开始隐藏倒计时
        scheduleHideTopbar(3000);

        if (State.prevView && State.fg) {
          State.fg.centerAt(State.prevView.x, State.prevView.y, 600);
          State.fg.zoom(State.prevView.zoom, 600);
          State.prevView = null;
        }

        // 检测是否全部通关，触发庆祝动画
        if (typeof triggerSupernovaIfComplete === 'function') {
          triggerSupernovaIfComplete();
        }
      };

      const speakWord = () => {
        if (!State.wordId) return;
        const icon = DOM.speakIcon;
        const phonRow = DOM.phonRow;

        if (State.audio) {
          State.audio.pause();
          State.audio.currentTime = 0;
        }
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
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
          utterance.onend = stopRipple;
          utterance.onerror = stopRipple;
          window.speechSynthesis.speak(utterance);
        };

        State.audio.play().catch(e => {
          State.audio.onerror(); // trigger fallback
        });
      };

