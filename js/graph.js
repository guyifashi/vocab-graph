// ══ Force Graph Renderer ══

      // ── Topbar auto-hide system ──
      const topbar = $('topbar');
      const ghostBack = $('ghost-back');
      let _topbarTimer = null;

      const showTopbar = () => {
        if (topbar) topbar.classList.remove('hidden');
        if (ghostBack) ghostBack.classList.remove('visible');
        clearTimeout(_topbarTimer);
      };

      const hideTopbar = () => {
        if (topbar) topbar.classList.add('hidden');
        if (ghostBack) ghostBack.classList.add('visible');
        if (DOM.gHint) DOM.gHint.style.opacity = '0';
        // 关闭未学高亮模式
        State._showUnlearned = false;
        const ub = $('btn-unlearned');
        if (ub) ub.classList.remove('active');
      };

      const scheduleHideTopbar = (delay = 2000) => {
        clearTimeout(_topbarTimer);
        _topbarTimer = setTimeout(hideTopbar, delay);
      };

      const openTheme = (themeId) => {
        const theme = DB[themeId];
        if (!theme) return;
        State.themeId = themeId;
        try { localStorage.setItem('wordnet_last_theme', themeId); } catch {}

        // 每次打开词书时，重置核爆状态
        State._hasCelebrated = false;
        State._supernovaStart = null;

        DOM.tbarName.textContent = `${theme.icon} ${theme.label}`;
        DOM.tbarName.style.color = theme.color;
        DOM.tbarStat.textContent = `${theme.nodes.length} 词 · 触摸节点查看`;

        showTopbar();
        showPage(DOM.pGraph);
        State._starfieldActive = false;

        setTimeout(() => renderGraph(theme), 80);
      };

      // 负责检测通关并引爆超新星的全局函数
      window.triggerSupernovaIfComplete = () => {
        if (!State.themeId || typeof DB === 'undefined' || !DB[State.themeId]) return;

        // 1. 强制刷新 Canvas 内部的已学缓存
        if (State._refreshLearnedCache) {
          State._refreshLearnedCache();
        }

        // 2. 获取当前词书和已学单词数据
        const theme = DB[State.themeId];
        const allWordNodes = theme.nodes; // root 节点也纳入通关判定
        const currentLearned = typeof getLearnedSet === 'function' ? getLearnedSet() : new Set(); 

        // 3. 判断是否全部通关
        const isAllLearned = allWordNodes.length > 0 && allWordNodes.every(n => currentLearned.has(n.id));

        // 4. 如果全学完且还没放过烟花，直接点火！
        if (isAllLearned && !State._hasCelebrated) {
          State._hasCelebrated = true;
          State._supernovaStart = Date.now();
          State._supernovaGlow = true; // 所有节点同步增亮

          // 唤醒物理引擎并强制重绘（try-catch 防止阻断后续浮层）
          try {
            if (State.fg) {
              if (typeof State.fg.d3Alpha === 'function') {
                State.fg.d3Alpha(0.05).restart();
              }
              State.fg.refresh?.();
            }
          } catch (e) { console.warn('[supernova] fg refresh error:', e); }

          // DOM 庆祝浮层（延迟 500ms，等 sheet 完全关闭 + 超新星开始）
          const _theme = theme; // 显式捕获闭包
          setTimeout(() => {
            try {
              const target = document.getElementById('p-graph');
              if (!target) { console.error('[complete] #p-graph not found'); return; }

              const existing = document.getElementById('complete-overlay');
              if (existing) existing.remove();

              const total = _theme.nodes.length;
              const color = _theme.color || '#c6a84b';

              const overlay = document.createElement('div');
              overlay.id = 'complete-overlay';
              overlay.innerHTML = `
                <div class="co-glow" style="box-shadow:0 0 120px 40px ${color}30, 0 0 60px 20px ${color}20;"></div>
                <div class="co-icon">${_theme.icon || '✦'}</div>
                <div class="co-title">COMPLETE</div>
                <div class="co-sub">${_theme.label} · ${total} words mastered</div>
                <div class="co-sparks"></div>
              `;
              target.appendChild(overlay);

              // 生成庆祝粒子
              const sparksEl = overlay.querySelector('.co-sparks');
              for (let i = 0; i < 16; i++) {
                const spark = document.createElement('div');
                spark.className = 'co-spark';
                const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.4;
                const dist = 60 + Math.random() * 80;
                const size = 2 + Math.random() * 3;
                spark.style.cssText = `width:${size}px;height:${size}px;background:${color};box-shadow:0 0 8px ${color};--sx:${Math.cos(angle) * dist}px;--sy:${Math.sin(angle) * dist}px;animation-delay:${Math.random() * 0.3}s;`;
                sparksEl.appendChild(spark);
              }

              // 3.5 秒后淡出移除
              setTimeout(() => {
                overlay.classList.add('co-out');
                setTimeout(() => overlay.remove(), 600);
              }, 3500);

              console.log('[complete] overlay appended successfully');
            } catch (e) {
              console.error('[complete] overlay error:', e);
            }
          }, 500);
        } else {
          // 没学完也刷新一下画布，更新刚背的单词状态
          if (State.fg) State.fg.refresh?.();
        }
      };




      const renderGraph = (theme) => {
        // 销毁旧 ForceGraph 实例，防止泄漏（不经 goBack 直接切主题时）
        if (State.fg) {
          try { State.fg._destructor?.(); } catch {}
          State.fg = null;
        }
        if (State.trackInterval) {
          clearInterval(State.trackInterval);
          State.trackInterval = null;
        }
        DOM.fgWrap.innerHTML = '';
        const W = window.innerWidth, H = window.innerHeight;
        const isMobile = W < 600;

        // Cache learned set for this render session (updated when markLearned fires)
        let _learnedCache = getLearnedSet();
        State._refreshLearnedCache = () => { _learnedCache = getLearnedSet(); };

        const SPAWN_DELAY = 80;   // 每个词之间的间隔 ms
        const sortedNodes = [
          ...theme.nodes.filter(n => n.type === 'root'),
          ...theme.nodes.filter(n => n.type !== 'root'),
        ];

        // links 注入 logic 标签（只取 target 节点的 logic，表示"到达此词的含义"）
        const nodeById = {};
        sortedNodes.forEach(n => { nodeById[n.id] = n; });

        // 用户是否已交互（滚轮/触摸），初始隐藏标签
        State.userInteracted = false;
        State._removeUserActListeners?.();

        const nodesArr = sortedNodes.map((n, i) => ({
          ...n,
          _spawnIndex: i,
          _born:       false,
          _opacity:    0,
          // root节点在原点，其他节点初始都堆在root上，激活时从root飞出
          x: n.type === 'root' ? 0 : 0,
          y: n.type === 'root' ? 0 : 0,
        }));
        // Pre-compute previous node reference for O(1) loop lookup
        nodesArr.forEach((n, i) => {
          n._prevNode = i > 0 ? nodesArr[i - 1] : null;
        });

        const graphData = {
          nodes: nodesArr,
          links: theme.links.map(l => ({
            ...l,
            _logic: nodeById[l.target]?.logic || ''
          }))
        };

        // 增加两个变量用于检测双击
        // let lastClickTime = 0;
        // let lastClickedNodeId = null;

        const handleNodeClick = (node) => {
          State._nodeClickedThisFrame = true;
          if (State.zoomTimer) {
            clearTimeout(State.zoomTimer);
            State.zoomTimer = null;
          }

          if (!State.activeNodeId && State.fg) {
            const center = State.fg.centerAt();
            State.prevView = { x: center.x, y: center.y, zoom: State.fg.zoom() };
          }

          State.activeNodeId = node.id;  
          if (State.fg) {
            State.fg.centerAt(node.x, node.y, 350);
            const currentZoom = State.fg.zoom() || 1;
            State.fg.zoom(Math.min(currentZoom * 1.35, 2.8), 350);
            showCard(node.id); // 立即弹出卡片
          }
          State.fg?.refresh?.();
        };

        // 上面已清理旧实例，直接创建新的
        State.fg = ForceGraph()(DOM.fgWrap);

        State.fg
          .width(W).height(H)
          .backgroundColor('rgba(0,0,0,0)')
          .nodeLabel(n => {
            if (!n.zh) return n.id;
            const primaryZh = n.zh.split('；')[0].trim();
            const nodeColor = n.type === 'root' ? '#f0e6c8' : (getPosColor(n.pos) || '#6e7e92');
            return `<div style="
              padding: 6px 10px; 
              background: ${nodeColor}15; 
              border: 1px solid ${nodeColor}44; 
              border-radius: 6px; 
              color: rgba(255,255,255,0.95); 
              font-family: var(--serif, serif);
              font-size: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 10px ${nodeColor}22;
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
            ">${escapeHTML(primaryZh)}</div>`; 
          })
          // 关闭默认连线渲染，全部用 linkCanvasObject 自绘
          .linkColor(() => 'transparent')
          .linkWidth(0)
          .linkDirectionalParticles(1) // 启用一个原生粒子，以保持底层渲染循环始终运行，解决流光停止问题
          .linkDirectionalParticleWidth(0) // 隐藏原生粒子

          // ── 神经纤维连线 + 流光粒子 + 语义标签 ──
          .linkCanvasObjectMode(() => 'replace')
          .linkCanvasObject((link, ctx, globalScale) => {
            const src = link.source;
            const tgt = link.target;
            if (!src || !tgt || src.x == null || tgt.x == null) return;

            // 源节点未激活：完全不渲染
            if (!src._born) return;

            // 核心高亮逻辑：判断当前连线是否与点击的节点相关 🌟
            const isRelatedToActive = State.activeNodeId === src.id || State.activeNodeId === tgt.id;
            const hasActiveNode = !!State.activeNodeId;
            // 如果有选中的节点，但当前线无关，则极度变暗以突出重点
            const linkAlpha = (hasActiveNode && !isRelatedToActive) ? 0.08 : 1.0;

            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // ── 贝塞尔控制点：垂直偏移产生弯曲 ──
            // 用连线哈希让每条线弯曲方向固定（不抖动）
            const hashSeed = (src.x + tgt.y) * 0.05;
            const bendAmt  = Math.sin(hashSeed) * dist * 0.18; // 弯曲幅度
            const nx = -dy / dist; // 法线方向
            const ny =  dx / dist;
            const cpx = (src.x + tgt.x) / 2 + nx * bendAmt;
            const cpy = (src.y + tgt.y) / 2 + ny * bendAmt;

            // 全站统一的“幽灵青”神经纤维基底色
            const linkBaseColor = '#00b8ff'; 

            // ── 颜色：source→target 渐变 ──
            const grad = ctx.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
            const srcAlphaStr = src._born ? Math.round((src._opacity || 1) * 0x22).toString(16).padStart(2,'0') : '00';
            const tgtAlphaStr = tgt._born ? Math.round((tgt._opacity || 1) * 0x00).toString(16).padStart(2,'0') : '00';
            grad.addColorStop(0, '#ffffff' + (src._born ? '55' : '00')); 
            grad.addColorStop(0.05, linkBaseColor + srcAlphaStr); 
            grad.addColorStop(0.5, linkBaseColor + '10');      
            grad.addColorStop(1, linkBaseColor + tgtAlphaStr);  

            ctx.save();
            
            
            // ── 层1：外发光（粗、极低透明度）──
            ctx.globalAlpha = linkAlpha;

            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.quadraticCurveTo(cpx, cpy, tgt.x, tgt.y);
            ctx.strokeStyle = theme.color + '0a';
            ctx.lineWidth   = 4 / globalScale;
            ctx.lineCap     = 'round';
            ctx.stroke();

            // ── 层2：纤维主体（渐变，两端细中间粗）──
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.quadraticCurveTo(cpx, cpy, tgt.x, tgt.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth   = 1.2 / globalScale;
            ctx.lineCap     = 'round';
            ctx.stroke();

            // ── 流光粒子：沿贝塞尔曲线匀速流动 ──
            /*
            if (src._born && tgt._born) {
              // 初始化粒子偏移（每条线固定2个粒子，错开半个周期）
              if (link._p1 == null) {
                link._p1 = Math.random();
                link._p2 = (link._p1 + 0.5) % 1;
              }
              const speed = 0.003;
              link._p1 = (link._p1 + speed) % 1;
              link._p2 = (link._p2 + speed) % 1;

              // 贝塞尔曲线上取点的函数
              const bezierPt = (t) => {
                const mt = 1 - t;
                return {
                  x: mt*mt*src.x + 2*mt*t*cpx + t*t*tgt.x,
                  y: mt*mt*src.y + 2*mt*t*cpy + t*t*tgt.y,
                };
              };

              // 粒子尾迹：画一小段线段模拟拉丝效果
              const drawParticle = (t) => {
                const tail = 0.04; // 尾迹长度
                const t0 = Math.max(0, t - tail);
                const p0 = bezierPt(t0);
                const p1 = bezierPt(t);

                const pGrad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
                pGrad.addColorStop(0, linkBaseColor + '00');
                pGrad.addColorStop(1, linkBaseColor + '55');  // 尾迹更暗

                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.strokeStyle = pGrad;
                ctx.lineWidth   = 1.2 / globalScale;  
                ctx.lineCap     = 'round';
                ctx.stroke();

                // 粒子头部：更小更暗
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, 0.8 / globalScale, 0, Math.PI * 2);
                ctx.fillStyle = linkBaseColor + '88';
                ctx.fill();
              };

              drawParticle(link._p1);
              drawParticle(link._p2);
            } */


            const targetColor = getPosColor(link.target?.pos) || COSMOS_COLORS.default;   //'#00e5ff'; // 根据目标词的词性动态调整粒子颜色，增强语义提示
            const shouldDrawParticles = !hasActiveNode || isRelatedToActive;

            if (State.fg && shouldDrawParticles) { // 只在漫游状态流动
              // 初始化粒子偏移（保留你原来的 2 个粒子，错开 0.5 周期逻辑）
              /*if (link._p1 == null) {
                link._p1 = Math.random();
                link._p2 = (link._p1 + 0.5) % 1;
              }
              const speed = 0.002; // 原来的速度0.03
              link._p1 = (link._p1 + speed) % 1;
              link._p2 = (link._p2 + speed) % 1;*/

              if (link._offset == null) {
                link._offset = Math.random(); 
              }

              // 2. 复用帧级缓存时间戳
              const now = State._frameNow || Date.now();

              // 3. 设定粒子跑完一条线需要多少毫秒。
              // (注：你原先的 0.002 速度，在 60Hz 屏幕上大约等于跑完一圈需要 8300ms)
              // 这里设为 8000 毫秒，完美还原你原先的速度，且在 120Hz 屏幕上也不会暴走
              const duration = 8000; 
              
              // 4. 计算当前的基础进度 (0 到 1 之间循环)
              const baseProgress = (now % duration) / duration;

              // 5. 加上这条线的专属偏移量，算出两个粒子的真实位置
              const p1 = (baseProgress + link._offset) % 1;
              const p2 = (p1 + 0.5) % 1; // 

              // 贝塞尔曲线上取点的函数（保留你原来的 quadratic 贝塞尔计算）
              const bezierPt = (t) => {
                const mt = 1 - t;
                return {
                  x: mt*mt*src.x + 2*mt*t*cpx + t*t*tgt.x,
                  y: mt*mt*src.y + 2*mt*t*cpy + t*t*tgt.y,
                };
              };

              // 🌟 核心优化：重写 drawParticle 函数，注入灵魂 🌟
              const drawParticle = (t) => {
                const tail = 0.08; // 尾迹长度
                const t0 = Math.max(0, t - tail);
                const p0 = bezierPt(t0);
                const p1 = bezierPt(t);

                // --- 第一步：画高亮度、优雅渐变的拉丝尾迹 ---
                // 创建一个从上一个点到当前点的线性渐变
                const pGrad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
                // 🌟 优化颜色：让尾迹从完全透明渐变为高亮（bb）的目的地颜色
                pGrad.addColorStop(0, targetColor + '00');
                pGrad.addColorStop(1, targetColor + '66'); // bb 73% 不透明度的高亮彩色拉丝

                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.strokeStyle = pGrad;
                ctx.lineWidth   = 1.2 / globalScale;  // 1.6 加粗一点点拉丝，增加存在感
                ctx.lineCap     = 'round';
                ctx.stroke();

                // --- 第二步：🌟 关键优化：为头部增加“磁性发光（ShadowBlur）”和“白光内核（Core）” 🌟 ---
                ctx.save(); // 锁定当前画布状态，防止发光溢出
                
                // 开启粒子核心发光（光剑感）
                ctx.shadowColor = targetColor;
                ctx.shadowBlur = 1.2 / globalScale; //4 范围，可以尝试4 

                // 画白色高亮内核（纯白，极其吸睛，让粒子看起来是从内部过载爆发出来的柔和光球）
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, 0.6 / globalScale, 0, Math.PI * 2); // 1 则会稍微放大一点点头部，0.6比较小
                ctx.fillStyle = 'rgba(255, 255, 255, 0.50)'; // ctx.fillStyle = '#ffffff';  实色
                ctx.fill();

                ctx.restore(); // 释放画布状态，绝不污染其他连线和节点
              };

              drawParticle(p1);
              drawParticle(p2);
            }





            // 🌟 动态决定是否显示文字标签 🌟
            let showLabel = false;
            
            const ZOOM_THRESHOLD = 1.2;
            
            if (hasActiveNode) {
               showLabel = isRelatedToActive; // 点击时只显示相关标签
            } else {
               showLabel = globalScale >= ZOOM_THRESHOLD; // 漫游时根据缩放显示
            }

            const label = link._logic;
            if (showLabel && label) {
                const lt = 0.55; 
                const lmt = 1 - lt;
                const lx = lmt*lmt*src.x + 2*lmt*lt*cpx + lt*lt*tgt.x;
                const ly = lmt*lmt*src.y + 2*lmt*lt*cpy + lt*lt*tgt.y;

                const dx_dt = 2*lmt*(cpx - src.x) + 2*lt*(tgt.x - cpx);
                const dy_dt = 2*lmt*(cpy - src.y) + 2*lt*(tgt.y - cpy);
                
                let angle = Math.atan2(dy_dt, dx_dt);
                if (dx_dt < 0) {
                  angle += Math.PI; // 防倒立
                }

                const fontSize = Math.min(Math.max(9 / globalScale, 7), 12);
                const maxLen = 18;
                const text = label.length > maxLen ? label.slice(0, maxLen) + '…' : label;

                ctx.translate(lx, ly);
                ctx.rotate(angle);

                ctx.font = `300 ${fontSize}px 'DM Mono', monospace`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';

                // 🌟 神奇的 Text Halo 技术取代胶囊 🌟
                // 1. 先用深空底色画出极其粗的文字外轮廓，切断后面的连线
                ctx.lineJoin = 'round';
                ctx.lineWidth = 4 / globalScale; 
                ctx.strokeStyle = 'rgba(3, 4, 7, 0.5)';// 使用透明
                ctx.strokeText(text, 0, 0);

                // 2. 再在上面画出实心文字
                // 选中状态用青色，平时用稍微偏白的浅色
                if (hasActiveNode && isRelatedToActive) {
                    ctx.fillStyle = '#00e5ff';
                    ctx.shadowColor = '#00e5ff';
                    ctx.shadowBlur = 4 / globalScale;
                } else {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
                    ctx.shadowBlur = 0; 
                }

                ctx.fillText(text, 0, 0);
                ctx.shadowBlur = 0; // 恢复画布状态


            }

            ctx.restore();
          })
          .onZoom(() => {
            // 保留空回调，不再用于判断用户交互
          })
          .nodeCanvasObject((node, ctx, globalScale) => {
            // 每帧缓存一次时间戳，避免每个节点都调 Date.now()
            if (!State._frameNow || node._spawnIndex === 0) {
              State._frameNow = Date.now();
            }
            const _now = State._frameNow;

            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const isHovered = !isTouchDevice && State.hoverNodeId === node.id;
            const isClicked = State.activeNodeId === node.id;
            const hasActiveNode = !!State.activeNodeId;
            
            const isRoot = node.type === 'root';
            const label = node.name;
            const zh = node.zh ? node.zh.split('；')[0] : '';
            
            const nodeColor = isRoot ? COSMOS_COLORS.root : (getPosColor(node.pos) || COSMOS_COLORS.default);

            const enSize = Math.max(isMobile ? 14 : 16, (isMobile ? 14 : 16) / globalScale);
            const zhSize = Math.max(isMobile ? 11 : 12, (isMobile ? 11 : 12) / globalScale);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // ── 顺序物理激活 ──
            const prevNode = node._prevNode;

            // 🌟 修复版核心节奏控制：
            // 1. 强制最小间隔：必须至少等 200ms，绝对不允许瞬间连发糊在一起
            // 2. 弹射触发器：速度降下来了 (< 1.0)，或者等够了 250ms，就发射下一个
            const timeSincePrev = prevNode ? (_now - (prevNode._bornAt || 0)) : 0;
            const prevSettled = !prevNode || (
              prevNode._born && 
              timeSincePrev >200 && 
              (
                (Math.abs(prevNode.vx || 0) < 1.0 && Math.abs(prevNode.vy || 0) < 1.0) || 
                timeSincePrev > 250
              )
            );

            if (!node._born && prevSettled) {
              node._born = true;
              node._bornAt = _now;

              let angle = Math.random() * Math.PI * 2;
              if (isPortrait) {
                const vertBias = 0.3;
                angle += Math.sin(2 * angle) * vertBias;
              }

              if (cachedRoot && node.type !== 'root') {
                const offsetDist = 5; 
                node.x = (cachedRoot.x || 0) + Math.cos(angle) * offsetDist;
                node.y = (cachedRoot.y || 0) + Math.sin(angle) * offsetDist;
                
                // 恢复一点初始速度，让弹射更有力
                const speed = isMobile ? 26 : 36; 
                node.vx = Math.cos(angle) * speed;
                node.vy = Math.sin(angle) * speed;
              } else {
                node.x = cachedRoot ? cachedRoot.x : 0;
                node.y = cachedRoot ? cachedRoot.y : 0;
                node.vx = 0;
                node.vy = 0;
              }

              node._opacity = 0;

              // 节流防过载，每 150ms 续一次物理推力
              if (!State._lastReheat || _now - State._lastReheat > 150) {
                State.fg?.d3ReheatSimulation?.();
                State._lastReheat = _now;
              }
            }

            if (!node._born) return;

            // 🌟 关键视觉修复：把淡入时间缩短回 180ms！
            // 保证单词在“空中飞行”的时候就已经能被眼睛看清，而不是飞完了才亮起来
            const age = _now - (node._bornAt || 0);
            node._opacity = Math.min(age / 180, 1);
            
            ctx.save();

            const isFocusedNode = node.id === State.activeNodeId;
            let finalOpacity = Math.min(node._opacity, 1);

            if (hasActiveNode && !isRoot && !isFocusedNode) {
              finalOpacity *= 0.15; 
            }
            ctx.globalAlpha = finalOpacity;

            // 1. 光晕绘制
            if (isRoot) {
              const rootLearned = _learnedCache.has(node.id);
              const haloR = enSize * (rootLearned ? 2.8 : 2.4);
              const rootAlpha = rootLearned ? 0.22 : 0.15;
              ctx.beginPath();
              ctx.arc(node.x, node.y, haloR, 0, 2 * Math.PI);
              const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloR);
              grad.addColorStop(0, `rgba(255,255,255,${rootAlpha})`);
              grad.addColorStop(1, 'transparent');
              ctx.fillStyle = grad;
              ctx.fill();

              // root 节点未学高亮
              if (State._showUnlearned && !rootLearned) {
                ctx.save();
                const ringR = enSize * 2.4;
                ctx.beginPath();
                ctx.arc(node.x, node.y, ringR, 0, 2 * Math.PI);
                ctx.setLineDash([5 / globalScale, 8 / globalScale]);
                ctx.strokeStyle = COSMOS_COLORS.root;
                ctx.globalAlpha = 0.7;
                ctx.lineWidth = 0.4 / globalScale;
                ctx.shadowColor = COSMOS_COLORS.root;
                ctx.shadowBlur = 2.5 / globalScale;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
              }

              // 超新星冲击波视觉特效
                if (State._supernovaStart) {
                  const novaAge = _now - State._supernovaStart;
                  const novaDuration = 2000;
                  const tColor = DB[State.themeId]?.color || '#00e5ff';

                  if (novaAge < novaDuration) {
                    ctx.save();
                    const progress = novaAge / novaDuration;
                    const ease = 1 - Math.pow(1 - progress, 3);
                    const maxR = Math.max(window.innerWidth, window.innerHeight) * 1.5 / globalScale;

                    // 主冲击波环（主题色）
                    const currentR = ease * maxR;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, currentR, 0, 2 * Math.PI);
                    ctx.lineWidth = (12 * (1 - progress)) / globalScale;
                    const alpha = Math.max(0, 1 - progress).toFixed(2);
                    ctx.strokeStyle = tColor + Math.round(alpha * 255).toString(16).padStart(2, '0');
                    ctx.shadowColor = tColor;
                    ctx.shadowBlur = 50 / globalScale;
                    ctx.stroke();

                    // 第二道余波（延迟、更宽、更淡）
                    const p2 = Math.max(0, (novaAge - 200) / novaDuration);
                    if (p2 > 0) {
                      const ease2 = 1 - Math.pow(1 - Math.min(p2, 1), 3);
                      const r2 = ease2 * maxR * 0.85;
                      const a2 = Math.max(0, 0.4 * (1 - p2)).toFixed(2);
                      ctx.beginPath();
                      ctx.arc(node.x, node.y, r2, 0, 2 * Math.PI);
                      ctx.lineWidth = (6 * (1 - p2)) / globalScale;
                      ctx.strokeStyle = `rgba(255,255,255,${a2})`;
                      ctx.shadowColor = 'rgba(255,255,255,0.3)';
                      ctx.shadowBlur = 30 / globalScale;
                      ctx.stroke();
                    }

                    // 中心辉光脉冲
                    if (progress < 0.5) {
                      const glowA = 0.25 * (1 - progress * 2);
                      const glowR = enSize * 6 * (0.5 + progress);
                      const glowGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
                      glowGrad.addColorStop(0, tColor + Math.round(glowA * 255).toString(16).padStart(2, '0'));
                      glowGrad.addColorStop(1, 'transparent');
                      ctx.fillStyle = glowGrad;
                      ctx.beginPath();
                      ctx.arc(node.x, node.y, glowR, 0, 2 * Math.PI);
                      ctx.fill();
                    }

                    ctx.restore();
                    // 标记需要续帧（由外层 onRenderFramePost 统一 refresh，避免双倍重绘）
                    State._novaNeedsRefresh = true;
                  } else {
                    State._supernovaStart = null;
                    State._supernovaGlow = false;
                  }
                }
            } else {
              const isLearned = _learnedCache.has(node.id);
              // 超新星期间所有节点同步增亮
              const glowBoost = State._supernovaGlow ? 1.4 : 1;
              const haloR = enSize * (isLearned ? 2.1 : 1.6) * glowBoost;
              const haloAlpha = isLearned ? (State._supernovaGlow ? '60' : '38') : (State._supernovaGlow ? '40' : '20');
              ctx.beginPath();
              ctx.arc(node.x, node.y, haloR, 0, 2 * Math.PI);
              const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloR);
              grad.addColorStop(0, nodeColor + haloAlpha);
              grad.addColorStop(1, 'transparent');
              ctx.fillStyle = grad;
              ctx.fill();

              if (State._showUnlearned && !isLearned) {
                ctx.save(); 
                
                const ringR = enSize * 2.0;
                
                ctx.beginPath();
                ctx.arc(node.x, node.y, ringR, 0, 2 * Math.PI);
                
                // 保留高级的虚线比例 (长线段 + 宽间距)
                ctx.setLineDash([5 / globalScale, 8 / globalScale]);
                
                ctx.strokeStyle = nodeColor; 
                ctx.globalAlpha = 0.7; 
                // 你指定的 0.4 极细线宽，质感拉满
                ctx.lineWidth = 0.4 / globalScale; 
                
                // 微弱的霓虹发光
                ctx.shadowColor = nodeColor;
                ctx.shadowBlur = 2.5 / globalScale;
                
                ctx.stroke();
                
                // 清理状态，防止影响其他节点
                ctx.setLineDash([]);
                ctx.restore(); 
              }

              // 出生闪光
              if (age < 400) {
                const t = age / 400;
                const flashR = enSize * (1.5 + t * 3);
                const flashAlpha = Math.round((1 - t) * 0.4 * 255).toString(16).padStart(2, '0');
                ctx.beginPath();
                ctx.arc(node.x, node.y, flashR, 0, 2 * Math.PI);
                ctx.strokeStyle = nodeColor + flashAlpha;
                ctx.lineWidth = (2 - t * 1.5) / globalScale;
                ctx.stroke();
              }
            }

            // 2. 点击选中的脉冲高光
            if (node.id === State.activeNodeId) {
              const pulseR = enSize * 4.5;
              const pulseGrad = ctx.createRadialGradient(node.x, node.y, enSize * 0.5, node.x, node.y, pulseR);
              pulseGrad.addColorStop(0, nodeColor + '50');
              pulseGrad.addColorStop(0.4, nodeColor + '22');
              pulseGrad.addColorStop(1, 'transparent');
              ctx.beginPath();
              ctx.arc(node.x, node.y, pulseR, 0, 2 * Math.PI);
              ctx.fillStyle = pulseGrad;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(node.x, node.y, enSize * 2, 0, 2 * Math.PI);
              ctx.strokeStyle = nodeColor + 'cc';
              ctx.lineWidth = 1.5 / globalScale;
              ctx.stroke();
            }

            // 3. 节点实体小圆点
            const baseR = (isRoot ? 5 : 3) / globalScale; 

            if (isHovered || isClicked) {
                ctx.save();
                ctx.beginPath();
                ctx.fillStyle = nodeColor;
                ctx.globalAlpha = 0.15;
                ctx.arc(node.x, node.y, baseR * 5, 0, 2 * Math.PI);
                ctx.fill();

                ctx.beginPath();
                ctx.globalAlpha = 0.4;
                ctx.arc(node.x, node.y, baseR * 2.2, 0, 2 * Math.PI);
                ctx.fill();
                
                if (!isRoot){
                  ctx.fillStyle = nodeColor;
                } else {                 
                  ctx.fillStyle = COSMOS_COLORS.root || '#ffffff';
                }                
                ctx.beginPath();
                ctx.globalAlpha = 0.85;
                ctx.arc(node.x, node.y, baseR * 1.4, 0, 2 * Math.PI);
                ctx.fill();

                ctx.beginPath();
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = '#ffffff'; 
                ctx.arc(node.x, node.y, baseR * 0.8, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();

            } else if (hasActiveNode) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.arc(node.x, node.y, baseR, 0, 2 * Math.PI);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.fillStyle = nodeColor; 
                ctx.arc(node.x, node.y, baseR, 0, 2 * Math.PI);
                ctx.fill();
            }

            // 4. 节点文字
            ctx.save();
            ctx.font = `${isRoot ? 700 : 600} ${enSize}px 'DM Mono', monospace`;
            ctx.fillStyle = isRoot ? COSMOS_COLORS.root : nodeColor ;
            ctx.fillText(label, node.x, node.y - zhSize * 0.8);

            // 5. Root节点的中文说明
            if (isRoot && globalScale > 0.55 && zh) {
              ctx.font = `300 ${zhSize}px 'Lora', serif`;
              ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
              ctx.fillText(zh, node.x, node.y + enSize * 0.85);
            }

            const textWidth = ctx.measureText(label).width;
            node.__r = Math.max(enSize * 3.5, (textWidth / 2) + enSize);

            ctx.restore();
          })

          .nodePointerAreaPaint((node, color, ctx, globalScale) => {
            // 未出生节点不接受点击
            if (!node._born) return;

            ctx.fillStyle = color;
            const isMobile = window.innerWidth < 600;
            const enSize = Math.max(isMobile ? 14 : 16, (isMobile ? 14 : 16) / globalScale);
            const zhSize = Math.max(isMobile ? 11 : 12, (isMobile ? 11 : 12) / globalScale);

            ctx.font = `${node.type === 'root' ? 700 : 600} ${enSize}px 'DM Mono', monospace`;
            const textWidth = ctx.measureText(node.name).width;

            // 手机上加大碰撞框，更容易点中
            const paddingX = enSize * (isMobile ? 1.5 : 1.0);
            const width = textWidth + paddingX;
            const height = enSize * (isMobile ? 1.5 : 1.5);
            const offsetY = zhSize * 0.8;

            const x = node.x - width / 2;
            const y = node.y - height / 2 - offsetY;
            ctx.beginPath();
            ctx.rect(x, y, width, height);
            ctx.fill();
          })
          .onNodeClick(handleNodeClick)
          .onNodeDrag(node => {
            if (node.__startX === undefined) {
              node.__startX = node.x;
              node.__startY = node.y;
              node.__startTime = Date.now();
            }
          })
          .onNodeDragEnd(node => {
            if (node.__startX !== undefined) {
              const dx = node.x - node.__startX;
              const dy = node.y - node.__startY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const duration = Date.now() - (node.__startTime || 0);

              node.__startX = undefined;
              node.__startY = undefined;
              node.__startTime = undefined;
              const zoom = State.fg?.zoom() || 1;
              // If moved less than 10 units (physics space) or very quickly, treat as a click
              if (dist * zoom < 10 || duration < 250) {
                handleNodeClick(node);
              }
            }
          })
          .onNodeHover(node => {
            // 如果是触屏设备（手机/平板），直接跳过 Hover 逻辑！
            // 这样手机上就完全靠 Click 来触发那套华丽的光晕和连线了。
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (isTouchDevice) return;
            // 电脑端专属的悬浮发光逻辑
            State.hoverNodeId = node ? node.id : null;
            State.fg.refresh?.();
          })
          .onBackgroundClick(() => closeSheet())
          .onRenderFramePost(() => {
            // 超新星动画期间统一续帧，避免 nodeCanvasObject 内双倍重绘
            if (State._novaNeedsRefresh) {
              State._novaNeedsRefresh = false;
              requestAnimationFrame(() => { State.fg?.refresh?.(); });
            }
          })
          .graphData(graphData);

        // 🌟 屏幕方向检测：竖屏 vs 横屏
        const isPortrait = H > W;
        const aspectRatio = H / W; // 竖屏时 > 1，比如手机约 1.8~2.2

        // 缓存 root 节点引用，避免每帧 find() 的 O(n) 开销
        const cachedRoot = graphData.nodes.find(n => n.type === 'root');
        if (typeof d3 !== 'undefined' && d3.forceCollide) {
          State.fg.d3Force('collide', d3.forceCollide(node => {
            // __r 是前面算好的文字宽度半径，再加 15px 的安全间距
            return (node.__r || 30) + 15; 
          }).iterations(2));
        }
        State.fg.d3Force('charge').strength(isMobile ? -550 : -900);
        State.fg.d3Force('link').distance(isMobile ? 120 : 180);
        State.fg.d3AlphaDecay(0.025);
        State.fg.d3VelocityDecay(0.38);

        // 自定义重力场：让 root 节点变得非常重
        State.fg.d3Force('rootMass', () => {
          if (cachedRoot && cachedRoot.fx === undefined) { 
            cachedRoot.vx *= 0.1;
            cachedRoot.vy *= 0.1;
          }
        });

        // 🌟 竖屏椭圆布局：物理引擎活跃时按屏幕比例微调坐标
        // alpha 衰减到 0.01 以下时停止，防止图谱稳定后节点继续漂移
        if (isPortrait) {
          const ratio = Math.min(aspectRatio, 2.2);
          const maxDeform = (ratio - 1) * 0.012;

          State.fg.d3Force('portraitShape', (alpha) => {
            if (!State.fg || alpha < 0.01 || !cachedRoot) return;
            const xShrink = 1 - maxDeform * alpha;
            const yStretch = 1 + maxDeform * alpha;
            const cx = cachedRoot.x || 0;
            const cy = cachedRoot.y || 0;

            State.fg.graphData().nodes.forEach(n => {
              if (!n._born || n.type === 'root') return;
              n.x = cx + (n.x - cx) * xShrink;
              n.y = cy + (n.y - cy) * yStretch;
            });
          });
        }
        else {
          // 横屏模式：屏幕宽度 > 高度
          // 计算横向比例 (W/H)，比如 16:9 大约是 1.77
          const ratio = Math.min(W / H, 2.5); 
          // 拉伸强度系数：横屏可以稍微拉狠一点，让它充分占满左右
          const maxDeform = (ratio - 1) * 0.015; 

          State.fg.d3Force('landscapeShape', (alpha) => {
            if (!State.fg || alpha < 0.01 || !cachedRoot) return;
            // 核心魔法：X 轴拉伸（变宽），Y 轴压缩（变扁）
            const xStretch = 1 + maxDeform * alpha; 
            const yShrink = 1 - (maxDeform * 0.5) * alpha; // Y 轴稍微压扁一点点即可
            
            const cx = cachedRoot.x || 0;
            const cy = cachedRoot.y || 0;

            State.fg.graphData().nodes.forEach(n => {
              if (!n._born || n.type === 'root') return;
              // 按照屏幕比例，把节点往左右两边拽
              n.x = cx + (n.x - cx) * xStretch;
              n.y = cy + (n.y - cy) * yShrink;
            });
          });
        }

        // 1. 初始化瞬间，直接将镜头贴脸锁定在中心原点（零延迟）
        State.fg.centerAt(0, 0, 0);
        State.fg.zoom(isMobile ? 3.5 : 4.5, 0);

        // 2. 只给 Canvas 极短的 50ms 渲染上屏时间，随后立刻开始“平滑后撤”
        setTimeout(() => {
          if (!State.fg) return;
          
          const maxFits = 30; // 增加追踪次数兜底
          let fitCount = 0;
          
          const doTracking = () => {
            if (!State.fg || fitCount >= maxFits) {
              clearInterval(State.trackInterval);
              return;
            }

            const nodes = State.fg.graphData().nodes;
            const allBorn = nodes.length > 0 && nodes.every(n => n._born);
            const padding = isMobile ? 30 : 100;
            
            // 【核心魔法】每次调用耗时 400ms，恰好等于定时器的间隔！
            // 这样前一次缩放刚好结束，后一次无缝接上，视觉上就是一条连贯顺滑的后撤曲线
            State.fg.zoomToFit(400, padding); 
            fitCount++;

            if (allBorn) {
              clearInterval(State.trackInterval);
              setTimeout(() => {
                State.fg?.zoomToFit(1200, padding);
                // 最终定格后 2 秒自动隐藏 topbar
                scheduleHideTopbar(2000);
              }, 400);
            }
          };

          // 将追踪间隔从原先卡顿的 600ms 缩短为 400ms
          State.trackInterval = setInterval(doTracking, 400);
          doTracking(); // 0等待，立刻触发第一帧后撤！

          // --- 监听用户主动手势（触摸/滚轮），一旦干预立刻把控制权还给用户 ---
          const canvas = DOM.fgWrap.querySelector('canvas');
          if (canvas) {
            const onUserAct = () => {
              State.userInteracted = true;
              clearInterval(State.trackInterval);
              canvas.removeEventListener('wheel', onUserAct);
              canvas.removeEventListener('pointerdown', onUserAct);
            };
            canvas.addEventListener('wheel', onUserAct, { passive: true });
            canvas.addEventListener('pointerdown', onUserAct, { passive: true });

            State._removeUserActListeners = () => {
              clearInterval(State.trackInterval);
              canvas.removeEventListener('wheel', onUserAct);
              canvas.removeEventListener('pointerdown', onUserAct);
            };
          }
        }, 50); // 仅仅 50ms 缓冲，不再傻等半秒钟
      };

