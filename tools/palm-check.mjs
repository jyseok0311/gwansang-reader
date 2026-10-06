// 손 모양 측정·판정 자체 검증: node tools/palm-check.mjs  (실패하면 종료 코드 1)
// 손바닥을 기울이거나 손가락을 살짝 굽혀도 3D 관절점으로 잰 손가락 길이는 거의 변하지 않아야 하고,
// 평범한 손 1만 개를 판정했을 때 한 유형(특히 화형수)으로 쏠리지 않아야 한다.
import { handShape, HAND_POP } from '../palm.js';
import { classifyHand, HAND_TYPES } from '../palm-reading.js';

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('  실패:', msg); } };
let seed = 20260310;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const rad = (d) => d * Math.PI / 180;

/** 손바닥 평면에서 손 뼈대를 만든다. 길이는 손바닥 길이(손목~중지 뿌리) = 1 기준. */
function buildHand({ palmRatio, finger, thumb, tilt = 0, curl = 0, rollDeg = 0 }) {
  const W = 1 / palmRatio;
  const P = Array.from({ length: 21 }, () => [0, 0, 0]);
  const mcp = { 5: [W / 2, 0.97], 9: [W / 6, 0.99], 13: [-W / 6, 0.94], 17: [-W / 2, 0.82] };
  const rel = { 5: 0.97, 9: 1, 13: 0.93, 17: 0.74 };     // 손가락 길이의 상대값(검지~새끼)
  const seg = [0.46, 0.27, 0.27];
  const norm = (x, y) => { const n = Math.hypot(x, y); return [x / n, y / n]; };
  const m9 = norm(mcp[9][0], mcp[9][1]); mcp[9] = [m9[0], m9[1]];   // 0~9 거리를 정확히 1 로
  for (const b of [5, 9, 13, 17]) {
    let [x, y, z] = [mcp[b][0], mcp[b][1], 0];
    P[b] = [x, y, z];
    const len = finger * rel[b];
    let ang = 0;                          // 손가락이 굽은 누적 각도 (손바닥 쪽 = z 음수 방향)
    for (let k = 0; k < 3; k++) {
      ang += rad(curl) * (k === 0 ? 0.6 : 1);
      const l = len * seg[k];
      y += l * Math.cos(ang); z -= l * Math.sin(ang);
      P[b + k + 1] = [x, y, z];
    }
  }
  // 엄지: 손목 옆에서 바깥 위쪽으로
  P[1] = [W * 0.28, 0.1, 0];
  let [tx, ty] = [W * 0.28, 0.1];
  const tseg = [0.35, 0.33, 0.32];
  for (let k = 0; k < 3; k++) {
    const l = thumb * tseg[k];
    tx += l * Math.sin(rad(40)); ty += l * Math.cos(rad(40));
    P[2 + k] = [tx, ty, 0];
  }
  // 기울이기(x 축 회전) + 화면 안 돌리기
  const T = rad(tilt), R = rad(rollDeg);
  const world = P.map(([x, y, z]) => {
    const y1 = y * Math.cos(T) - z * Math.sin(T), z1 = y * Math.sin(T) + z * Math.cos(T);
    const x2 = x * Math.cos(R) - y1 * Math.sin(R), y2 = x * Math.sin(R) + y1 * Math.cos(R);
    return { x: x2 * 0.09, y: -y2 * 0.09, z: z1 * 0.09 };   // 미터. 이미지 좌표처럼 y 는 아래로
  });
  const lm = world.map(p => ({ x: 500 + p.x * 4000, y: 700 + p.y * 4000 }));   // 정사영된 화면 좌표(픽셀)
  return { lm, world };
}

// 1) 기울기·굽힘에 대한 불변성
const base = { palmRatio: 1.55, finger: 1.02, thumb: 0.95 };
const flat = buildHand(base);
const f0 = handShape(flat.lm, flat.world).fingerRatio, f0_2d = handShape(flat.lm).fingerRatio;
console.log(`똑바로 편 손: 3D 손가락비 ${f0.toFixed(3)} / 2D ${f0_2d.toFixed(3)}`);
ok(Math.abs(f0 - 1.02) < 0.05, '똑바로 편 손의 3D 손가락비가 기준값(1.02)에서 크게 벗어남');
for (const tilt of [20, 35, 50]) {
  const h = buildHand({ ...base, tilt });
  const a = handShape(h.lm, h.world).fingerRatio, b = handShape(h.lm).fingerRatio;
  console.log(`  기울기 ${tilt}°: 3D ${a.toFixed(3)}  2D ${b.toFixed(3)}`);
  ok(Math.abs(a - f0) < 0.02, `기울기 ${tilt}°에서 3D 손가락비가 변함`);
}
for (const curl of [10, 20, 30]) {
  const h = buildHand({ ...base, curl });
  const a = handShape(h.lm, h.world).fingerRatio, b = handShape(h.lm).fingerRatio;
  console.log(`  굽힘 ${curl}°/마디: 3D ${a.toFixed(3)}  2D ${b.toFixed(3)}`);
  ok(Math.abs(a - f0) < 0.02, `굽힘 ${curl}°에서 3D 손가락비가 변함`);
  if (curl >= 20) ok(b < f0 - 0.1, `굽힘 ${curl}°에서 2D 손가락비가 줄어드는 것을 재현하지 못함(테스트 모델 확인)`);
}
const rolled = buildHand({ ...base, rollDeg: 25 });
ok(Math.abs(handShape(rolled.lm, rolled.world).fingerRatio - f0) < 0.01, '손을 돌려도 3D 손가락비가 변함');
ok(handShape(flat.lm, flat.world).measuredIn === '3D' && handShape(flat.lm).measuredIn === '2D', '측정 방식 표시(3D/2D)');

// 2) 평범한 손 1만 개를 판정했을 때 쏠림이 없는가 (기울기 0~40°, 굽힘 0~25° 가 섞인 현실적인 자세)
//    mode: '3d' 3D 관절점으로 측정 / '2d' 화면 좌표 측정(손가락 길이를 반만 믿음) / 'old' 이전 방식(화면 좌표 측정을 그대로 믿음)
function population(mode, curlMin = 0, curlMax = 25, N = 10000) {
  const cnt = Object.fromEntries(Object.keys(HAND_TYPES).map(k => [k, 0]));
  for (let i = 0; i < N; i++) {
    const h = buildHand({
      palmRatio: HAND_POP.palmRatio[0] + gauss() * HAND_POP.palmRatio[1],
      finger: HAND_POP.fingerRatio[0] + gauss() * HAND_POP.fingerRatio[1],
      thumb: HAND_POP.thumbRatio[0] + gauss() * HAND_POP.thumbRatio[1],
      tilt: rnd() * 40, curl: curlMin + rnd() * (curlMax - curlMin), rollDeg: (rnd() - 0.5) * 30,
    });
    const shape = handShape(h.lm, mode === '3d' ? h.world : null);
    if (mode === 'old') shape.measuredIn = '3D';
    cnt[classifyHand(shape).primary.key]++;
  }
  return Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, v / N]));
}
const p3 = population('3d'), p2 = population('2d');
// 손가락이 힘이 빠져 많이 굽은 채(마디마다 20~45°) 찍힌 손: 이전 방식은 모두 손가락이 짧은 손으로 읽던 상황
const pOld = population('old', 20, 45), p3r = population('3d', 20, 45), p2r = population('2d', 20, 45);
const fmt = (p) => Object.entries(p).map(([k, v]) => `${HAND_TYPES[k].hanja} ${(v * 100).toFixed(0)}%`).join('  ');
console.log('3D 측정      :', fmt(p3));
console.log('2D 측정(보정):', fmt(p2));
console.log('--- 손가락이 많이 굽은 채 찍힌 손 ---');
console.log('이전 방식    :', fmt(pOld));
console.log('3D 측정      :', fmt(p3r));
console.log('2D 측정(보정):', fmt(p2r));
ok(Math.max(...Object.values(p3)) < 0.36 && Math.min(...Object.values(p3)) > 0.08, '3D 측정 시 유형 분포가 한쪽으로 쏠림');
ok(p3.fire < 0.30, '3D 측정 시 화형수가 30% 이상으로 쏠림');
ok(p2.fire < 0.30, '2D 측정(대비책)에서 화형수가 30% 이상으로 쏠림');
const short = (p) => p.fire + p.earth;   // 손가락이 짧은 유형 (화·토)
ok(short(pOld) > 0.65, '굽은 손에서 이전 방식의 짧은손(화·토) 쏠림이 재현되지 않음(테스트 모델 확인)');
ok(p3r.fire < 0.30 && Math.abs(p3r.fire - p3.fire) < 0.04 && Math.abs(short(p3r) - short(p3)) < 0.05, '손가락이 굽어도 3D 측정은 분포가 변하지 않아야 함');
ok(short(p2r) < short(pOld) - 0.1, '2D 측정(대비책)이 굽은 손에서 짧은손 쏠림을 줄이지 못함');

// 3) 같은 손을 2D 로 재면 손가락 비율이 낮아 화형수로 보이는 사례를 3D 가 바로잡는지
const tilted = buildHand({ ...base, tilt: 45, curl: 15 });
const c3 = classifyHand(handShape(tilted.lm, tilted.world)), c2 = classifyHand(handShape(tilted.lm));
console.log(`기울고 살짝 굽은 평균 손: 3D → ${c3.primary.name} / 2D → ${c2.primary.name}`);
ok(c3.primary.key !== 'fire', '평균적인 손을 기울여 찍었는데 3D 측정이 화형수로 판정함');

console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
