// ─────────────────────────────────────────────────────────────
//  사주팔자(四柱八字) 계산과 풀이 (오락용)
//  - 연주·월주: 절기 기준 (태양 황경을 천문 공식으로 계산, 오차 약 15분)
//  - 일주: 율리우스일 기준 60갑자 (1949-10-01 = 甲子일)
//  - 시주: 서울 경도 기준 실제 태양시(표준시보다 약 32분 늦음), 23시부터 다음 날 子시
//  - 음력 생일은 한국천문연구원 기준 달력(korean-lunar-calendar)으로 양력 변환
// ─────────────────────────────────────────────────────────────
import KoreanLunarCalendar from './vendor/korean-lunar-calendar/korean-lunar-calendar.mjs';
import { clamp } from './util.js';

export const STEMS = [
  { hanja: '甲', ko: '갑', el: 'wood', yang: true }, { hanja: '乙', ko: '을', el: 'wood', yang: false },
  { hanja: '丙', ko: '병', el: 'fire', yang: true }, { hanja: '丁', ko: '정', el: 'fire', yang: false },
  { hanja: '戊', ko: '무', el: 'earth', yang: true }, { hanja: '己', ko: '기', el: 'earth', yang: false },
  { hanja: '庚', ko: '경', el: 'metal', yang: true }, { hanja: '辛', ko: '신', el: 'metal', yang: false },
  { hanja: '壬', ko: '임', el: 'water', yang: true }, { hanja: '癸', ko: '계', el: 'water', yang: false },
];
export const BRANCHES = [
  { hanja: '子', ko: '자', el: 'water', animal: '쥐' }, { hanja: '丑', ko: '축', el: 'earth', animal: '소' },
  { hanja: '寅', ko: '인', el: 'wood', animal: '호랑이' }, { hanja: '卯', ko: '묘', el: 'wood', animal: '토끼' },
  { hanja: '辰', ko: '진', el: 'earth', animal: '용' }, { hanja: '巳', ko: '사', el: 'fire', animal: '뱀' },
  { hanja: '午', ko: '오', el: 'fire', animal: '말' }, { hanja: '未', ko: '미', el: 'earth', animal: '양' },
  { hanja: '申', ko: '신', el: 'metal', animal: '원숭이' }, { hanja: '酉', ko: '유', el: 'metal', animal: '닭' },
  { hanja: '戌', ko: '술', el: 'earth', animal: '개' }, { hanja: '亥', ko: '해', el: 'water', animal: '돼지' },
];
export const EL = {
  wood: { hanja: '木', ko: '목', name: '나무', color: '#5cb78a', lucky: '청록색 · 동쪽' },
  fire: { hanja: '火', ko: '화', name: '불', color: '#e0643f', lucky: '붉은색 · 남쪽' },
  earth: { hanja: '土', ko: '토', name: '흙', color: '#c9a24a', lucky: '황토색 · 가운데' },
  metal: { hanja: '金', ko: '금', name: '쇠', color: '#d9d9e3', lucky: '흰색 · 서쪽' },
  water: { hanja: '水', ko: '수', name: '물', color: '#5b8fd9', lucky: '검정·남색 · 북쪽' },
};
const ORDER = ['wood', 'fire', 'earth', 'metal', 'water'];
const GEN = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };      // 생(生)
const CTRL = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };     // 극(剋)

// ── 천문 계산 ────────────────────────────────────────────────
/** 그레고리력 날짜의 율리우스 적일(정오 기준 정수) */
export function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
/** 율리우스일(UT)의 태양 겉보기 황경(도). Meeus 저정밀식 */
export function sunLongitude(jd) {
  const T = (jd - 2451545.0) / 36525, rad = Math.PI / 180;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * rad;
  const lon = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  return ((lon % 360) + 360) % 360;
}

// 한국 표준시 이력 (IANA tz 데이터 Asia/Seoul 기준)
//   ~1908-03-31 서울 평균시(+8:27:52) → 1908-04-01 +8:30 → 1912-01-01 +9:00 → 1954-03-21 +8:30 → 1961-08-10 +9:00
//   서머타임(+1시간): 1948~1951, 1955~1960, 1987~1988 여름
const nthSunday = (y, m, n) => { const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + (n - 1) * 7; };
const lastSaturdayFrom = (y, m, d) => { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return d + ((6 - w + 7) % 7); };   // d일 이후 첫 토요일
function dstRange(y) {                                      // [시작 날짜값, 끝 날짜값(포함)] 또는 null. 날짜값은 yyyymmdd
  const D = (yy, m, d) => yy * 10000 + m * 100 + d;
  switch (y) {
    case 1948: return [D(y, 6, 1), D(y, 9, 12)];
    case 1949: return [D(y, 4, 3), D(y, 9, lastSaturdayFrom(y, 9, 7))];
    case 1950: return [D(y, 4, 1), D(y, 9, lastSaturdayFrom(y, 9, 7))];
    case 1951: return [D(y, 5, 6), D(y, 9, lastSaturdayFrom(y, 9, 7))];
    case 1955: return [D(y, 5, 5), D(y, 9, 8)];
    case 1956: return [D(y, 5, 20), D(y, 9, 29)];
    case 1957: case 1958: case 1959: case 1960: return [D(y, 5, nthSunday(y, 5, 1)), D(y, 9, lastSaturdayFrom(y, 9, 17))];
    case 1987: case 1988: return [D(y, 5, nthSunday(y, 5, 2)), D(y, 10, nthSunday(y, 10, 2) - 1)];   // 10월 둘째 일요일 새벽 3시에 끝남 (그 전날까지 확실히 서머타임)
    default: return null;
  }
}
function clockOffsetMinutes(y, m, d, hh = 12) {
  const v = y * 10000 + m * 100 + d;
  let off = v < 19080401 ? 508 : v < 19120101 ? 510 : v < 19540321 ? 540 : v < 19610810 ? 510 : 540;
  const r = dstRange(y);
  if (r && v >= r[0] && v <= r[1]) off += 60;
  // 1987·1988 은 끝나는 날(10월 둘째 일요일) 새벽 3시까지 서머타임
  if ((y === 1987 || y === 1988) && v === r[1] + 1 && hh < 3) off += 60;
  return off;
}
const SEOUL_LONGITUDE = 126.98;

/** 한국 시계 시각 → { UT 율리우스일, 서울 태양시 날짜·분 } */
function toMoment(y, m, d, hh, mm) {
  const off = clockOffsetMinutes(y, m, d, hh);
  const utMin = hh * 60 + mm - off;                      // 그날 0시(UT) 기준 분
  const jdUT = jdn(y, m, d) - 0.5 + utMin / 1440;
  const solarMin = utMin + SEOUL_LONGITUDE * 4;          // 경도 1도 = 4분
  const dayShift = Math.floor(solarMin / 1440);
  return { jdUT, solarJdn: jdn(y, m, d) + dayShift, solarMin: ((solarMin % 1440) + 1440) % 1440 };
}

// ── 사주 계산 ────────────────────────────────────────────────
const pillar = (i60, stemIdx, branchIdx) => {
  const s = stemIdx ?? i60 % 10, b = branchIdx ?? i60 % 12;
  return { stem: s, branch: b, hanja: STEMS[s].hanja + BRANCHES[b].hanja, ko: STEMS[s].ko + BRANCHES[b].ko };
};

/**
 * @param {{year:number, month:number, day:number, calendar?:'solar'|'lunar', leap?:boolean, hour?:number|null, minute?:number}} input
 */
export function computeSaju(input) {
  let { year, month, day } = input;
  const cal = new KoreanLunarCalendar();
  if (input.calendar === 'lunar') {
    if (!cal.setLunarDate(year, month, day, !!input.leap)) throw new Error('음력 날짜가 올바르지 않거나 지원 범위(1000~2050년)를 벗어났습니다.');
    ({ year, month, day } = cal.getSolarCalendar());
  } else if (!cal.setSolarDate(year, month, day)) {
    throw new Error('날짜가 올바르지 않거나 지원 범위(1000~2050년)를 벗어났습니다.');
  }
  const timeKnown = Number.isFinite(input.hour);
  const hh = timeKnown ? input.hour : 12, mi = timeKnown ? (input.minute || 0) : 0;
  const mo = toMoment(year, month, day, hh, mi);

  // 월지·연주: 절기 기준. 입춘(황경 315도)에서 寅월이 시작하고 30도마다 다음 달
  const lon = sunLongitude(mo.jdUT);
  const monthIdx = Math.floor((((lon - 315) % 360) + 360) % 360 / 30);   // 0 = 寅월
  const sajuYear = (month <= 2 && monthIdx >= 10) ? year - 1 : year;
  const yearP = pillar((((sajuYear - 4) % 60) + 60) % 60);
  const monthP = pillar(0, ((yearP.stem % 5) * 2 + 2 + monthIdx) % 10, (2 + monthIdx) % 12);

  // 일주: 태양시 23시 이후는 다음 날로 본다
  let dayJdn = timeKnown ? mo.solarJdn : jdn(year, month, day);
  if (timeKnown && mo.solarMin >= 23 * 60) dayJdn += 1;
  const dayP = pillar(((dayJdn + 49) % 60 + 60) % 60);

  let hourP = null;
  if (timeKnown) {
    const hb = Math.floor(((mo.solarMin + 60) % 1440) / 120);
    hourP = pillar(0, ((dayP.stem % 5) * 2 + hb) % 10, hb);
  }

  // 절기 경계 근처인지 (월주가 바뀔 수 있음)
  const toBoundaryDeg = Math.min(((lon - 315) % 30 + 30) % 30, 30 - ((lon - 315) % 30 + 30) % 30);
  const toBoundaryDays = toBoundaryDeg / 0.9856;
  const nearBoundary = timeKnown ? toBoundaryDays < 0.03 : toBoundaryDays < 0.6;

  return {
    input: { ...input }, solar: { year, month, day }, timeKnown,
    pillars: { year: yearP, month: monthP, day: dayP, hour: hourP },
    sunLongitude: +lon.toFixed(3), nearBoundary,
    lunar: cal.getLunarCalendar(), checkDayGapja: cal.getChineseGapja().day,
  };
}

// ── 풀이 ─────────────────────────────────────────────────────
const DAY_MASTER = [
  { image: '곧게 뻗은 큰 나무', text: '갑목(甲木) 일간은 하늘로 곧게 뻗은 큰 나무입니다. 한번 뜻을 세우면 굽히지 않는 곧은 기상과 앞장서는 추진력이 있고, 남을 품는 그늘이 넓습니다.', advice: '꺾이지 않으려다 부러질 수 있으니, 때로는 바람에 몸을 맡기는 유연함을 기르세요.' },
  { image: '바위틈에 피는 풀꽃', text: '을목(乙木) 일간은 어디서든 뿌리내리는 풀꽃과 덩굴입니다. 부드럽지만 끈질기고, 환경에 맞춰 길을 찾아내는 적응력과 섬세한 감각이 뛰어납니다.', advice: '남에게 맞추느라 자신을 잃지 않도록, 스스로 원하는 것을 자주 물어보세요.' },
  { image: '온 누리를 비추는 태양', text: '병화(丙火) 일간은 하늘의 태양입니다. 밝고 시원시원하며 숨김이 없고, 어디서나 분위기를 환하게 만드는 타고난 주인공입니다.', advice: '햇볕도 너무 뜨거우면 지치니, 남의 속도를 기다려 주는 여유를 가지세요.' },
  { image: '어둠을 밝히는 촛불', text: '정화(丁火) 일간은 밤을 밝히는 촛불과 등불입니다. 겉은 조용해도 속에 뜨거운 열정을 품었고, 한 사람을 끝까지 비추는 따뜻함과 집중력이 있습니다.', advice: '작은 바람에도 흔들리기 쉬우니, 마음을 지켜 줄 믿음직한 사람을 곁에 두세요.' },
  { image: '듬직한 큰 산', text: '무토(戊土) 일간은 우뚝 선 큰 산입니다. 묵직하고 믿음직해 사람들이 기대고, 쉽게 흔들리지 않는 중심과 포용력이 있습니다.', advice: '산은 스스로 움직이지 않으니, 기회가 왔을 때 한 걸음 먼저 내딛는 결단이 필요합니다.' },
  { image: '곡식을 기르는 기름진 밭', text: '기토(己土) 일간은 곡식을 기르는 논밭입니다. 세심하고 알뜰하며 사람을 길러 내는 재주가 있어, 곁에 있는 이들을 조용히 자라게 합니다.', advice: '남을 챙기느라 내 몫을 놓치기 쉬우니, 스스로에게도 거름을 주세요.' },
  { image: '제련되기 전의 단단한 쇠', text: '경금(庚金) 일간은 다듬어지지 않은 원석과 강철입니다. 의리와 결단력이 강하고 옳고 그름이 분명해, 어려운 일을 맡으면 끝까지 해냅니다.', advice: '담금질을 거쳐야 명검이 되니, 쓴소리와 시련을 자신을 벼리는 불로 여기세요.' },
  { image: '빛나는 보석', text: '신금(辛金) 일간은 잘 다듬어진 보석입니다. 섬세하고 깔끔하며 안목이 높아, 무엇이든 정교하게 완성하는 재능과 기품이 있습니다.', advice: '작은 흠에도 마음이 쓰이기 쉬우니, 완벽보다 완성을 목표로 삼으세요.' },
  { image: '끝없이 흐르는 큰 바다', text: '임수(壬水) 일간은 넓은 바다와 큰 강입니다. 생각이 깊고 스케일이 커서 많은 것을 품으며, 막히면 돌아가는 지혜로 결국 목적지에 닿습니다.', advice: '물은 넘치면 둑을 무너뜨리니, 큰 뜻일수록 차근차근 물길을 내세요.' },
  { image: '만물을 적시는 이슬비', text: '계수(癸水) 일간은 촉촉한 이슬비와 샘물입니다. 조용하지만 총명하고 직관이 뛰어나며, 보이지 않는 곳에서 사람을 살리는 섬세한 배려가 있습니다.', advice: '생각이 많아 걱정으로 번지기 쉬우니, 떠오른 생각을 글로 적어 비워 내세요.' },
];
const ELEMENT_EXCESS = {
  wood: '나무 기운이 많아 추진력과 성장욕이 강하지만, 고집이 세지고 간·근육 건강을 챙길 필요가 있습니다.',
  fire: '불 기운이 많아 열정과 표현력이 넘치지만, 서두르기 쉽고 심장·혈압을 살필 필요가 있습니다.',
  earth: '흙 기운이 많아 믿음직하고 끈기 있지만, 변화를 꺼리기 쉽고 위장을 챙길 필요가 있습니다.',
  metal: '쇠 기운이 많아 결단력과 원칙이 강하지만, 날카로워지기 쉽고 폐·호흡기를 살필 필요가 있습니다.',
  water: '물 기운이 많아 지혜롭고 유연하지만, 생각이 많아지기 쉽고 신장·몸의 냉기를 챙길 필요가 있습니다.',
};
const ELEMENT_LACK = {
  wood: '나무 기운이 비어 있어 새로 시작하는 힘을 기르면 좋습니다. 산책·식물 가꾸기, 초록색이 도움이 됩니다.',
  fire: '불 기운이 비어 있어 표현과 열정을 북돋우면 좋습니다. 햇볕 쬐기, 붉은색 소품이 도움이 됩니다.',
  earth: '흙 기운이 비어 있어 생활의 중심과 꾸준함을 다지면 좋습니다. 규칙적인 식사, 황토색이 도움이 됩니다.',
  metal: '쇠 기운이 비어 있어 결단과 정리의 힘을 기르면 좋습니다. 주변 정돈, 흰색·금속 소품이 도움이 됩니다.',
  water: '물 기운이 비어 있어 쉼과 사색의 시간을 늘리면 좋습니다. 충분한 물 마시기, 검정·남색이 도움이 됩니다.',
};
const ANIMAL_TEXT = {
  '쥐': '영리하고 재빠르며 살림 감각이 뛰어난', '소': '성실하고 우직해 끝내 결실을 맺는', '호랑이': '용맹하고 당당해 앞장서기를 좋아하는',
  '토끼': '온순하고 재치 있어 사람과 잘 어울리는', '용': '포부가 크고 기개가 넘치는', '뱀': '지혜롭고 신중해 기회를 놓치지 않는',
  '말': '활동적이고 자유로워 넓은 곳을 누비는', '양': '온화하고 예술적 감성이 풍부한', '원숭이': '재주가 많고 임기응변에 능한',
  '닭': '부지런하고 꼼꼼해 자기 일에 철저한', '개': '의리 있고 정직해 믿음을 주는', '돼지': '너그럽고 복이 많아 먹을 복이 따르는',
};
// 십성(十星): 일간과 다른 글자의 관계
const TEN_GODS = {
  same: { name: '비겁(比劫)', mean: '나와 같은 기운 · 형제·친구·독립심' },
  genMe: { name: '인성(印星)', mean: '나를 살리는 기운 · 학문·어머니·도움' },
  iGen: { name: '식상(食傷)', mean: '내가 살리는 기운 · 재능·표현·자식' },
  iCtrl: { name: '재성(財星)', mean: '내가 다스리는 기운 · 재물·현실감각' },
  ctrlMe: { name: '관성(官星)', mean: '나를 다스리는 기운 · 직업·명예·규율' },
};
function relation(me, other) {
  if (me === other) return 'same';
  if (GEN[other] === me) return 'genMe';
  if (GEN[me] === other) return 'iGen';
  if (CTRL[me] === other) return 'iCtrl';
  return 'ctrlMe';
}
const score = (z) => Math.round(clamp(77 + 9 * z, 55, 99));

export function interpretSaju(s) {
  const P = s.pillars;
  const list = [P.year, P.month, P.day, P.hour].filter(Boolean);
  const chars = [];
  for (const [i, p] of list.entries()) {
    chars.push({ kind: 'stem', pos: i, el: STEMS[p.stem].el, isDay: p === P.day });
    chars.push({ kind: 'branch', pos: i, el: BRANCHES[p.branch].el, isMonthBranch: p === P.month });
  }
  const counts = Object.fromEntries(ORDER.map(e => [e, 0]));
  for (const c of chars) counts[c.el]++;
  const dm = STEMS[P.day.stem];
  const others = chars.filter(c => !c.isDay);
  const gods = { same: 0, genMe: 0, iGen: 0, iCtrl: 0, ctrlMe: 0 };
  for (const c of others) gods[relation(dm.el, c.el)]++;

  // 신강·신약: 나를 돕는 글자(비겁·인성)의 비중. 태어난 달의 지지(월령)는 두 배로 친다.
  let support = 0, weight = 0;
  for (const c of others) {
    const w = c.isMonthBranch ? 2 : 1; weight += w;
    const r = relation(dm.el, c.el); if (r === 'same' || r === 'genMe') support += w;
  }
  const strength = support / weight;
  const strong = strength >= 0.5;

  const n = others.length, mean = n * 0.2, sd = Math.sqrt(n * 0.16);
  const zg = (k) => (gods[k] - mean) / sd;
  const branches = list.map(p => p.branch);
  const dohwa = branches.filter(b => [0, 3, 6, 9].includes(b)).length;          // 도화(子午卯酉)
  const zDohwa = (dohwa - branches.length / 3) / Math.sqrt(branches.length * 2 / 9);
  const present = ORDER.filter(e => counts[e] > 0).length;
  const maxCount = Math.max(...Object.values(counts));
  const zBalance = (present - 3.9) / 0.8 - (maxCount - 3) / 1.2;
  const fortunes = {
    wealth: score(zg('iCtrl')),
    love: score(0.6 * zg('iGen') + 0.5 * zDohwa),
    career: score(zg('ctrlMe')),
    health: score(zBalance * 0.8),
    social: score(0.7 * zg('same') + 0.4 * zg('genMe')),
  };

  const lack = ORDER.filter(e => counts[e] === 0);
  const excess = ORDER.filter(e => counts[e] >= 3);
  const animal = BRANCHES[P.year.branch].animal;
  const topGod = Object.entries(gods).sort((a, b) => b[1] - a[1])[0][0];
  return {
    dayMaster: { ...dm, index: P.day.stem, ...DAY_MASTER[P.day.stem], elName: EL[dm.el] },
    counts, lack, excess, strong, strength,
    gods, topGod: { key: topGod, ...TEN_GODS[topGod], count: gods[topGod] },
    tenGods: TEN_GODS,
    dohwa, animal, animalText: ANIMAL_TEXT[animal],
    fortunes,
    texts: {
      excess: excess.map(e => ELEMENT_EXCESS[e]),
      lack: lack.map(e => ELEMENT_LACK[e]),
      strength: strong
        ? '나를 돕는 기운이 넉넉한 신강(身强) 사주입니다. 스스로 일을 벌이고 이끌어 가는 힘이 강하니, 재물과 일의 기회를 적극적으로 잡으면 크게 성취합니다.'
        : '나를 돕는 기운보다 주변 기운이 강한 신약(身弱) 사주입니다. 혼자보다 좋은 사람·좋은 환경과 함께할 때 힘이 배가되니, 믿을 만한 조력자를 곁에 두세요.',
    },
  };
}

export const ELEMENTS = EL;
export { ANIMAL_TEXT };
export { GEN as ELEMENT_GEN, CTRL as ELEMENT_CTRL };
