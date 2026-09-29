// 사주 계산 자체 검증: node tools/saju-check.mjs  (실패하면 종료 코드 1)
// 1) 일주를 한국천문연구원 기준 음력 라이브러리의 일진과 대조
// 2) 절기 경계(입춘)에서 연주·월주가 바뀌는 시각 확인
// 3) 알려진 날짜의 사주, 23시·자시 처리, 서머타임 처리 확인
import { computeSaju, jdn, sunLongitude } from '../saju.js';

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('  실패:', msg); } };
const P = (i) => { const p = computeSaju(i).pillars; return [p.year, p.month, p.day, p.hour].map(x => (x ? x.hanja : '??')).join(' '); };

// 1) 일주 대조 (1900~2049년 무작위 2000일)
let bad = 0;
for (let i = 0; i < 2000; i++) {
  const y = 1900 + Math.floor(Math.random() * 150), m = 1 + Math.floor(Math.random() * 12), d = 1 + Math.floor(Math.random() * 28);
  const s = computeSaju({ year: y, month: m, day: d });
  if (s.pillars.day.hanja + '日' !== s.checkDayGapja) bad++;
}
console.log(`일주 대조: 2000일 중 불일치 ${bad}`); ok(bad === 0, '일주가 라이브러리와 다름');

// 2) 2024년 입춘 = 2월 4일 17:27 (한국천문연구원). 황경 315도를 지나는 순간이어야 한다
const lon = (h, m) => sunLongitude(jdn(2024, 2, 4) - 0.5 + (h * 60 + m - 540) / 1440);
console.log('2024 입춘 황경', lon(17, 20).toFixed(3), lon(17, 34).toFixed(3));
ok(lon(17, 20) < 315 && lon(17, 34) > 315, '입춘 시각이 다름');
ok(P({ year: 2024, month: 2, day: 4, hour: 17, minute: 0 }).startsWith('癸卯 乙丑'), '입춘 직전은 계묘년 을축월');
ok(P({ year: 2024, month: 2, day: 4, hour: 18, minute: 0 }).startsWith('甲辰 丙寅'), '입춘 직후는 갑진년 병인월');

// 3) 알려진 날짜
const known = [
  ['1990-05-15 10:00', { year: 1990, month: 5, day: 15, hour: 10, minute: 0 }, '庚午 辛巳 庚辰 辛巳'],
  ['음력 1990-04-21 10:00', { year: 1990, month: 4, day: 21, calendar: 'lunar', hour: 10, minute: 0 }, '庚午 辛巳 庚辰 辛巳'],
  ['2000-01-01 00:00 (무오일, 자시)', { year: 2000, month: 1, day: 1, hour: 0, minute: 0 }, '己卯 丙子 戊午 壬子'],
  ['시간 모름', { year: 1995, month: 11, day: 3 }, '乙亥 丙戌 戊戌 ??'],
];
for (const [label, inp, want] of known) { const got = P(inp); console.log(label.padEnd(30), got, got === want ? '' : `(기대 ${want})`); ok(got === want, label); }

// 서머타임: 1957년 여름 낮 12시 40분은 표준시 11시 40분 → 午時, 겨울 12시 40분은 午時
ok(P({ year: 1957, month: 7, day: 15, hour: 12, minute: 40 }).endsWith('午'), '1957 서머타임 시주');
ok(P({ year: 1957, month: 12, day: 15, hour: 12, minute: 40 }).endsWith('午'), '1957 겨울 시주');
// 1988: 같은 시계 시각 13:50 이라도 서머타임 안에서는 표준시 12:50(태양시 12:18) → 午, 밖에서는 태양시 13:18 → 未
ok(P({ year: 1988, month: 7, day: 1, hour: 13, minute: 50 }).endsWith('午'), '1988 여름 시주');
ok(P({ year: 1988, month: 11, day: 1, hour: 13, minute: 50 }).endsWith('未'), '1988 가을 시주');

// 잘못된 입력은 오류
let threw = false; try { computeSaju({ year: 2100, month: 1, day: 1 }); } catch { threw = true; } ok(threw, '2050년 넘는 날짜는 오류여야 함');
threw = false; try { computeSaju({ year: 1990, month: 2, day: 30 }); } catch { threw = true; } ok(threw, '없는 날짜는 오류여야 함');

console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
