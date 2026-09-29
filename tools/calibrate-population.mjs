// 표본 측정값(population-sample.json)으로 physiognomy.js 의 POP(중앙값·표준편차)를 계산한다.
// 한국인 사용자를 기준으로 삼기 위해 한국인 표본(group K)에 가중치를 더 준다.
// 실행: node tools/calibrate-population.mjs            → POP 출력
//       node tools/calibrate-population.mjs --check    → 현재 POP로 표본을 채점해 분포 확인
import { readFileSync } from 'node:fs';

const K_WEIGHT = 2.8;
const MAX_YAW = 12;
// 웃으면 입꼬리가 옆으로 당겨져 입 폭이 넓게 측정된다. 앱은 무표정 촬영을 요구하므로 웃는 표본의 입 폭을 줄여서 맞춘다.
const SMILE_MOUTH_FACTOR = 1.2;
const SMILE_THRESHOLD = 0.5;
const KEYS = ['faceRatio', 'upperRatio', 'middleRatio', 'lowerRatio', 'foreheadWidthRatio', 'jawRatio', 'chinLen', 'eyeSize', 'eyeOpen', 'eyeTilt',
  'interEye', 'glabella', 'browArch', 'browLen', 'browEyeGap', 'underEye', 'noseLen', 'noseWidth', 'philtrum', 'mouthWidth', 'lipThick', 'symmetry'];

const { rows } = JSON.parse(readFileSync(new URL('./population-sample.json', import.meta.url), 'utf8'));
const used = rows.filter(r => Math.abs(r.f.yaw) <= MAX_YAW)
  .map(r => (r.f.smile ?? 0) > SMILE_THRESHOLD ? { ...r, f: { ...r.f, mouthWidth: r.f.mouthWidth / SMILE_MOUTH_FACTOR } } : r);
const w = (r) => (r.group === 'K' ? K_WEIGHT : 1);

function wMedian(vals) {
  const s = [...vals].sort((a, b) => a.v - b.v);
  const total = s.reduce((a, b) => a + b.w, 0);
  let acc = 0;
  for (const x of s) { acc += x.w; if (acc >= total / 2) return x.v; }
  return s.at(-1).v;
}
function wStd(vals, m) {
  const total = vals.reduce((a, b) => a + b.w, 0);
  return Math.sqrt(vals.reduce((a, b) => a + b.w * (b.v - m) ** 2, 0) / total);
}

if (process.argv.includes('--check')) {
  const { analyze } = await import('../physiognomy.js');
  const types = {}, best = {};
  for (const r of rows) {
    const res = analyze({ ...r.f, pose: { yaw: r.f.yaw, pitch: r.f.pitch, roll: 0 } });
    types[res.type.primary.hanja] = (types[res.type.primary.hanja] || 0) + 1;
    best[res.fortune.best.name] = (best[res.fortune.best.name] || 0) + 1;
    console.log(r.id, r.group, res.type.primary.hanja + res.type.secondary.hanja, 'avg', res.fortune.avg,
      res.fortune.ranked.map(f => f.name[0] + f.score).join(' '), '삼정', res.samjeong.stages.map(s => s.idx).join('/'));
  }
  console.log('\n얼굴형 분포', types, '\n1위 운', best);
} else {
  const pop = {};
  for (const k of KEYS) {
    const vals = used.map(r => ({ v: r.f[k], w: w(r) }));
    const m = wMedian(vals);
    pop[k] = [+m.toFixed(4), +wStd(vals, m).toFixed(4)];
  }
  // 삼정 편차(세 구간 상대 지수의 최대-최소) 분포
  const spreads = used.map(r => {
    const idx = ['upperRatio', 'middleRatio', 'lowerRatio'].map(k => r.f[k] / pop[k][0] * 100);
    return { v: Math.max(...idx) - Math.min(...idx), w: w(r) };
  });
  const sm = wMedian(spreads);
  pop.samjeongSpread = [+sm.toFixed(2), +wStd(spreads, sm).toFixed(2)];
  console.log(`// 표본 ${used.length}명 (한국인 ${used.filter(r => r.group === 'K').length}명, 가중치 ${K_WEIGHT})`);
  console.log('export const POP = {');
  for (const [k, v] of Object.entries(pop)) console.log(`  ${k}: [${v[0]}, ${v[1]}],`);
  console.log('};');
}
