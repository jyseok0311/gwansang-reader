// 표본 측정값(population-sample.json)으로 physiognomy.js 의 기준값을 계산한다.
// 표본은 AI가 만든 가상 인물 얼굴이다 (실존 인물 사진은 쓰지 않는다).
//
// 실행 순서
//   1) node tools/calibrate-population.mjs            → POP(중앙값·표준편차) 출력 → physiognomy.js 의 POP 에 붙여넣기
//   2) node tools/calibrate-population.mjs --offsets  → 얼굴형·운세 균형 보정값 출력 → physiognomy.js 의 FACE_TYPE_OFFSET, FORTUNE_OFFSET 에 붙여넣기
//   3) node tools/calibrate-population.mjs --check    → 현재 기준값으로 표본을 채점해 분포 확인
import { readFileSync } from 'node:fs';

// 앱의 촬영 조건(POSE_LIMIT)과 비슷한 기준으로 고개를 많이 돌리거나 숙인 사진은 뺀다
const MAX_YAW = 12;
const MAX_PITCH = 16;
// 웃으면 입꼬리가 옆으로 당겨져 입 폭이 넓게 측정된다. 앱은 무표정 촬영을 요구하므로 웃는 표본의 입 폭을 줄여서 맞춘다.
const SMILE_MOUTH_FACTOR = 1.2;
const SMILE_THRESHOLD = 0.5;
const KEYS = ['faceRatio', 'upperRatio', 'middleRatio', 'lowerRatio', 'foreheadWidthRatio', 'jawRatio', 'chinLen', 'eyeSize', 'eyeOpen', 'eyeTilt',
  'interEye', 'glabella', 'browArch', 'browLen', 'browEyeGap', 'underEye', 'noseLen', 'noseWidth', 'philtrum', 'mouthWidth', 'lipThick', 'symmetry'];

const { rows } = JSON.parse(readFileSync(new URL('./population-sample.json', import.meta.url), 'utf8'));
const used = rows
  .filter(r => Math.abs(r.f.yaw) <= MAX_YAW && Math.abs(r.f.pitch) <= MAX_PITCH)
  .map(r => (r.f.smile ?? 0) > SMILE_THRESHOLD ? { ...r, f: { ...r.f, mouthWidth: r.f.mouthWidth / SMILE_MOUTH_FACTOR } } : r);

const median = (vals) => { const s = [...vals].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const std = (vals, m) => Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length);
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`).join(', ');

if (process.argv.includes('--check')) {
  const { analyze } = await import('../physiognomy.js');
  const types = {}, best = {}, avgs = [];
  for (const r of used) {
    const res = analyze({ ...r.f, pose: { yaw: r.f.yaw, pitch: r.f.pitch, roll: 0 } });
    types[res.type.primary.hanja] = (types[res.type.primary.hanja] || 0) + 1;
    best[res.fortune.best.name] = (best[res.fortune.best.name] || 0) + 1;
    avgs.push(res.fortune.avg);
    console.log(r.id, res.type.primary.hanja + res.type.secondary.hanja, '종합', res.fortune.avg,
      res.fortune.ranked.map(f => f.name[0] + f.score).join(' '), '삼정', res.samjeong.stages.map(s => s.idx).join('/'));
  }
  console.log(`\n표본 ${used.length}명 · 종합점수 ${Math.min(...avgs)}~${Math.max(...avgs)}`);
  console.log('얼굴형 분포', types, '\n1위 운', best);
} else if (process.argv.includes('--offsets')) {
  const { faceTypeScores, fortuneZ, analyzeSamjeong } = await import('../physiognomy.js');
  const mean = (fn) => {
    const sum = {};
    for (const r of used) for (const [k, v] of Object.entries(fn(r.f))) sum[k] = (sum[k] || 0) + v;
    return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, +(v / used.length).toFixed(3)]));
  };
  console.log(`// 표본 ${used.length}명 기준`);
  console.log(`const FACE_TYPE_OFFSET = { ${fmt(mean(faceTypeScores))} };`);
  console.log(`const FORTUNE_OFFSET = { ${fmt(mean(f => fortuneZ(f, analyzeSamjeong(f))))} };`);
} else {
  const pop = {};
  for (const k of KEYS) {
    const vals = used.map(r => r.f[k]);
    const m = median(vals);
    pop[k] = [+m.toFixed(4), +std(vals, m).toFixed(4)];
  }
  // 삼정 편차(세 구간 상대 지수의 최대-최소) 분포
  const spreads = used.map(r => {
    const idx = ['upperRatio', 'middleRatio', 'lowerRatio'].map(k => r.f[k] / pop[k][0] * 100);
    return Math.max(...idx) - Math.min(...idx);
  });
  const sm = median(spreads);
  pop.samjeongSpread = [+sm.toFixed(2), +std(spreads, sm).toFixed(2)];
  console.log(`// 가상 인물 표본 ${used.length}명 (전체 ${rows.length}명 중 정면 사진) · [중앙값, 표준편차]`);
  console.log('export const POP = {');
  for (const [k, v] of Object.entries(pop)) console.log(`  ${k}: [${v[0]}, ${v[1]}],`);
  console.log('};');
}
