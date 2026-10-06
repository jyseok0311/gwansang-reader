// 때의 운세 자체 검증: node tools/fortune-check.mjs
//  - 달 황경: 알려진 신월·보름에 태양-달 이각이 0°·180° 가까이 나오는지
//  - 별자리: 경계 날짜의 별자리
//  - 결정성: 같은 날은 같은 결과, 한 해 점수 분포
import * as F from '../fortune-time.js';
import { computeSaju, interpretSaju, sunLongitude } from '../saju.js';
import { biorhythm } from '../biorhythm.js';
import { computeMatch } from '../match.js';
import { classifyAnimal } from '../animal-face.js';
import { POP } from '../physiognomy.js';

let bad = 0;
const ok = (cond, msg) => { if (!cond) { bad++; console.log('✗', msg); } else console.log('✓', msg); };
const mk = (y, m, d, h = 12) => { const saju = computeSaju({ year: y, month: m, day: d, calendar: 'solar', hour: h, minute: 0 }); return { saju, reading: interpretSaju(saju) }; };

for (const [n, jd, want] of [['2000-01-06 18:14 UT 신월', 2451550.2597, 0], ['2000-01-21 04:40 UT 보름', 2451564.6944, 180], ['2024-04-08 18:21 UT 신월', 2460409.2646, 0], ['2024-01-25 17:54 UT 보름', 2460335.2458, 180]]) {
  const e = (((F.moonLongitude(jd) - sunLongitude(jd)) % 360) + 360) % 360, err = Math.min(Math.abs(e - want), 360 - Math.abs(e - want));
  ok(err < 0.5, `${n}: 이각 오차 ${err.toFixed(2)}°`);
}
for (const [y, m, d, want] of [[1995, 3, 14, '물고기자리'], [1990, 3, 21, '양자리'], [1990, 4, 19, '양자리'], [1990, 4, 21, '황소자리'], [1988, 12, 25, '염소자리'], [1992, 8, 5, '사자자리'], [1999, 10, 24, '전갈자리']]) {
  ok(F.zodiacProfile(mk(y, m, d)).sign.name === want, `${y}-${m}-${d} → ${want}`);
}
const st = mk(1995, 3, 14, 9);
const a = F.dailyFortune(st, new Date(2026, 9, 6, 10)), b = F.dailyFortune(st, new Date(2026, 9, 6, 22));
ok(JSON.stringify(a.scores) === JSON.stringify(b.scores), '같은 날은 같은 점수');
const avgs = Array.from({ length: 365 }, (_, i) => F.dailyFortune(st, new Date(2026, 0, 1 + i)).avg);
const mean = avgs.reduce((x, y) => x + y) / avgs.length, sd = Math.sqrt(avgs.reduce((x, y) => x + (y - mean) ** 2, 0) / avgs.length);
ok(sd > 5 && Math.min(...avgs) >= 48 && Math.max(...avgs) <= 98, `한 해 점수 분포: 평균 ${mean.toFixed(1)}, 표준편차 ${sd.toFixed(1)}, ${Math.min(...avgs)}~${Math.max(...avgs)}`);
ok(F.branchRel(0, 6) === 'chung' && F.branchRel(0, 1) === 'yukhap' && F.branchRel(0, 4) === 'samhap' && F.branchRel(0, 7) === 'hae', '지지 합·충·삼합·해');
ok(F.tenGod(0, 2) === 'siksin' && F.tenGod(0, 0) === 'bigyeon' && F.tenGod(0, 8) === 'pyeonin', '십성 (甲 기준 丙=식신, 甲=비견, 壬=편인)');
// 바이오리듬: 태어난 날은 0%에서 시작해 주기의 1/4 지점에서 정점
const b0 = biorhythm({ year: 2000, month: 1, day: 1 }, new Date(2000, 0, 1));
ok(b0.now.every(c => c.value === 0), '태어난 날 바이오리듬은 세 주기 모두 0%');
const b1 = biorhythm({ year: 2000, month: 1, day: 1 }, new Date(2000, 0, 1 + 23 * 4 + 6));   // 신체 23일 주기: 6일째 ≒ 정점
ok(b1.now[0].value >= 95 && b1.now[0].phase === 'high', `신체 주기 정점(${b1.now[0].value}%)`);
// 궁합: 두 사람을 바꿔도 같은 점수, 천간합(甲己)이면 마음 점수가 높다
const A = mk(1995, 3, 14, 9), B = mk(1993, 10, 2, 20);
ok(computeMatch(A, B).total === computeMatch(B, A).total, '궁합은 두 사람을 바꿔도 같은 점수');
const findStem = (stem, m) => { for (let d = 1; d < 40; d++) { const x = mk(2001, m, d, 12); if (x.saju.pillars.day.stem === stem) return x; } };
ok(computeMatch(findStem(0, 5), findStem(5, 6)).axes.heart >= 96, '일간 甲과 己는 천간합이라 마음 점수가 높다');
// 동물상: 비율 합이 100% 근처
const avgFace = Object.fromEntries(Object.entries(POP).map(([k, v]) => [k, v[0]]));
const an = classifyAnimal(avgFace), sumPct = an.weights.reduce((x, y) => x + y.pct, 0);
ok(sumPct >= 98 && sumPct <= 102, `동물상 비율 합 ${sumPct}%`);
const catish = classifyAnimal({ ...avgFace, eyeTilt: POP.eyeTilt[0] + 3 * POP.eyeTilt[1], chinWidth: POP.chinWidth[0] - 1.5 * POP.chinWidth[1], faceRatio: POP.faceRatio[0] });
ok(['cat', 'fox'].includes(catish.primary.key), `눈꼬리가 올라가고 턱 끝이 뾰족하면 고양이·여우상 (${catish.primary.name})`);
const doggish = classifyAnimal({ ...avgFace, eyeTilt: POP.eyeTilt[0] - 3 * POP.eyeTilt[1], eyeOpen: POP.eyeOpen[0] + 2 * POP.eyeOpen[1] });
ok(doggish.primary.key === 'dog' || doggish.primary.key === 'deer', `눈꼬리가 처지고 눈이 동그라면 강아지·사슴상 (${doggish.primary.name})`);
console.log(bad ? `\n실패 ${bad}건` : '\n모두 통과');
process.exit(bad ? 1 : 0);
