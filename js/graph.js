// ══ Force Graph Renderer ══
      const openTheme = (themeId) => {
        const theme = DB[themeId];
        if (!theme) return;
        State.themeId = themeId;

        DOM.tbarName.textContent = `${theme.icon} ${theme.label}`;
        DOM.tbarName.style.color = theme.color;
        DOM.tbarStat.textContent = `${theme.nodes.length} 词 · 触摸节点查看`;

        showPage(DOM.pGraph);
        State._starfieldActive = false;

        setTimeout(() => renderGraph(theme), 80);
      };

      const renderGraph = (theme) => {
        DOM.fgWrap.innerHTML = '';
        const W = window.innerWidth, H = window.innerHeight;
        const isMobile = W < 600;

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

        const graphData = {
          nodes: sortedNodes.map((n, i) => ({
            ...n,
            _spawnIndex: i,
            _born:       false,
            _opacity:    0,
            // root节点在原点，其他节点初始都堆在root上，激活时从root飞出
            x: n.type === 'root' ? 0 : 0,
            y: n.type === 'root' ? 0 : 0,
          })),
          links: theme.links.map(l => ({
            ...l,
            _logic: nodeById[l.target]?.logic || ''
          }))
        };

        // 增加两个变量用于检测双击
        let lastClickTime = 0;
        let lastClickedNodeId = null;

        State.fg = ForceGraph()(DOM.fgWrap)
          .width(W).height(H)
          .backgroundColor('rgba(0,0,0,0)')
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
              if (link._p1 == null) {
                link._p1 = Math.random();
                link._p2 = (link._p1 + 0.5) % 1;
              }
              const speed = 0.002; // 原来的速度0.03
              link._p1 = (link._p1 + speed) % 1;
              link._p2 = (link._p2 + speed) % 1;

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

              drawParticle(link._p1);
              drawParticle(link._p2);
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
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const isHovered = !isTouchDevice && State.hoverNodeId === node.id;
            const isClicked = State.activeNodeId === node.id;
            const hasActiveNode = !!State.activeNodeId;
            
            
            const isRoot = node.type === 'root';
            const label = node.name;
            const zh = node.zh ? node.zh.split('；')[0] : '';
            
            // 🚀 获取专属词性色！
            // const nodeColor = isRoot ? '#ffffff' : getPosColor(node.pos);
            const nodeColor = isRoot ? COSMOS_COLORS.root : (getPosColor(node.pos) || COSMOS_COLORS.default);

            const enSize = Math.max(isMobile ? 14 : 16, (isMobile ? 14 : 16) / globalScale);
            const zhSize = Math.max(isMobile ? 11 : 12, (isMobile ? 11 : 12) / globalScale);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // ── 顺序物理激活：前一节点速度衰减后才激活当前节点 ──
            const nodes    = State.fg?.graphData()?.nodes || [];
            const prevNode = node._spawnIndex > 0
              ? nodes.find(n => n._spawnIndex === node._spawnIndex - 1)
              : null;

            // 速度阈值：越小等越久，越大连蹦越快
            // 用 1.8 让节点"还在滑行"时就触发下一个，节奏更紧凑
            const prevSettled = !prevNode || (
              prevNode._born &&
              Math.abs(prevNode.vx || 0) < 1.6 &&
              Math.abs(prevNode.vy || 0) < 1.6
            );

            if (!node._born && prevSettled) {
              node._born = true;
              node._bornAt = Date.now();

              // ① teleport 到 root 节点位置（从root身上飞出）
              if (cachedRoot && node.type !== 'root') {
                node.x = cachedRoot.x || 0;
                node.y = cachedRoot.y || 0;
              }

              if (node.type !== 'root') {
                // ② 速度方向：向外辐射，竖屏时偏向上下
                let angle = Math.random() * Math.PI * 2;
                if (isPortrait) {
                  // 竖屏微调：让角度更偏向 90°/270°（上下方向）
                  // 原理：把水平方向的角度往垂直方向"吸"一点
                  const vertBias = 0.3;
                  angle += Math.sin(2 * angle) * vertBias;
                }
                const speed = isMobile ? 30 : 42;
                node.vx = Math.cos(angle) * speed;
                node.vy = Math.sin(angle) * speed;
              } else {
                node.vx = 0;
                node.vy = 0;
              }

              // ③ 激活闪光：opacity 从 0 开始，快速升到 1
              node._opacity = 0;

              State.fg?.d3ReheatSimulation?.();
            }

            // 未激活节点完全隐藏
            if (!node._born) return;

            // ── 透明度动画：快速淡入 (0 → 1, ~150ms) ──
            const age = Date.now() - (node._bornAt || 0);
            node._opacity = Math.min(age / 150, 1);
            
            ctx.save();

            const hasActive = !!State.activeNodeId; 
            const isFocusedNode = node.id === State.activeNodeId;
            let finalOpacity = Math.min(node._opacity, 1);

            // 如果当前有选中的词，并且这个节点既不是Root，也不是被选中的词
            // 那么让它的透明度瞬间暴跌到 15% (遁入黑暗)
            if (hasActive && !isRoot && !isFocusedNode) {
              finalOpacity *= 0.15; 
            }
            ctx.globalAlpha = finalOpacity;

            // 1. 核心词外围的巨大光晕 (Root)
            if (isRoot) {
              const haloR = enSize * 2.4;
              ctx.beginPath();
              ctx.arc(node.x, node.y, haloR, 0, 2 * Math.PI);
              const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloR);
              grad.addColorStop(0, 'rgba(255,255,255,0.15)');
              grad.addColorStop(1, 'transparent');
              ctx.fillStyle = grad;
              ctx.fill();
            }else{
              // 非Root节点的基础光晕 (使用词性色)
              const haloR = enSize * 1.6;
              ctx.beginPath();
              ctx.arc(node.x, node.y, haloR, 0, 2 * Math.PI);
              const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloR);
              grad.addColorStop(0, nodeColor + '20');
              grad.addColorStop(1, 'transparent');
              ctx.fillStyle = grad;
              ctx.fill();

              // 🌟 出生闪光：前 400ms 显示一个快速扩散并消散的光环
              if (age < 400) {
                const t = age / 400; // 0 → 1
                const flashR = enSize * (1.5 + t * 3);
                const flashAlpha = Math.round((1 - t) * 0.4 * 255).toString(16).padStart(2, '0');
                ctx.beginPath();
                ctx.arc(node.x, node.y, flashR, 0, 2 * Math.PI);
                ctx.strokeStyle = nodeColor + flashAlpha;
                ctx.lineWidth = (2 - t * 1.5) / globalScale;
                ctx.stroke();
              }
            }

            // 2. 点击选中的脉冲高光 (使用词性色)
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


            // 3. 节点实体小圆点 (使用词性色)
            
            // ─── 1. 安全获取当前节点的颜色 ───
            
            const baseR = (isRoot ? 5 : 3) / globalScale; // 基础半径

            // ─── 2. 状态判定（严格分离 Hover 和 Click） ───
            /*const isHovered = State.hoverNodeId === node.id;
            const isClicked = State.activeNodeId === node.id;
            const hasActiveNode = !!State.activeNodeId; // 只认 Click */

            if (isHovered || isClicked) {
                // 🌟 核心魔法：手搓磁性光晕 (不受引擎缩放 Bug 影响)
                ctx.save(); // 锁定当前画布状态

                // 第一层：大范围的微弱环境光（散发磁力感）
                ctx.beginPath();
                ctx.fillStyle = nodeColor;
                ctx.globalAlpha = 0.15; // 15% 透明度
                ctx.arc(node.x, node.y, baseR * 5, 0, 2 * Math.PI);
                ctx.fill();

                // 第二层：靠近核心的强烈霓虹光晕
                ctx.beginPath();
                ctx.globalAlpha = 0.4; // 40% 透明度
                ctx.arc(node.x, node.y, baseR * 2.2, 0, 2 * Math.PI);
                ctx.fill();
                // 第三层：高亮霓虹边缘
                if (!isRoot){
                  ctx.fillStyle = nodeColor;}
                else{                 
                  ctx.fillStyle =COSMOS_COLORS;
                }                
                ctx.beginPath();
                ctx.globalAlpha = 0.85; // 极高的不透明度，极其刺眼
                
                ctx.arc(node.x, node.y, baseR * 1.4, 0, 2 * Math.PI);
                ctx.fill();
                

                // 第四层：发光的实体核心（纯白高亮，极其吸睛）
                ctx.beginPath();
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = '#ffffff'; 
                ctx.arc(node.x, node.y, baseR * 0.8, 0, 2 * Math.PI);
                ctx.fill();

            } else if (hasActiveNode) {
                // 【状态 B：其他节点被点击，当前节点退居暗处】
                ctx.beginPath();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.arc(node.x, node.y, baseR, 0, 2 * Math.PI);
                ctx.fill();

            } else {
                // 【状态 C：纯粹的漫游状态，显示原生色小点】
                ctx.beginPath();
                ctx.fillStyle = nodeColor; 
                ctx.arc(node.x, node.y, baseR, 0, 2 * Math.PI);
                ctx.fill();
            }

            // 4. 节点文字 (加粗为600，使用词性色并提高亮度到 f2)
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

            // 恢复 canvas 状态
            ctx.restore();
          })
          .nodeLabel(node => {
            // For non-root nodes, show Chinese in tooltip. Root nodes already show it on canvas.
            if (node.type !== 'root' && node.zh) {
              const posColor = getPosColor(node.pos);
              return `<div style="
                font-family: var(--serif);
                font-size: 12px;
                color: rgba(255, 255, 255, 0.9);
                background: rgba(10, 14, 28, 0.55); /* 🌟 核心：半透明的深渊蓝 */
                backdrop-filter: blur(10px); /* 🌟 核心：毛玻璃模糊背景 */
                -webkit-backdrop-filter: blur(10px);
                padding: 6px 12px;
                border-radius: 8px;
                border: 1px solid ${posColor}44; /* 微弱的词性专属色边框 */
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
                transform: translateY(-4px); /* 稍微往上抬一点，不挡住鼠标 */
              ">${escapeHTML(node.zh.split('；')[0])}</div>`;
            }
            return '';
          })
          .nodePointerAreaPaint((node, color, ctx, globalScale) => {
            ctx.fillStyle = color;
            const isMobile = window.innerWidth < 600;
            const enSize = Math.max(isMobile ? 14 : 16, (isMobile ? 14 : 16) / globalScale);
            const zhSize = Math.max(isMobile ? 11 : 12, (isMobile ? 11 : 12) / globalScale);

            // 1. 获取准确的文字宽度
            ctx.font = `${node.type === 'root' ? 700 : 600} ${enSize}px 'DM Mono', monospace`;
            const textWidth = ctx.measureText(node.name).width;

            // 2. 设定宽裕的碰撞框尺寸（增加左右和上下的容错率，手机上更容易点中）
            const paddingX = enSize * 2.0; 
            const width = textWidth + paddingX;
            // 高度要能包裹住上方的英文、中间的圆点、以及 Root 节点下方的中文
            const height = enSize * 3.5; 

            // 3. 🌟 核心修复 2：Y轴碰撞偏移。视觉上英文往上挪了 zhSize * 0.8，碰撞框也要跟着往上挪！
            const offsetY = zhSize * 0.8;

            ctx.beginPath();
            // 画一个隐形的“胶囊”作为完美的触摸响应区
            ctx.roundRect(node.x - width / 2, node.y - height / 2 - offsetY, width, height, height / 2);
            ctx.fill();
          })
          .onNodeClick(node => {
            if (State.zoomTimer) {
              clearTimeout(State.zoomTimer);
              State.zoomTimer = null;
            }

            if (!State.activeNodeId && State.fg) {
              const center = State.fg.centerAt();
              State.prevView = { x: center.x, y: center.y, zoom: State.fg.zoom() };
            }

            State.activeNodeId = node.id;
            State.fg.centerAt(node.x, node.y, 350);
            
            State.zoomTimer = setTimeout(() => {
              if (!State.fg || State.activeNodeId !== node.id) return;
              const currentZoom = State.fg.zoom() || 1;
              State.fg.zoom(Math.min(currentZoom * 1.35, 2.8), 350);
              
              // 镜头拉近的同时，直接滑出面板/弹窗
              showCard(node.id);
            }, 200);

            State.fg.refresh?.();
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
          .graphData(graphData);

        // 🌟 屏幕方向检测：竖屏 vs 横屏
        const isPortrait = H > W;
        const aspectRatio = H / W; // 竖屏时 > 1，比如手机约 1.8~2.2

        // 缓存 root 节点引用，避免每帧 find() 的 O(n) 开销
        const cachedRoot = graphData.nodes.find(n => n.type === 'root');

        State.fg.d3Force('charge').strength(isMobile ? -550 : -520);
        State.fg.d3Force('link').distance(isMobile ? 120 : 130);
        State.fg.d3AlphaDecay(0.025);
        State.fg.d3VelocityDecay(0.38);

        // 自定义重力场：让 root 节点变得非常重
        State.fg.d3Force('rootMass', () => {
          if (cachedRoot) {
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

        // 1. 初始化瞬间，直接将镜头贴脸锁定在中心原点（零延迟）
        State.fg.centerAt(0, 0, 0);
        State.fg.zoom(isMobile ? 3.5 : 4.5, 0);

        // 2. 只给 Canvas 极短的 50ms 渲染上屏时间，随后立刻开始“平滑后撤”
        setTimeout(() => {
          if (!State.fg) return;
          
          let trackInterval;
          const maxFits = 30; // 增加追踪次数兜底
          let fitCount = 0;
          
          const doTracking = () => {
            if (!State.fg || fitCount >= maxFits) {
              clearInterval(trackInterval);
              return;
            }

            const nodes = State.fg.graphData().nodes;
            const allBorn = nodes.length > 0 && nodes.every(n => n._born);
            const padding = isMobile ? 24 : 100;
            
            // 【核心魔法】每次调用耗时 400ms，恰好等于定时器的间隔！
            // 这样前一次缩放刚好结束，后一次无缝接上，视觉上就是一条连贯顺滑的后撤曲线
            State.fg.zoomToFit(400, padding); 
            fitCount++;

            if (allBorn) {
              clearInterval(trackInterval);
              // 所有单词都爆出后，用一个超长动画做最终的完美居中定格
              setTimeout(() => {
                State.fg?.zoomToFit(1200, padding);
              }, 400);
            }
          };

          // 将追踪间隔从原先卡顿的 600ms 缩短为 400ms
          trackInterval = setInterval(doTracking, 400);
          doTracking(); // 0等待，立刻触发第一帧后撤！

          // --- 监听用户主动手势（触摸/滚轮），一旦干预立刻把控制权还给用户 ---
          const canvas = DOM.fgWrap.querySelector('canvas');
          if (canvas) {
            const onUserAct = () => {
              State.userInteracted = true;
              clearInterval(trackInterval);
              canvas.removeEventListener('wheel', onUserAct);
              canvas.removeEventListener('pointerdown', onUserAct);
            };
            canvas.addEventListener('wheel', onUserAct, { passive: true });
            canvas.addEventListener('pointerdown', onUserAct, { passive: true });

            State._removeUserActListeners = () => {
              clearInterval(trackInterval);
              canvas.removeEventListener('wheel', onUserAct);
              canvas.removeEventListener('pointerdown', onUserAct);
            };
          }
        }, 50); // 仅仅 50ms 缓冲，不再傻等半秒钟
      };

