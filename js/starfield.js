// ══ Starfield Animation ══
      // ══ Starfield ══
      (() => {
        const c = document.getElementById('starfield');
        if (!c) return;
        const ctx = c.getContext('2d');
        let stars = [];
        const COUNT = 100;
        State._starfieldActive = true;
        function resize() {
          c.width = window.innerWidth * devicePixelRatio;
          c.height = window.innerHeight * devicePixelRatio;
          c.style.width = window.innerWidth + 'px';
          c.style.height = window.innerHeight + 'px';
          ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        }
        function initStars() {
          resize(); stars = [];
          for (let i = 0; i < COUNT; i++) {
            stars.push({ x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight,
              r: Math.random()*1.1+0.3, a: Math.random()*0.4+0.12,
              speed: Math.random()*0.0008+0.0003, phase: Math.random()*Math.PI*2 });
          }
        }
        function draw(t) {
          if (State._starfieldActive) {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            stars.forEach(s => {
              const flicker = 0.5 + 0.5 * Math.sin(t * s.speed * 1000 + s.phase);
              ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(200, 195, 185, ${s.a * (0.6 + 0.4 * flicker)})`;
              ctx.fill();
            });
          }
          requestAnimationFrame(draw);
        }
        initStars(); window.addEventListener('resize', initStars); requestAnimationFrame(draw);
      })();

