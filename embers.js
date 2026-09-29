// ─────────────────────────────────────────────────────────────
//  떠오르는 불씨: 검은 허공 위로 금빛 입자가 천천히 오른다.
//  (천상 × 클라우드 트랜스의 "승천" 움직임. 무겁지 않게, 눈에 걸리지 않게.)
//  - 화면에 보일 때만 돌고, 탭이 숨겨지거나 움직임 줄이기 설정이면 멈춘다.
//  - 미리 그려 둔 빛 스프라이트를 찍어 내므로 휴대폰에서도 가볍다.
// ─────────────────────────────────────────────────────────────
export function createEmbers(canvas, { count = 24 } = {}) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let W = 0, H = 0, raf = 0, on = false, last = 0, parts = [];

  // 금빛 알갱이 스프라이트 (한 번만 그린다)
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
  { const g = sprite.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,236,200,1)'); grad.addColorStop(0.18, 'rgba(255,196,110,.85)'); grad.addColorStop(0.5, 'rgba(255,122,24,.22)'); grad.addColorStop(1, 'rgba(255,122,24,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64); }

  const spawn = (anywhere) => ({
    x: Math.random() * W, y: anywhere ? Math.random() * H : H + 20 + Math.random() * 60,
    size: 5 + Math.random() * 15,                 // 스프라이트를 찍는 지름(px)
    vy: 9 + Math.random() * 20,                   // 초당 올라가는 거리(px)
    sway: 5 + Math.random() * 14, phase: Math.random() * 6.28, speed: 0.4 + Math.random() * 0.9,
    a: 0.35 + Math.random() * 0.55,
  });

  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parts = Array.from({ length: count }, () => spawn(true));
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return;                    // 초당 약 30번
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y -= p.vy * dt; p.phase += p.speed * dt;
      if (p.y < -30) Object.assign(p, spawn(false));
      const x = p.x + Math.sin(p.phase) * p.sway;
      const rise = Math.min(1, Math.max(0, p.y / (H * 0.3)));       // 위로 갈수록 스러진다
      const twinkle = 0.65 + 0.35 * Math.sin(p.phase * 3.1);
      ctx.globalAlpha = p.a * rise * twinkle;
      ctx.drawImage(sprite, x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function run() { if (!raf && on && !document.hidden && !reduce.matches) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? halt() : run()));
  reduce.addEventListener?.('change', () => (reduce.matches ? (halt(), ctx.clearRect(0, 0, W, H)) : run()));

  return {
    /** 켜고 끈다. 끄면 천천히 사라지고 계산도 멈춘다. */
    set(v) {
      on = !!v;
      canvas.classList.toggle('on', on && !reduce.matches);
      if (on) run(); else halt();
    },
  };
}
