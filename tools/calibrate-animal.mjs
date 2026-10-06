// 동물상 균형 보정: node tools/calibrate-animal.mjs
//  표본(가상 인물 얼굴 측정값)에서 동물별 점수의 평균·표준편차를 구해 animal-face.js 의 norm 에 붙여 넣는다.
//  --check 를 주면 현재 norm 으로 표본을 채점해 1위 동물 분포를 보여 준다.
import { readFileSync } from 'node:fs';
import { animalScores, classifyAnimal, ANIMALS } from '../animal-face.js';

const { rows } = JSON.parse(readFileSync(new URL('./population-sample.json', import.meta.url), 'utf8'));
// 앱의 촬영 조건과 비슷하게 고개를 많이 돌린 사진은 빼고, 웃는 사진은 입 너비를 무표정 기준으로 보정한다 (calibrate-population.mjs 와 같은 기준)
const used = rows.filter(r => Math.abs(r.f.yaw) <= 12 && Math.abs(r.f.pitch) <= 16).map(r => ((r.f.smile ?? 0) > 0.5 ? { ...r, f: { ...r.f, mouthWidth: r.f.mouthWidth / 1.2 } } : r));
const keys = Object.keys(ANIMALS);
if (process.argv.includes('--check')) {
  const hist = Object.fromEntries(keys.map(k => [k, 0])); const tops = [];
  for (const r of used) { const c = classifyAnimal(r.f); hist[c.primary.key]++; tops.push(c.weights[0].pct); }
  console.log(`표본 ${used.length}명 · 1위 동물 분포`, hist, `· 1위 비율 평균 ${(tops.reduce((a, b) => a + b, 0) / tops.length).toFixed(0)}%`);
} else {
  const sc = used.map(r => animalScores(r.f));
  const norm = {};
  for (const k of keys) {
    const v = sc.map(s => s[k]), m = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
    norm[k] = [m, sd];
  }
  // 쏠림 보정: 표본에서 모든 동물의 평균 소프트맥스 비율이 같아지도록 동물별 보정값을 반복해서 찾는다
  const z = sc.map(s => Object.fromEntries(keys.map(k => [k, (s[k] - norm[k][0]) / norm[k][1]])));
  const bias = Object.fromEntries(keys.map(k => [k, 0]));
  for (let it = 0; it < 600; it++) {
    const share = Object.fromEntries(keys.map(k => [k, 0]));
    for (const row of z) {
      const e = Object.fromEntries(keys.map(k => [k, Math.exp((row[k] + bias[k]) * 1.4)])), t = keys.reduce((a, k) => a + e[k], 0);
      for (const k of keys) share[k] += e[k] / t / z.length;
    }
    for (const k of keys) bias[k] += 0.6 * (1 / keys.length - share[k]);
  }
  for (const k of keys) console.log(`${k}: norm: [${norm[k][0].toFixed(3)}, ${norm[k][1].toFixed(3)}], bias: ${bias[k].toFixed(3)},`);
}
