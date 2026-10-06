// ─────────────────────────────────────────────────────────────
//  손금 분석: 손 관절점(21개)으로 손바닥을 똑바로 펴고, 주름(어두운 가는 선)을 찾아
//  생명선·두뇌선·감정선(·운명선)을 해부학적 위치를 기준으로 따라가며 특징을 잰다.
//  DOM 의존성 없음 → Node 에서도 시험 가능. 입력 영상은 {data(RGBA), width, height}.
// ─────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ── 1. 손바닥 좌표계 ─────────────────────────────────────────
// 손의 세로축: 중지 뿌리(9번)에서 손목(0번)으로 향하는 방향. 가로축은 그에 수직이고 검지 쪽에서 새끼 쪽으로.
// 좌표 (a, b): a = 0(검지 뿌리) ~ 1(새끼 뿌리), b = 0(중지 뿌리) ~ 1(손목 관절점).
// 어느 손이든, 손바닥·손등 어느 쪽을 찍었든 "엄지 쪽이 a<0, 손목이 b=1" 인 같은 틀로 펴진다.
export function palmFrame(lm) {
  const P0 = lm[0], P5 = lm[5], P9 = lm[9], P17 = lm[17];
  const ax = { x: P0.x - P9.x, y: P0.y - P9.y };
  const L = Math.hypot(ax.x, ax.y);
  const d = { x: ax.x / L, y: ax.y / L };                       // 손목 방향 단위벡터
  let u = { x: -d.y, y: d.x };                                  // 가로 단위벡터 (검지→새끼 쪽이 +)
  if ((P17.x - P5.x) * u.x + (P17.y - P5.y) * u.y < 0) u = { x: -u.x, y: -u.y };
  const W = (P17.x - P5.x) * u.x + (P17.y - P5.y) * u.y;         // 검지~새끼 뿌리 너비(가로축 성분)
  // 좌표 원점: a=0 이 검지 뿌리를 지나고 b=0 이 중지 뿌리를 지나도록 한다
  const O = { x: P5.x + ((P9.x - P5.x) * d.x + (P9.y - P5.y) * d.y) * d.x, y: P5.y + ((P9.x - P5.x) * d.x + (P9.y - P5.y) * d.y) * d.y };
  return { O, U: { x: u.x * W, y: u.y * W }, d, dv: { x: d.x * L, y: d.y * L }, W, L, rho: L / W };
}
/** 손바닥 좌표 → 영상 좌표 */
export const palmToImage = (f, a, b) => ({ x: f.O.x + a * f.U.x + b * f.dv.x, y: f.O.y + a * f.U.y + b * f.dv.y });
/** 영상 좌표 → 손바닥 좌표 */
export function imageToPalm(f, p) {
  const dx = p.x - f.O.x, dy = p.y - f.O.y;
  return { a: (dx * f.U.x + dy * f.U.y) / (f.W * f.W), b: (dx * f.dv.x + dy * f.dv.y) / (f.L * f.L) };
}

// 펴 놓은 손바닥의 범위 (손바닥 좌표)
const A0 = -0.45, A1 = 1.15, B0 = -0.03, B1 = 1.14;
const NX = 240;   // 펴 놓은 영상 가로 픽셀 수

/** 손바닥을 똑바로 펴서 회색조 영상으로 만든다. 반환 좌표계: 픽셀 (x, y) ↔ 손바닥 (a, b) */
export function warpPalm(img, lm) {
  const f = palmFrame(lm);
  const ps = (A1 - A0) * f.W / NX;                  // 펴진 영상 1픽셀 = 원본 몇 픽셀
  const NY = Math.round((B1 - B0) * f.L / ps);
  const k = clamp(Math.round(ps / 1.3), 1, 4);      // 줄여서 뽑을 때는 k×k 지점을 평균 (앨리어싱 방지)
  const { data, width: W, height: H } = img;
  const out = new Float32Array(NX * NY);
  const mask = new Uint8Array(NX * NY);
  const luma = (x, y) => {                          // 이중선형 보간
    const x0 = Math.floor(x), y0 = Math.floor(y);
    if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) return -1;
    const tx = x - x0, ty = y - y0, i = (y0 * W + x0) * 4;
    const v = (o) => 0.299 * data[i + o] + 0.587 * data[i + o + 1] + 0.114 * data[i + o + 2];
    const v00 = v(0), v10 = v(4), v01 = v(W * 4), v11 = v(W * 4 + 4);
    return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
  };
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    let sum = 0, n = 0;
    for (let sy = 0; sy < k; sy++) for (let sx = 0; sx < k; sx++) {
      const a = A0 + ((x + (sx + 0.5) / k) / NX) * (A1 - A0);
      const b = B0 + ((y + (sy + 0.5) / k) / NY) * (B1 - B0);
      const p = palmToImage(f, a, b), v = luma(p.x, p.y);
      if (v >= 0) { sum += v; n++; }
    }
    if (n) { out[y * NX + x] = sum / n; mask[y * NX + x] = 1; }
  }
  return { gray: out, valid: mask, nx: NX, ny: NY, frame: f, ps, toPalm: (x, y) => ({ a: A0 + (x + 0.5) / NX * (A1 - A0), b: B0 + (y + 0.5) / NY * (B1 - B0) }), toPix: (a, b) => ({ x: (a - A0) / (A1 - A0) * NX - 0.5, y: (b - B0) / (B1 - B0) * NY - 0.5 }) };
}

// ── 2. 선(어두운 가는 골) 세기 지도 ──────────────────────────
function gaussKernel(sigma, order) {
  const r = Math.ceil(sigma * 3), k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) {
    const g = Math.exp(-i * i / (2 * sigma * sigma));
    k[i + r] = order === 0 ? g : order === 1 ? -i / (sigma * sigma) * g : (i * i / (sigma ** 4) - 1 / (sigma * sigma)) * g;
    s += order === 0 ? g : 0;
  }
  if (order === 0) for (let i = 0; i < k.length; i++) k[i] /= s;
  else if (order === 2) { let m = 0; for (const v of k) m += v; m /= k.length; for (let i = 0; i < k.length; i++) k[i] -= m; }   // 합이 0 이 되게
  return k;
}
function convSep(src, nx, ny, kx, ky) {
  const rx = (kx.length - 1) / 2, ry = (ky.length - 1) / 2;
  const tmp = new Float32Array(nx * ny), out = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    let s = 0; for (let i = -rx; i <= rx; i++) s += kx[i + rx] * src[y * nx + clamp(x + i, 0, nx - 1)];
    tmp[y * nx + x] = s;
  }
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    let s = 0; for (let i = -ry; i <= ry; i++) s += ky[i + ry] * tmp[clamp(y + i, 0, ny - 1) * nx + x];
    out[y * nx + x] = s;
  }
  return out;
}
const blur = (src, nx, ny, sigma) => { const k = gaussKernel(sigma, 0); return convSep(src, nx, ny, k, k); };

/**
 * 어두운 가는 선의 세기 지도.
 * 조명 얼룩을 지우고(국소 정규화), 12개 방향으로 길게 늘인 골 검출기로 긴 선은 살리고 짧은 피부결 잡음은 누른다.
 * 반환: ridge(선 세기), theta(가장 센 방향 인덱스 0~11), z(정규화된 명암)
 */
export function ridgeMap(warp, mask) {
  const { gray, nx, ny } = warp;
  const bg = blur(gray, nx, ny, 14);
  const hp = new Float32Array(nx * ny);
  for (let i = 0; i < hp.length; i++) hp[i] = mask[i] ? gray[i] - bg[i] : 0;
  const sq = new Float32Array(nx * ny); for (let i = 0; i < sq.length; i++) sq[i] = hp[i] * hp[i];
  const sd = blur(sq, nx, ny, 14);
  const z = new Float32Array(nx * ny);
  for (let i = 0; i < z.length; i++) z[i] = mask[i] ? hp[i] / (Math.sqrt(sd[i]) + 2.5) : 0;

  const B = blur(z, nx, ny, 1.7);
  const at = (img, x, y) => {                       // 이중선형 보간, 범위 밖은 가장자리 값
    x = clamp(x, 0, nx - 1.001); y = clamp(y, 0, ny - 1.001);
    const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, i = y0 * nx + x0;
    return (img[i] * (1 - tx) + img[i + 1] * tx) * (1 - ty) + (img[i + nx] * (1 - tx) + img[i + nx + 1] * tx) * ty;
  };
  const NT = 12, S = 2.1, T = 18, STEP = 2;
  const wts = []; let ws = 0;
  for (let t = -T; t <= T; t += STEP) { const w = Math.exp(-t * t / (2 * 6.5 * 6.5)); wts.push([t, w]); ws += w; }
  const R = []; 
  for (let k = 0; k < NT; k++) {
    const th = k * Math.PI / NT, dx = Math.cos(th), dy = Math.sin(th), nxv = -dy, nyv = dx;
    const D = new Float32Array(nx * ny);            // 선과 직각 방향의 2차 차분 (골이면 양수)
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++)
      D[y * nx + x] = 2 * B[y * nx + x] - at(B, x + S * nxv, y + S * nyv) - at(B, x - S * nxv, y - S * nyv);
    const Rk = new Float32Array(nx * ny);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      let s = 0; for (const [t, w] of wts) s += w * at(D, x + t * dx, y + t * dy);
      Rk[y * nx + x] = s / ws;
    }
    R.push(Rk);
  }
  const ridge = new Float32Array(nx * ny), theta = new Uint8Array(nx * ny);
  for (let i = 0; i < ridge.length; i++) {
    let best = -1e9, bk = 0;
    for (let k = 0; k < NT; k++) if (R[k][i] > best) { best = R[k][i]; bk = k; }
    const perp = R[(bk + NT / 2) % NT][i];
    const v = best - 0.5 * Math.max(0, perp);       // 한 방향으로만 뻗은 선일수록 세다
    ridge[i] = mask[i] ? Math.max(0, v) : 0;
    theta[i] = bk;
  }
  return { ridge, theta, z };
}

// ── 3. 손바닥 안쪽 마스크 ────────────────────────────────────
/** 손바닥 다각형(손바닥 좌표) 안쪽만 1. 손 가장자리·손가락 뿌리 주름은 제외한다. */
export function palmMask(warp, lm) {
  const f = warp.frame, nx = warp.nx, ny = warp.ny;
  const P = (i) => imageToPalm(f, lm[i]);
  const p1 = P(1), p2 = P(2), p5 = P(5);
  const poly = [
    { a: -0.04, b: 0.10 }, { a: 0.36, b: 0.07 }, { a: 0.70, b: 0.13 }, { a: 1.02, b: 0.22 },        // 손가락 뿌리 아래
    { a: 1.06, b: 0.48 }, { a: 0.96, b: 0.80 }, { a: 0.80, b: 1.02 },                             // 새끼 쪽 가장자리
    { a: P(0).a - 0.34, b: 1.02 }, { a: p1.a + 0.10, b: p1.b + 0.06 }, { a: p2.a + 0.14, b: p2.b + 0.02 },  // 손목 → 엄지 뿌리
    { a: (p2.a + p5.a) / 2 + 0.05, b: (p2.b + p5.b) / 2 + 0.04 },                                // 엄지·검지 사이
  ];
  const inside = (a, b) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const pi = poly[i], pj = poly[j];
      if ((pi.b > b) !== (pj.b > b) && a < (pj.a - pi.a) * (b - pi.b) / (pj.b - pi.b) + pi.a) c = !c;
    }
    return c;
  };
  const m = new Uint8Array(nx * ny);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const q = warp.toPalm(x, y);
    m[y * nx + x] = warp.valid[y * nx + x] && inside(q.a, q.b) ? 1 : 0;
  }
  // 가장자리 6픽셀은 빼서 윤곽선 그림자가 선으로 잡히지 않게 한다
  const er = new Uint8Array(nx * ny), R = 6;
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    if (!m[y * nx + x]) continue;
    let ok = true;
    for (let k = 0; k < 8 && ok; k++) { const t = k * Math.PI / 4, xx = Math.round(x + R * Math.cos(t)), yy = Math.round(y + R * Math.sin(t)); if (xx < 0 || yy < 0 || xx >= nx || yy >= ny || !m[yy * nx + xx]) ok = false; }
    er[y * nx + x] = ok ? 1 : 0;
  }
  return { mask: er, poly };
}

// ── 4. 선 따라가기 (해부학적 위치 안에서 가장 뚜렷한 길) ─────
// 각 선이 있을 만한 위치를 손바닥 좌표 꺾은선으로 정해 두고, 그 주변(회랑) 안에서
// "선 세기가 큰 길일수록 싸다" 는 비용으로 시작 지점~끝 지점의 최저 비용 경로를 찾는다.
// 손바닥 좌표 단위: a 는 손바닥 너비 W, b 는 손바닥 길이 L (세로 거리는 rho = L/W 를 곱해 W 단위로 맞춘다)
export const LINE_PRIORS = {
  heart: { name: '감정선', hanja: '感情線', pts: [[1.05, 0.40], [0.85, 0.30], [0.62, 0.21], [0.42, 0.155], [0.22, 0.14], [0.08, 0.17]], tol: 0.17 },
  head: { name: '두뇌선', hanja: '頭腦線', pts: [[-0.05, 0.35], [0.20, 0.40], [0.50, 0.47], [0.75, 0.55], [0.92, 0.62]], tol: 0.17 },
  life: { name: '생명선', hanja: '生命線', pts: [[0.0, 0.28], [0.20, 0.42], [0.31, 0.58], [0.31, 0.78], [0.22, 1.0]], tol: 0.16 },
  fate: { name: '운명선', hanja: '運命線', pts: [[0.36, 1.0], [0.37, 0.75], [0.38, 0.55], [0.38, 0.32]], tol: 0.10 },
};

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; }
    return top;
  }
  get size() { return this.k.length; }
}

function distToPolyline(px, py, poly) {                       // poly: [{x,y}] 같은 단위
  let best = 1e9;
  for (let i = 0; i < poly.length - 1; i++) {
    const ax = poly[i].x, ay = poly[i].y, bx = poly[i + 1].x, by = poly[i + 1].y;
    const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}

/**
 * 한 선을 따라간다.
 * @param cost 픽셀별 이동 비용, @param avoid 이미 잡힌 다른 선 근처에 주는 벌점 지도(없으면 null)
 */
function traceLine(warp, prior, ridgeN, mask, avoid, opts = {}) {
  const limitY = opts.limitY || null;                       // 열(x)별로 y 가 이 값보다 작아야 한다 (없으면 null)
  const { nx, ny, frame } = warp, rho = frame.rho;
  const polyW = prior.pts.map(([a, b]) => ({ x: a, y: b * rho }));         // W 단위
  // 회랑: 손바닥 좌표에서 꺾은선까지의 거리가 tol 이내
  const allowed = new Uint8Array(nx * ny), prox = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x; if (!mask[i]) continue;
    const q = warp.toPalm(x, y), d = distToPolyline(q.a, q.b * rho, polyW);
    if (d <= prior.tol && !(limitY && limitY[x] < 1e8 && y > limitY[x] - 7)) { allowed[i] = 1; prox[i] = d / prior.tol; }
  }
  const first = prior.pts[0], last = prior.pts[prior.pts.length - 1];
  const zone = (pt, r) => { const c = warp.toPix(pt[0], pt[1]); const out = []; const rp = r * nx / (A1 - A0); for (let y = Math.max(0, Math.floor(c.y - rp * 1.3)); y <= Math.min(ny - 1, Math.ceil(c.y + rp * 1.3)); y++) for (let x = Math.max(0, Math.floor(c.x - rp)); x <= Math.min(nx - 1, Math.ceil(c.x + rp)); x++) if (allowed[y * nx + x]) out.push(y * nx + x); return out; };
  const S = zone(first, opts.startR ?? 0.07), E = new Set(zone(last, opts.endR ?? 0.07));
  if (!S.length || !E.size) return null;
  const dist = new Float32Array(nx * ny).fill(1e9), prev = new Int32Array(nx * ny).fill(-1);
  const heap = new MinHeap();
  const stepCost = (i) => (1 / (0.06 + ridgeN[i])) * (1 + 0.8 * prox[i]) + (avoid ? avoid[i] : 0);
  for (const i of S) { dist[i] = stepCost(i); heap.push(dist[i], i); }
  let goal = -1;
  while (heap.size) {
    const i = heap.pop();
    if (E.has(i)) { goal = i; break; }
    const x = i % nx, y = (i / nx) | 0, di = dist[i];
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const xx = x + ox, yy = y + oy; if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue;
      const j = yy * nx + xx; if (!allowed[j]) continue;
      const nd = di + stepCost(j) * (ox && oy ? 1.414 : 1);
      if (nd < dist[j]) { dist[j] = nd; prev[j] = i; heap.push(nd, j); }
    }
  }
  if (goal < 0) return null;
  const path = []; for (let i = goal; i >= 0; i = prev[i]) path.push({ x: i % nx, y: (i / nx) | 0 });
  path.reverse();
  return path;
}

function smoothPath(p, n = 4) {
  return p.map((_, i) => { let sx = 0, sy = 0, c = 0; for (let k = -n; k <= n; k++) { const q = p[clamp(i + k, 0, p.length - 1)]; sx += q.x; sy += q.y; c++; } return { x: sx / c, y: sy / c }; });
}

/** 선 세기 지도를 0~1 근처로 (손바닥 안쪽의 95번째 백분위수 기준) */
function normalizeRidge(ridge, mask) {
  const vals = []; for (let i = 0; i < ridge.length; i++) if (mask[i] && ridge[i] > 0) vals.push(ridge[i]);
  vals.sort((a, b) => a - b);
  const p95 = vals[Math.floor(vals.length * 0.95)] || 1, p50 = vals[Math.floor(vals.length * 0.5)] || 0;
  const out = new Float32Array(ridge.length);
  for (let i = 0; i < out.length; i++) out[i] = clamp(ridge[i] / p95, 0, 1.6);
  return { ridgeN: out, p95, p50 };
}

/** 세 가지 주요 선(+운명선)을 찾는다. 생명선 → 두뇌선 → 감정선 → 운명선 순서 (앞서 찾은 선 근처는 벌점) */
export function traceLines(warp, ridge, mask) {
  const { ridgeN } = normalizeRidge(ridge, mask);
  const { nx, ny } = warp;
  const result = {}; const avoid = new Float32Array(nx * ny);
  const addAvoid = (path, skipFrac) => {
    const from = Math.floor(path.length * skipFrac);
    for (let k = from; k < path.length; k++) for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) {
      const x = Math.round(path[k].x) + ox, y = Math.round(path[k].y) + oy; if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      avoid[y * nx + x] = Math.max(avoid[y * nx + x], 6 * (1 - Math.hypot(ox, oy) / 6));
    }
  };
  for (const key of ['life', 'head', 'heart', 'fate']) {
    let limitY = null;
    if (key === 'heart' && result.head) {                     // 감정선은 두뇌선보다 위쪽에서만 찾는다
      limitY = new Float32Array(nx).fill(1e9);
      for (const q of result.head.path) { const x = Math.round(q.x); if (x >= 0 && x < nx) limitY[x] = Math.min(limitY[x], q.y); }
      let lo = -1, hi = -1; for (let x = 0; x < nx; x++) if (limitY[x] < 1e8) { if (lo < 0) lo = x; hi = x; }
      for (let x = lo; x <= hi; x++) if (limitY[x] > 1e8) { let l = x - 1; while (l > lo && limitY[l] > 1e8) l--; let r = x + 1; while (r < hi && limitY[r] > 1e8) r++; limitY[x] = (limitY[l] + limitY[r]) / 2; }
    }
    const path = traceLine(warp, LINE_PRIORS[key], ridgeN, mask, key === 'life' ? null : avoid, { limitY });
    if (!path) { result[key] = null; continue; }
    const sm = smoothPath(path);
    result[key] = { key, path: sm };
    addAvoid(sm, key === 'head' ? 0.25 : 0.0);
    if (key === 'life') addAvoid(sm, 0.25);
  }
  return { lines: result, ridgeN };
}

// ── 5. 선의 특징 재기 ────────────────────────────────────────
const PX_W = (A1 - A0) / NX;   // 펴진 영상 1픽셀 = 손바닥 너비의 몇 배

function bilinear(arr, nx, ny, x, y) {
  x = clamp(x, 0, nx - 1.001); y = clamp(y, 0, ny - 1.001);
  const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, i = y0 * nx + x0;
  return (arr[i] * (1 - tx) + arr[i + 1] * tx) * (1 - ty) + (arr[i + nx] * (1 - tx) + arr[i + nx + 1] * tx) * ty;
}
const movAvg = (v, n) => v.map((_, i) => { let s = 0, c = 0; for (let k = -n; k <= n; k++) { const j = i + k; if (j >= 0 && j < v.length) { s += v[j]; c++; } } return s / c; });
const pathLen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return s; };
const percentile = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };

/** 경로 중 실제로 선이 뚜렷한 구간만 남긴다 (흐릿한 끝은 잘라낸다) */
function strongPart(path, vals, bgMedian) {
  const sm = movAvg(vals, 5);
  const peak = percentile(sm, 0.9);
  const thr = Math.max(bgMedian * 1.3, peak * 0.30, 0.15);
  let best = [0, -1], i = 0;
  const gapMax = 12;
  while (i < sm.length) {
    if (sm[i] < thr) { i++; continue; }
    let j = i, last = i;
    while (j < sm.length && j - last <= gapMax) { if (sm[j] >= thr) last = j; j++; }
    if (last - i > best[1] - best[0]) best = [i, last];
    i = last + 1;
  }
  if (best[1] < best[0]) return { from: 0, to: path.length - 1, thr, sm, empty: true };
  return { from: best[0], to: best[1], thr, sm, empty: false };
}

/** 굽은 정도: 양 끝을 잇는 선에서 가장 멀리 벗어난 거리(W 단위)와 방향 부호(+ 는 b 가 작아지는 쪽, 즉 손가락 쪽으로 볼록) */
function bulge(ptsPalm, rho) {
  const p = ptsPalm.map(q => ({ x: q.a, y: q.b * rho }));
  const A = p[0], B = p[p.length - 1], dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  let best = 0, signed = 0;
  for (const q of p) { const cross = (dx * (q.y - A.y) - dy * (q.x - A.x)) / len; if (Math.abs(cross) > Math.abs(best)) { best = cross; signed = cross; } }
  return { dev: Math.abs(best), signed, len };
}

export function measureLines(warp, lines, ridgeN, mask) {
  const { nx, ny, frame } = warp, rho = frame.rho;
  const vals0 = []; for (let i = 0; i < ridgeN.length; i++) if (mask[i]) vals0.push(ridgeN[i]);
  const bgMedian = percentile(vals0, 0.5), bgP90 = percentile(vals0, 0.9);
  const out = {};
  for (const [key, l] of Object.entries(lines)) {
    if (!l) { out[key] = null; continue; }
    const vals = l.path.map(p => bilinear(ridgeN, nx, ny, p.x, p.y));
    const sp = strongPart(l.path, vals, bgMedian);
    const part = l.path.slice(sp.from, sp.to + 1);
    const partVals = vals.slice(sp.from, sp.to + 1);
    const palmPts = part.map(p => warp.toPalm(p.x, p.y));
    const expected = pathLenPrior(LINE_PRIORS[key], rho);
    const lenW = pathLen(part) * PX_W;
    const strength = partVals.reduce((s, v) => s + v, 0) / partVals.length;
    const contrast = strength / Math.max(bgMedian, 0.05);
    const cont = partVals.filter(v => v >= sp.thr * 0.7).length / partVals.length;
    // 끊김 횟수(뚜렷한 구간 안에서 세 칸 넘게 흐려진 곳)와 곧은 정도(양 끝 직선거리 ÷ 선 길이)
    let breaks = 0, run = 0;
    for (let i = sp.from; i <= sp.to; i++) { if (sp.sm[i] < sp.thr) run++; else { if (run >= 3) breaks++; run = 0; } }
    const chord = part.length > 1 ? Math.hypot(part[part.length - 1].x - part[0].x, part[part.length - 1].y - part[0].y) : 0;
    const straight = chord / Math.max(1, pathLen(part));
    const m = { key, name: LINE_PRIORS[key].name, hanja: LINE_PRIORS[key].hanja,
      lengthW: lenW, lengthRel: lenW / expected, strength, contrast, continuity: cont, breaks, straight,
      coverage: part.length / l.path.length, start: palmPts[0], end: palmPts[palmPts.length - 1], bulge: bulge(palmPts, rho) };
    out[key] = { ...l, part, palmPts, m, sp };
  }
  return { measured: out, bgMedian, bgP90 };
}
function pathLenPrior(prior, rho) { let s = 0; for (let i = 1; i < prior.pts.length; i++) s += Math.hypot(prior.pts[i][0] - prior.pts[i - 1][0], (prior.pts[i][1] - prior.pts[i - 1][1]) * rho); return s; }

// ── 6. 손 모양 특징 (관절점만으로 계산) ──────────────────────
export const HAND_POP = {                      // [평균, 표준편차] — 손바닥·손가락 비율의 대략적인 기준
  palmRatio: [1.55, 0.17],                     // 손바닥 길이 ÷ 손바닥 너비
  fingerRatio: [1.02, 0.13],                   // 중지 길이 ÷ 손바닥 길이
  thumbRatio: [0.95, 0.14],                    // 엄지 길이 ÷ 손바닥 길이
  indexRing: [1.0, 0.045],                     // 검지 길이 ÷ 약지 길이
  spread: [38, 9],                             // 검지·새끼 손가락 방향이 벌어진 각도(도)
};
export function handShape(lm) {
  const d = (i, j) => dist(lm[i], lm[j]);
  const f = palmFrame(lm);
  const angle = (i, j) => Math.atan2(lm[j].y - lm[i].y, lm[j].x - lm[i].x);
  const angBetween = (a0, a1, b0, b1) => { let x = Math.abs(angle(a0, a1) - angle(b0, b1)) * 180 / Math.PI; if (x > 180) x = 360 - x; return x; };
  const spread = angBetween(5, 8, 17, 20);
  const palmLen = d(0, 9);
  // 손가락별 길이(손바닥 길이에 대한 비) — 검지·중지·약지·새끼. 각각 목성·토성·태양·수성 손가락
  const fl = { index: d(5, 8) / palmLen, middle: d(9, 12) / palmLen, ring: d(13, 16) / palmLen, pinky: d(17, 20) / palmLen };
  // 마디 비율: 손끝 마디(의지·정신) · 가운데 마디(이성) · 뿌리 마디(현실·물질). 네 손가락 평균
  const phal = [0, 0, 0];
  for (const base of [5, 9, 13, 17]) {
    const seg = [d(base + 2, base + 3), d(base + 1, base + 2), d(base, base + 1)];   // 끝 → 뿌리
    const sum = seg[0] + seg[1] + seg[2];
    for (let k = 0; k < 3; k++) phal[k] += seg[k] / sum / 4;
  }
  // 새끼손가락 끝이 약지 끝 마디 이음새(15번)보다 얼마나 위/아래인지 (손바닥 길이 단위, +면 높이 닿음)
  const P = (i) => imageToPalm(f, lm[i]);
  const pinkyReach = P(15).b - P(20).b;
  // 엄지가 검지에서 벌어진 각도, 엄지 끝이 올라간 높이(손바닥 길이 단위, 0 = 중지 뿌리 높이)
  const thumbOpen = angBetween(1, 4, 5, 8);
  const thumbTipB = P(4).b;
  // 인접 손가락 사이 벌어짐(도)
  const gapIM = angBetween(5, 8, 9, 12), gapMR = angBetween(9, 12, 13, 16), gapRP = angBetween(13, 16, 17, 20);
  return {
    palmRatio: f.rho,
    fingerRatio: d(9, 12) / d(0, 9),
    thumbRatio: (d(1, 2) + d(2, 3) + d(3, 4)) / d(0, 9),
    indexRing: d(5, 8) / d(13, 16),
    spread,
    palmWidthPx: f.W,
    fingerLen: fl,
    pinkyRing: fl.pinky / fl.ring,
    middleIndex: fl.middle / fl.index,
    phalanx: { tip: phal[0], mid: phal[1], base: phal[2] },
    pinkyReach, thumbOpen, thumbTipB, gapIM, gapMR, gapRP,
  };
}

// ── 7. 사진 상태 검사 ────────────────────────────────────────
/** 손바닥 쪽이 카메라를 향하는지 (손가락 방향과 손 좌우 표시 기준). label 은 MediaPipe 가 준 'Left'/'Right' */
export function isPalmFacing(lm, label) {
  const cross = (lm[5].x - lm[0].x) * (lm[17].y - lm[0].y) - (lm[5].y - lm[0].y) * (lm[17].x - lm[0].x);
  return (label === 'Left') === (cross > 0);
}

export function assessQuality(warp, mask, rawRidge) {
  const { gray, nx, ny } = warp;
  let sum = 0, n = 0;
  for (let i = 0; i < gray.length; i++) if (mask[i]) { sum += gray[i]; n++; }
  const brightness = n ? sum / n : 0;
  // 선명도: 손바닥 안쪽의 평균 기울기(경계 세기)를 밝기로 나눈 값
  const g = blur(gray, nx, ny, 0.9); let gs = 0, gn = 0;
  for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) { const i = y * nx + x; if (!mask[i]) continue; gs += Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + nx] - g[i - nx]); gn++; }
  const sharp = gn ? (gs / gn) / Math.max(brightness, 20) : 0;
  const vals = []; for (let i = 0; i < rawRidge.length; i++) if (mask[i]) vals.push(rawRidge[i]);
  return { brightness, sharp, coverage: n / (nx * ny) };
}

// ── 8. 전체 분석 ─────────────────────────────────────────────
/**
 * @param img {data, width, height}  @param lm 21개 관절점 [{x,y}] (픽셀)
 * @returns 펴 놓은 손바닥, 찾은 선(영상 좌표), 선 특징, 손 모양, 사진 상태
 */
export function analyzePalm(img, lm) {
  const warp = warpPalm(img, lm);
  const { mask } = palmMask(warp, lm);
  const { ridge } = ridgeMap(warp, mask);
  const { lines, ridgeN } = traceLines(warp, ridge, mask);
  const { measured, bgMedian, bgP90 } = measureLines(warp, lines, ridgeN, mask);
  const q = assessQuality(warp, mask, ridge);
  const f = warp.frame;
  const toImg = (pts) => pts.map(p => { const c = warp.toPalm(p.x, p.y); return palmToImage(f, c.a, c.b); });
  const out = {};
  for (const [k, l] of Object.entries(measured)) {
    out[k] = l ? { key: k, name: l.m.name, hanja: l.m.hanja, m: l.m, points: toImg(l.part), fullPoints: toImg(l.path) } : null;
  }
  const main = ['heart', 'head', 'life'].map(k => measured[k]?.m.contrast).filter(Number.isFinite);
  const meanContrast = main.length ? main.reduce((a, b) => a + b, 0) / main.length : 0;
  const issues = [];
  if (q.brightness < 60) issues.push('dark'); else if (q.brightness > 225) issues.push('bright');
  if (q.sharp < 0.012) issues.push('blur');
  if (meanContrast < 1.6) issues.push('faint');
  return { frame: f, lines: out, hand: handShape(lm), quality: { ...q, meanContrast, bgMedian, bgP90, issues, level: issues.length === 0 ? 'good' : issues.length === 1 ? 'fair' : 'poor' } };
}
