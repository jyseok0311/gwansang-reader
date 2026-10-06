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
import { MAJOR, drawCards, readSpread } from '../tarot.js';
import { buildReport } from '../report.js';
import { analyze } from '../physiognomy.js';
import { QUESTIONS, TYPES, scoreAnswers, axesFromCode, partners } from '../mbti.js';

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
// 타로: 22장, 같은 날·사람·질문이면 같은 카드, 질문이 다르면 다른 카드, 한 스프레드에 같은 카드 중복 없음
ok(MAJOR.length === 22 && MAJOR.every(c => c.kw.length === 2 && c.love.length === 2 && c.work.length === 2 && c.money.length === 2), '타로 메이저 아르카나 22장 데이터 완비');
const d1 = drawCards('five', { who: 'a', question: '질문', date: new Date(2026, 9, 6) }), d2 = drawCards('five', { who: 'a', question: '질문', date: new Date(2026, 9, 6, 23) });
ok(JSON.stringify(d1.map(x => [x.card.n, x.rev])) === JSON.stringify(d2.map(x => [x.card.n, x.rev])), '같은 날·같은 질문이면 같은 카드');
ok(new Set(d1.map(x => x.card.n)).size === 5, '한 번에 뽑은 카드는 서로 다름');
ok(JSON.stringify(drawCards('five', { who: 'a', question: '다른 질문', date: new Date(2026, 9, 6) }).map(x => x.card.n)) !== JSON.stringify(d1.map(x => x.card.n)), '질문이 다르면 다른 카드');
const cnt = new Array(22).fill(0); for (let i = 0; i < 2000; i++) cnt[drawCards('one', { who: 'u' + i })[0].card.n]++;
ok(Math.min(...cnt) > 55 && Math.max(...cnt) < 130, `카드가 고르게 나옴 (${Math.min(...cnt)}~${Math.max(...cnt)}회)`);
ok(['one', 'three', 'five'].every(k => readSpread(k, drawCards(k, { who: 'z' })).summary.length >= 2), '세 스프레드 모두 풀이 생성');
// MBTI: 20문항(축당 5), 16유형 데이터 완비, 전부 a면 ESTJ, 전부 b면 INFP, 보완 유형 규칙
ok(QUESTIONS.length === 20 && [0, 1, 2, 3].every(a => QUESTIONS.filter(q => q[0] === a).length === 5), 'MBTI 문항 20개(축당 5개)');
ok(Object.keys(TYPES).length === 16 && Object.values(TYPES).every(t => t.nick && t.kw.length === 3 && t.desc && t.strength && t.weak && t.love && t.work && t.stress && t.tip), '16유형 풀이 데이터 완비');
ok(scoreAnswers(QUESTIONS.map(() => 'a')).code === 'ESTJ' && scoreAnswers(QUESTIONS.map(() => 'b')).code === 'INFP', '전부 앞 선택=ESTJ, 전부 뒤 선택=INFP');
ok(partners('INFJ')[0] === 'ENFP' && partners('INFP').includes('ENTJ') && axesFromCode('ENTP').code === 'ENTP', '보완 유형 규칙');
// 통합 리포트: 사주만 있어도 열리고, 모든 콘텐츠를 더하면 프로필·총평·실천이 늘어나며, 점수 가중(바탕 65% + 흐름 35%)이 맞는다
const rpA = buildReport({ saju: A, date: new Date(2026, 9, 6, 10) });
ok(rpA && rpA.profile.length === 3 && rpA.flow && rpA.texts.length >= 4, '사주만으로도 통합 리포트 생성(프로필 3, 흐름 포함)');
const feat2 = { ...avgFace, symmetry: 0.8, pose: { yaw: 0, pitch: 0, roll: 0 }, frames: 1 };
const drawnR = drawCards('three', { who: 'r' }), tarotR = { spread: 'three', question: '', reading: readSpread('three', drawnR) };
const rpB = buildReport({ saju: A, face: analyze(feat2), partner: { name: '상대', state: B }, tarot: tarotR, mbti: scoreAnswers(QUESTIONS.map((q, i) => (i % 2 ? 'a' : 'b'))), date: new Date(2026, 9, 6, 10) });
ok(rpB.profile.length >= 8 && rpB.texts.length > rpA.texts.length && rpB.has.animal && rpB.has.tarot && rpB.has.partner && rpB.has.mbti, '모든 콘텐츠를 더하면 프로필·총평이 늘어남');
ok(rpB.total.score === Math.round(0.65 * rpB.base.score + 0.35 * rpB.flow.score), '종합 지수 = 바탕 65% + 흐름 35%');
ok(rpB.flow.score === Math.round(0.4 * rpB.flow.today + 0.35 * rpB.flow.year + 0.25 * rpB.flow.bio), '흐름 지수 = 오늘 40% + 올해 35% + 바이오리듬 25%');
ok(F.hourlyFortune(A, new Date(2026, 9, 6, 10)).hours.length === 12, '시간대(시진) 12개 점수');
ok(buildReport({ face: analyze(feat2) }) === null, '사주도 관상·손금 합산도 없으면 리포트 없음');
console.log(bad ? `\n실패 ${bad}건` : '\n모두 통과');
process.exit(bad ? 1 : 0);
