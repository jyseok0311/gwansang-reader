// 때의 운세 자체 검증: node tools/fortune-check.mjs
//  - 달 황경: 알려진 신월·보름에 태양-달 이각이 0°·180° 가까이 나오는지
//  - 별자리: 경계 날짜의 별자리
//  - 결정성: 같은 날은 같은 결과, 한 해 점수 분포
import * as F from '../fortune-time.js';
import { computeSaju, interpretSaju, sunLongitude } from '../saju.js';

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
console.log(bad ? `\n실패 ${bad}건` : '\n모두 통과');
process.exit(bad ? 1 : 0);
