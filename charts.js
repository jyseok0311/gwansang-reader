// ─────────────────────────────────────────────────────────────
//  운세 그래프: 레이더 · 삼정 흐름선 · 오행 구성도 · 3D 운명 구성도(끌어서 돌려 보는 입체 그래프)
//  외부 라이브러리 없이 캔버스 2D 만으로 그린다 (오프라인·PWA 에서도 그대로 동작).
//  모든 그림은 "보일 때" 그려진다: 숨겨진 화면 안의 캔버스는 크기가 0 이므로 ResizeObserver 로 나타나는 순간을 잡는다.
// ─────────────────────────────────────────────────────────────
import { ELEMENTS } from './saju.js';
import { clamp } from './util.js';

const TAU = Math.PI * 2;
const ease = (t) => 1 - Math.pow(1 - t, 3);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const SERIF = '"Noto Serif KR", serif', SANS = '"Noto Sans KR", sans-serif';

/** 세 방면과 종합의 색. 밝은 화면(결과)에서는 무지갯빛 세 가지, 종합만 금빛. */
export const SRC_COLOR = { face: '#8a6bff', palm: '#4fc3ff', saju: '#ff6ad5', all: '#ffb24d' };
const INK = '#f4f1ea', GRID = 'rgba(244,241,234,.13)', MUTED = '#a6a39d';
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// 점수 → 반지름(0~1). 40점이 중심, 100점이 바깥 테두리
const LO = 40, HI = 100;
const rad = (s) => clamp((s - LO) / (HI - LO), 0, 1);

// ── 캔버스 도구 ──────────────────────────────────────────────
function fit(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return null;
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/**
 * 캔버스가 화면에 나타날 때마다 draw(ctx, w, h, k) 를 0→1 로 그려 자라나게 한다.
 * 움직임 줄이기 설정이나 숨겨진 탭에서는 완성된 모습을 바로 그린다.
 */
export function mountChart(canvas, draw, { dur = 800 } = {}) {
  canvas._chart?.stop();
  let raf = 0, k = 1, wasVisible = false;
  const paint = (kk) => { k = kk; const f = fit(canvas); if (f) draw(f.ctx, f.w, f.h, kk); };
  const play = () => {
    cancelAnimationFrame(raf);
    if (document.hidden || reduceMotion()) { paint(1); return; }
    const t0 = performance.now();
    const step = (now) => { const kk = clamp((now - t0) / dur, 0, 1); paint(ease(kk)); if (kk < 1) raf = requestAnimationFrame(step); };
    paint(0);
    raf = requestAnimationFrame(step);
  };
  const ro = new ResizeObserver(() => {
    const vis = canvas.clientWidth > 0 && canvas.clientHeight > 0;
    if (vis && !wasVisible) play();
    else if (vis) paint(k);
    wasVisible = vis;
  });
  ro.observe(canvas);
  canvas._chart = { stop() { ro.disconnect(); cancelAnimationFrame(raf); } };
  return canvas._chart;
}

function label(ctx, text, x, y, { size = 13, color = INK, align = 'center', weight = 500, font = SANS, base = 'middle' } = {}) {
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(text, x, y);
}

// ── 1. 레이더 (인생 영역별) ──────────────────────────────────
/**
 * @param axes   [{ label }]
 * @param series [{ color, values:number[], label?, glow? }]  뒤에 오는 것이 위에 그려진다
 */
export function drawRadar(ctx, w, h, k, { axes, series, showValues = true, fs: fsOpt }) {
  const n = axes.length, fs = fsOpt || clamp(w / 24, 11, 15);
  ctx.font = `700 ${fs}px ${SANS}`;
  const mw = Math.max(...axes.map(a => ctx.measureText(a.label).width));      // 가장 긴 축 이름의 너비
  const cx = w / 2, cy = h / 2, R = Math.min(w / 2 - mw - fs * 1.4, h / 2 - fs * 3.2);
  const ang = (i) => -Math.PI / 2 + i * TAU / n;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * R * r, cy + Math.sin(ang(i)) * R * r];
  const poly = (rs) => { ctx.beginPath(); rs.forEach((r, i) => { const [x, y] = pt(i, r); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };

  // 격자: 60·80·100점 고리와 축
  ctx.lineWidth = 1;
  for (const s of [60, 80, 100]) {
    poly(axes.map(() => rad(s)));
    ctx.strokeStyle = s === 100 ? 'rgba(244,241,234,.24)' : GRID; ctx.stroke();
  }
  ctx.strokeStyle = GRID;
  axes.forEach((_, i) => { const [x, y] = pt(i, 1); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); });
  for (const s of [60, 80]) label(ctx, String(s), cx + 4, cy - R * rad(s) - 1, { size: fs * 0.72, color: 'rgba(244,241,234,.38)', align: 'left', base: 'bottom' });

  // 자료
  series.forEach((s, si) => {
    const rs = s.values.map(v => rad(v) * k);
    poly(rs);
    ctx.fillStyle = rgba(s.color, s.glow ? 0.22 : 0.13); ctx.fill();
    ctx.save();
    if (s.glow) { ctx.shadowColor = rgba(s.color, 0.85); ctx.shadowBlur = 14; }
    ctx.lineWidth = s.glow ? 2.6 : 1.8; ctx.strokeStyle = s.color; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
    rs.forEach((r, i) => { const [x, y] = pt(i, r); ctx.beginPath(); ctx.arc(x, y, s.glow ? 4 : 3, 0, TAU); ctx.fillStyle = s.color; ctx.fill(); });
  });

  // 축 이름 (+ 마지막 자료의 점수)
  const top = series[series.length - 1];
  axes.forEach((a, i) => {
    const [x, y] = pt(i, 1.0), dx = Math.cos(ang(i)), dy = Math.sin(ang(i));
    const lx = x + dx * fs * 1.1, ly = y + dy * fs * 1.25;
    const al = Math.abs(dx) < 0.3 ? 'center' : dx > 0 ? 'left' : 'right';
    label(ctx, a.label, lx, ly - (showValues ? fs * 0.45 : 0), { size: fs, align: al, weight: 700 });
    if (showValues && top) label(ctx, String(top.values[i]), lx, ly + fs * 0.85, { size: fs * 0.95, align: al, color: top.color, weight: 700, font: SERIF });
  });
}

// ── 2. 삼정 흐름선 (초년·중년·말년) ──────────────────────────
/** @param points [{ name, sub, value, best }]  value 는 표준(100)에 대한 지수 */
export function drawFlow(ctx, w, h, k, { points, min = 80, max = 120 }) {
  const fs = clamp(w / 26, 11, 14), padT = fs * 2.2, padB = fs * 3.4;
  const gx = (i) => w * (0.17 + 0.66 * i / (points.length - 1)), gy = (v) => padT + (1 - clamp((v - min) / (max - min), 0, 1)) * (h - padT - padB);
  // 기준선(100 = 표준)
  const y100 = gy(100);
  ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(244,241,234,.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w * 0.05, y100); ctx.lineTo(w * 0.95, y100); ctx.stroke(); ctx.setLineDash([]);
  label(ctx, '표준', w * 0.05, y100 - fs * 0.7, { size: fs * 0.78, color: 'rgba(244,241,234,.4)', align: 'left' });

  const P = points.map((p, i) => ({ x: gx(i), y: gy(p.value) }));
  // 세 점 사이를 부드러운 곡선으로 (양 끝은 수평으로 뻗음)
  const ext = [{ x: w * 0.04, y: P[0].y }, ...P, { x: w * 0.96, y: P[P.length - 1].y }];
  const path = new Path2D();
  path.moveTo(ext[0].x, ext[0].y);
  for (let i = 0; i < ext.length - 1; i++) {
    const a = ext[i], b = ext[i + 1], mx = (a.x + b.x) / 2;
    path.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w * k, h); ctx.clip();          // 왼쪽에서 오른쪽으로 그려진다
  const fill = new Path2D(path); fill.lineTo(ext[ext.length - 1].x, h - padB); fill.lineTo(ext[0].x, h - padB); fill.closePath();
  const g = ctx.createLinearGradient(0, padT, 0, h - padB); g.addColorStop(0, rgba(SRC_COLOR.all, 0.32)); g.addColorStop(1, rgba(SRC_COLOR.all, 0));
  ctx.fillStyle = g; ctx.fill(fill);
  ctx.shadowColor = rgba(SRC_COLOR.all, 0.7); ctx.shadowBlur = 12;
  ctx.lineWidth = 2.6; ctx.strokeStyle = SRC_COLOR.all; ctx.lineCap = 'round'; ctx.stroke(path);
  ctx.restore();

  points.forEach((p, i) => {
    const { x, y } = P[i], on = (x / w) <= k + 0.02;
    if (!on) return;
    ctx.beginPath(); ctx.arc(x, y, p.best ? 7 : 5, 0, TAU); ctx.fillStyle = p.best ? '#fff' : '#0a0b12'; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = SRC_COLOR.all; ctx.stroke();
    label(ctx, String(p.value), x, y - (p.best ? 17 : 15), { size: fs * 1.1, weight: 700, font: SERIF, color: p.best ? '#fff' : SRC_COLOR.all });
    label(ctx, p.name, x, h - padB + fs * 1.3, { size: fs, weight: 700 });
    label(ctx, p.sub, x, h - padB + fs * 2.55, { size: fs * 0.82, color: MUTED });
  });
}

// ── 2-2. 월별 운세 꺾은선 (열두 달) ──────────────────────────
/** @param values 열두 달 점수, current 이번 달(1~12), selected 고른 달 */
export function drawMonthly(ctx, w, h, k, { values, current, selected, min = 50, max = 95 }) {
  const n = values.length, fs = clamp(w / 30, 10, 13), padT = fs * 2.4, padB = fs * 2.8, padX = w * 0.06;
  const gx = (i) => padX + (w - padX * 2) * i / (n - 1), gy = (v) => padT + (1 - clamp((v - min) / (max - min), 0, 1)) * (h - padT - padB);
  ctx.setLineDash([3, 5]); ctx.lineWidth = 1; ctx.strokeStyle = GRID;
  for (const v of [60, 70, 80, 90]) { ctx.beginPath(); ctx.moveTo(padX * 0.5, gy(v)); ctx.lineTo(w - padX * 0.5, gy(v)); ctx.stroke(); }
  ctx.setLineDash([]);
  const P = values.map((v, i) => ({ x: gx(i), y: gy(v) }));
  const path = new Path2D(); path.moveTo(P[0].x, P[0].y);
  for (let i = 0; i < n - 1; i++) { const a = P[i], b = P[i + 1], mx = (a.x + b.x) / 2; path.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y); }
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w * k, h); ctx.clip();
  const fill = new Path2D(path); fill.lineTo(P[n - 1].x, h - padB); fill.lineTo(P[0].x, h - padB); fill.closePath();
  const g = ctx.createLinearGradient(0, padT, 0, h - padB); g.addColorStop(0, rgba(SRC_COLOR.all, 0.3)); g.addColorStop(1, rgba(SRC_COLOR.all, 0));
  ctx.fillStyle = g; ctx.fill(fill);
  ctx.shadowColor = rgba(SRC_COLOR.all, 0.7); ctx.shadowBlur = 10; ctx.lineWidth = 2.4; ctx.strokeStyle = SRC_COLOR.all; ctx.lineJoin = 'round'; ctx.stroke(path);
  ctx.restore();
  const hi = Math.max(...values), lo = Math.min(...values);
  values.forEach((v, i) => {
    if (P[i].x / w > k + 0.02) return;
    const isSel = i + 1 === selected, isCur = i + 1 === current;
    ctx.beginPath(); ctx.arc(P[i].x, P[i].y, isSel ? 5.5 : 3.2, 0, TAU); ctx.fillStyle = isSel ? '#fff' : SRC_COLOR.all; ctx.fill();
    if (isCur) { ctx.beginPath(); ctx.arc(P[i].x, P[i].y, 8.5, 0, TAU); ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffd08a'; ctx.stroke(); }
    if (isSel || v === hi || v === lo) label(ctx, String(v), P[i].x, P[i].y - (isSel ? 15 : 12), { size: fs * 1.05, weight: 700, font: SERIF, color: isSel ? '#fff' : (v === hi ? '#ffd08a' : MUTED) });
    label(ctx, String(i + 1), P[i].x, h - padB + fs * 1.4, { size: fs * 0.95, weight: isCur ? 700 : 500, color: isCur ? '#ffd08a' : MUTED });
  });
  label(ctx, '월', w - padX * 0.2, h - padB + fs * 1.4, { size: fs * 0.85, color: MUTED, align: 'right' });
}

// ── 3. 오행 구성도 (상생·상극과 세 방면의 자리) ───────────────
const EL_ORDER = ['wood', 'fire', 'earth', 'metal', 'water'];     // 시계 방향으로 상생
const SRC_GLYPH = { face: '相', palm: '手', saju: '命' };
/**
 * @param markers [{ src, el }]  관상·손금·사주가 각각 어느 오행에 앉는지
 * @param counts  사주의 오행별 글자 수(있으면 원의 크기로 보여 주고 빈 오행은 점선으로)
 */
export function drawElementMap(ctx, w, h, k, { markers = [], counts = null }) {
  const fs = clamp(w / 26, 11, 14);
  const cx = w / 2, cy = h / 2 + fs * 0.3, R = Math.min(w, h) * 0.34;
  const P = EL_ORDER.map((_, i) => { const a = -Math.PI / 2 + i * TAU / 5; return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a }; });
  const nr = (e) => R * (counts ? 0.15 + 0.035 * Math.min(4, counts[e] || 0) : 0.19);

  // 상극: 별 모양(한 칸 건너뛰는 선), 점선
  ctx.globalAlpha = k;
  ctx.setLineDash([3, 6]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,110,110,.42)';
  for (let i = 0; i < 5; i++) { const a = P[i], b = P[(i + 2) % 5]; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.setLineDash([]);
  // 상생: 바깥 오각형을 따라 화살표
  ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(255,208,138,.75)'; ctx.fillStyle = 'rgba(255,208,138,.9)';
  for (let i = 0; i < 5; i++) {
    const a = P[i], b = P[(i + 1) % 5], e = EL_ORDER[i], f = EL_ORDER[(i + 1) % 5];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const x0 = a.x + ux * (nr(e) + 4), y0 = a.y + uy * (nr(e) + 4), x1 = b.x - ux * (nr(f) + 5), y1 = b.y - uy * (nr(f) + 5);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * 9 - uy * 4.5, y1 - uy * 9 + ux * 4.5); ctx.lineTo(x1 - ux * 9 + uy * 4.5, y1 - uy * 9 - ux * 4.5); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 오행 원
  EL_ORDER.forEach((e, i) => {
    const { x, y } = P[i], E = ELEMENTS[e], r = nr(e) * (0.6 + 0.4 * k), empty = counts && !counts[e];
    const has = markers.filter(m => m.el === e).length > 0;
    ctx.save();
    if (has || (counts && counts[e])) { ctx.shadowColor = rgba(E.color, 0.75); ctx.shadowBlur = has ? 22 : 10; }
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = empty ? 'rgba(244,241,234,.03)' : rgba(E.color, has ? 0.3 : 0.16); ctx.fill();
    ctx.restore();
    ctx.lineWidth = has ? 2.6 : 1.5; ctx.setLineDash(empty ? [3, 4] : []); ctx.strokeStyle = empty ? 'rgba(244,241,234,.35)' : E.color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, E.hanja, x, y - (counts ? fs * 0.15 : 0), { size: clamp(r * 0.95, 14, 30), weight: 900, font: SERIF, color: empty ? 'rgba(244,241,234,.5)' : INK });
    if (counts) label(ctx, empty ? '비어 있음' : `${counts[e]}글자`, x, y + r * 0.62, { size: fs * 0.72, color: empty ? '#ff9a9a' : MUTED });
    if (!has) label(ctx, E.name, x + Math.cos(P[i].a) * (r + fs * 1.2), y + Math.sin(P[i].a) * (r + fs * 1.05), { size: fs * 0.9, color: MUTED });
  });

  // 세 방면의 자리표: 같은 오행에 앉은 것끼리 나란히
  const seen = {};
  markers.forEach((m) => {
    const i = EL_ORDER.indexOf(m.el), { x, y, a } = P[i], slot = seen[m.el] = (seen[m.el] || 0) + 1;
    const r = nr(m.el), rr = fs * 0.95;
    const off = (slot - 1) * (rr * 2 + 3) - (markers.filter(q => q.el === m.el).length - 1) * (rr + 1.5);
    const bx = x + Math.cos(a) * (r + rr + fs * 2.6) - Math.sin(a) * off, by = y + Math.sin(a) * (r + rr + fs * 2.6) + Math.cos(a) * off;
    const px = clamp(bx, rr + 2, w - rr - 2), py = clamp(by, rr + 2, h - rr - 2);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.shadowColor = rgba(SRC_COLOR[m.src], 0.8); ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fillStyle = SRC_COLOR[m.src]; ctx.fill();
    ctx.restore();
    label(ctx, SRC_GLYPH[m.src], px, py + 0.5, { size: rr * 1.15, weight: 900, font: SERIF, color: '#0a0b12' });
  });
}

// ── 4. 3D 운명 구성도 ────────────────────────────────────────
/**
 * 다섯 가지 운을 오각 기둥으로 세우고, 사주·손금·관상·종합을 층층이 쌓아 서로 겹쳐 본다.
 * 좌우로 끌면 돌아가고, 손을 떼면 천천히 돈다. 위층일수록 종합에 가깝다.
 * @param layers [{ label, color, values, top? }]  아래에서 위 순서
 */
export function createOrrery(canvas, { axes, layers }) {
  canvas._chart?.stop();
  const n = axes.length, L = layers.length;
  const st = { yaw: 0.5, vel: 0, drag: false, lastX: 0, idleUntil: 0, raf: 0, on: false, seen: false, appear: 1, appearT0: 0 };
  const PITCH = 0.62, DIST = 3.6, GAP = L > 1 ? Math.min(0.5, 1.5 / (L - 1)) : 0;
  const yOf = (j) => (j - (L - 1) / 2) * GAP;
  const ang = (i) => -Math.PI / 2 + i * TAU / n;

  function draw(ctx, w, h, k) {
    const fs = clamp(w / 26, 11, 14), scale = Math.min(w * 0.33, h * 0.42), cx = w * 0.56, cy = h * 0.5;
    const cyaw = Math.cos(st.yaw), syaw = Math.sin(st.yaw), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
    const proj = (x, y, z) => {
      const X = x * cyaw + z * syaw, Z = -x * syaw + z * cyaw;             // 위아래 축(y)을 중심으로 회전
      const Y = y * cp - Z * sp, Z2 = y * sp + Z * cp;                      // 위에서 내려다보는 각도
      const s = DIST / (DIST + Z2);
      return { x: cx + X * scale * s, y: cy - Y * scale * s, z: Z2, s };
    };
    const ring = (y, r) => Array.from({ length: n }, (_, i) => proj(Math.cos(ang(i)) * r, y, Math.sin(ang(i)) * r));
    const strokePoly = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };

    // 바닥 격자(60·80·100점)와 다섯 개의 기둥
    const yb = yOf(0) - 0.18, yt = yOf(L - 1) + 0.12;
    ctx.lineWidth = 1;
    for (const s of [60, 80, 100]) { strokePoly(ring(yb, rad(s))); ctx.strokeStyle = s === 100 ? 'rgba(244,241,234,.26)' : GRID; ctx.stroke(); }
    const spokeBase = ring(yb, 1), spokeTop = ring(yt, 1);
    ctx.strokeStyle = 'rgba(244,241,234,.16)';
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(spokeBase[i].x, spokeBase[i].y); ctx.lineTo(spokeTop[i].x, spokeTop[i].y); ctx.stroke(); const c = proj(0, yb, 0); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(spokeBase[i].x, spokeBase[i].y); ctx.stroke(); }

    // 층: 정점 좌표
    const V = layers.map((ly, j) => ly.values.map((v, i) => { const r = rad(v) * k; return proj(Math.cos(ang(i)) * r, yOf(j), Math.sin(ang(i)) * r); }));

    // 같은 영역끼리 위아래로 잇는 선 — 층마다 점수가 얼마나 어긋나는지 한눈에 보인다
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < L - 1; j++) {
      const g = ctx.createLinearGradient(V[j][i].x, V[j][i].y, V[j + 1][i].x, V[j + 1][i].y);
      g.addColorStop(0, rgba(layers[j].color, 0.5)); g.addColorStop(1, rgba(layers[j + 1].color, 0.5));
      ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(V[j][i].x, V[j][i].y); ctx.lineTo(V[j + 1][i].x, V[j + 1][i].y); ctx.stroke();
    }
    // 아래층부터 위층 순으로 (위에서 내려다보므로 위층이 앞)
    layers.forEach((ly, j) => {
      ctx.save();
      strokePoly(V[j]);
      ctx.fillStyle = rgba(ly.color, ly.top ? 0.30 : 0.20); ctx.fill();
      if (ly.top) { ctx.shadowColor = rgba(ly.color, 0.9); ctx.shadowBlur = 18; }
      ctx.lineWidth = ly.top ? 2.8 : 2; ctx.strokeStyle = ly.color; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
      V[j].forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, (ly.top ? 4.6 : 3.4) * p.s, 0, TAU); ctx.fillStyle = ly.top ? '#fff' : ly.color; ctx.fill();
        if (ly.top && k > 0.9) label(ctx, String(ly.values[i]), p.x, p.y - fs * 1.05, { size: fs, weight: 700, font: SERIF, color: '#fff' });
      });
    });

    // 축 이름 (바닥 테두리 바깥)
    axes.forEach((a, i) => {
      const o = proj(Math.cos(ang(i)) * 1.18, yb, Math.sin(ang(i)) * 1.18);
      ctx.font = `700 ${fs}px ${SANS}`; const hw = ctx.measureText(a.label).width / 2 + 4;
      label(ctx, a.label, clamp(o.x, hw, w - hw), o.y, { size: fs, weight: 700 });
    });
    // 층 이름표: 회전해도 제자리(왼쪽)에서 읽히도록 화면 좌표에 고정
    layers.forEach((ly, j) => {
      const c = proj(0, yOf(j), 0);
      ctx.beginPath(); ctx.arc(10, c.y, 4, 0, TAU); ctx.fillStyle = ly.color; ctx.fill();
      label(ctx, ly.label, 20, c.y, { size: fs * 0.95, align: 'left', weight: ly.top ? 700 : 500, color: ly.top ? ly.color : INK });
      ctx.strokeStyle = rgba(ly.color, 0.25); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(20 + ctx.measureText(ly.label).width + 6, c.y); ctx.lineTo(c.x - scale * 0.45 * c.s, c.y); ctx.stroke(); ctx.setLineDash([]);
    });
  }

  const paint = () => { const f = fit(canvas); if (f) draw(f.ctx, f.w, f.h, st.appear); };
  let last = 0;
  function frame(now) {
    st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (st.appear < 1) st.appear = ease(clamp((now - st.appearT0) / 1000, 0, 1));
    if (!st.drag) {
      if (Math.abs(st.vel) > 1e-4) { st.yaw += st.vel; st.vel *= 0.94; }
      else if (now > st.idleUntil && !reduceMotion()) st.yaw += 0.28 * dt;   // 천천히 도는 구름
    }
    paint();
  }
  const canRun = () => st.on && !document.hidden;
  const sync = () => { if (canRun() && !st.raf) { last = performance.now(); st.raf = requestAnimationFrame(frame); } else if (!canRun() && st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } };

  const ro = new ResizeObserver(() => {
    const vis = canvas.clientWidth > 0;
    if (vis && !st.seen) { st.seen = true; st.appear = document.hidden || reduceMotion() ? 1 : 0; st.appearT0 = performance.now(); }
    if (!vis) st.seen = false;
    paint();
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { st.on = es.some(e => e.isIntersecting); sync(); });
  io.observe(canvas);
  const onVis = () => { sync(); if (document.hidden) paint(); };
  document.addEventListener('visibilitychange', onVis);

  // 좌우로 끌어 돌리기 (세로 움직임은 화면 스크롤에 양보)
  const down = (e) => { st.drag = true; st.lastX = e.clientX; st.vel = 0; canvas.setPointerCapture?.(e.pointerId); canvas.classList.add('grab'); };
  const move = (e) => { if (!st.drag) return; const dx = e.clientX - st.lastX; st.lastX = e.clientX; st.yaw += dx * 0.011; st.vel = dx * 0.011; if (!st.raf) paint(); };
  const up = () => { if (!st.drag) return; st.drag = false; st.idleUntil = performance.now() + 2500; canvas.classList.remove('grab'); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { st.yaw += (e.key === 'ArrowLeft' ? -0.25 : 0.25); st.idleUntil = performance.now() + 2500; paint(); e.preventDefault(); } });

  canvas._chart = { stop() { ro.disconnect(); io.disconnect(); cancelAnimationFrame(st.raf); st.raf = 0; document.removeEventListener('visibilitychange', onVis); }, paint, state: st };
  return canvas._chart;
}

/** 결과 카드(이미지)에 넣을 레이더를 화면 밖 캔버스에 완성된 모습으로 그려 돌려준다 */
export function renderRadarImage(size, opts) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  drawRadar(ctx, size, size, 1, opts);
  return cv;
}
