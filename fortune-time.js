// ─────────────────────────────────────────────────────────────
//  때의 운세 (오락용): 오늘의 운세 · 올해·월별 운세 · 띠운세 · 별자리
//  - 사주의 일간(나)과 오늘·올해·이달의 간지가 만나는 관계를 십성(十星)으로 읽는다.
//    신강이면 식상·재성·관성이, 신약이면 인성·비겁이 나를 돕는 쪽으로 본다.
//  - 12운성(그날의 기운 세기), 지지의 합·충으로 영역별 점수를 조정한다. 같은 날엔 같은 결과가 나온다(무작위 없음).
//  - 별자리는 태어난 순간의 태양 황경으로 정하고, 오늘의 달 위치(저정밀 달 황경 계산)와의 각도로 오늘의 흐름을 읽는다.
// ─────────────────────────────────────────────────────────────
import { STEMS, BRANCHES, EL, ANIMAL_TEXT, ELEMENT_GEN as GEN, ELEMENT_CTRL as CTRL, computeSaju, sunLongitude } from './saju.js';
import { clamp } from './util.js';

export const AREA_KEYS = ['wealth', 'love', 'career', 'health', 'social'];
export const AREA_NAMES = { wealth: '재물운', love: '애정운', career: '직업·명예운', health: '건강운', social: '대인관계운' };
export const levelOf = (n) => (n >= 86 ? { hanja: '大吉', ko: '대길' } : n >= 78 ? { hanja: '吉', ko: '길' } : n >= 68 ? { hanja: '中吉', ko: '중길' } : n >= 58 ? { hanja: '平', ko: '평' } : { hanja: '小凶', ko: '조심' });
import { josa } from './physiognomy.js';

// ── 십성 ─────────────────────────────────────────────────────
// 일간(나)과 다른 천간의 관계: 오행 관계 + 음양이 같은지로 열 가지
const rel5 = (me, other) => (me === other ? 'same' : GEN[other] === me ? 'genMe' : GEN[me] === other ? 'iGen' : CTRL[me] === other ? 'iCtrl' : 'ctrlMe');
export function tenGod(meStem, otherStem) {
  const me = STEMS[meStem], o = STEMS[otherStem], same = me.yang === o.yang;
  return { same: same ? 'bigyeon' : 'geobjae', iGen: same ? 'siksin' : 'sanggwan', iCtrl: same ? 'pyeonjae' : 'jeongjae', ctrlMe: same ? 'pyeongwan' : 'jeonggwan', genMe: same ? 'pyeonin' : 'jeongin' }[rel5(me.el, o.el)];
}
const GODS = {
  bigyeon: { name: '비견(比肩)', kw: '동료와 경쟁',
    fav: '나와 같은 기운이 곁에서 힘을 보태 줍니다. 믿을 만한 동료·친구와 함께하면 일이 한결 수월하게 풀립니다.',
    unfav: '나와 비슷한 힘이 많아져 고집과 경쟁심이 커지기 쉽습니다. 내 방식만 고집하지 말고 한 발 물러서 나누는 것이 좋습니다.' },
  geobjae: { name: '겁재(劫財)', kw: '나눔과 승부',
    fav: '곁에 든든한 사람이 나서서 나를 도와줍니다. 도움을 받는 만큼 보답할 일도 생기니 신세는 그때그때 갚으세요.',
    unfav: '나누어 가져가려는 기운이라 지출과 경쟁이 늘 수 있습니다. 보증·동업·충동 소비는 한 번 더 따져 보세요.' },
  siksin: { name: '식신(食神)', kw: '재능과 여유',
    fav: '재능과 여유가 흘러나오는 기운입니다. 먹고 즐기고 표현할수록 운이 열리니 하고 싶던 일을 시작해 보세요.',
    unfav: '힘이 밖으로 새어 나가 기운이 처질 수 있습니다. 베풀더라도 쉬는 시간을 먼저 챙기세요.' },
  sanggwan: { name: '상관(傷官)', kw: '표현과 변화',
    fav: '아이디어와 표현력이 번뜩이는 기운입니다. 발표·창작·새로운 제안에서 빛을 봅니다.',
    unfav: '말과 행동이 앞서 구설이나 마찰이 생기기 쉽습니다. 윗사람이나 규칙과는 부드럽게 맞추세요.' },
  pyeonjae: { name: '편재(偏財)', kw: '기회와 활동',
    fav: '뜻밖의 수입과 기회가 눈에 띄는 기운입니다. 활동 반경을 넓히면 재물의 문이 열립니다.',
    unfav: '씀씀이와 욕심이 커지기 쉬운 때입니다. 큰돈이 오가는 일은 서두르지 말고 확인하세요.' },
  jeongjae: { name: '정재(正財)', kw: '꾸준한 결실',
    fav: '꾸준한 노력이 알찬 결실로 돌아오는 기운입니다. 월급·저축처럼 안정적인 재물이 늘어납니다.',
    unfav: '현실적인 부담과 책임이 무겁게 느껴질 수 있습니다. 챙길 것이 많아도 우선순위를 정해 하나씩 처리하세요.' },
  pyeongwan: { name: '편관(偏官)', kw: '도전과 압박',
    fav: '도전과 압박이 오히려 나를 단련시키는 기운입니다. 책임이 큰 일을 맡으면 실력을 인정받습니다.',
    unfav: '압박과 긴장이 커서 몸과 마음이 쉽게 지칠 수 있습니다. 무리한 일정과 다툼은 피하고 충분히 쉬세요.' },
  jeonggwan: { name: '정관(正官)', kw: '신뢰와 명예',
    fav: '질서와 신뢰의 기운으로 인정받고 명예가 따릅니다. 규칙을 지키고 성실하게 임하면 좋은 평가가 돌아옵니다.',
    unfav: '규범과 책임에 얽매여 답답하게 느껴질 수 있습니다. 완벽하려 하기보다 할 수 있는 만큼만 하세요.' },
  pyeonin: { name: '편인(偏印)', kw: '직관과 몰입',
    fav: '남다른 직관과 배움의 기운입니다. 새로운 분야를 파고들거나 혼자 몰입하는 시간이 큰 힘이 됩니다.',
    unfav: '생각이 많아지고 변덕이 늘 수 있습니다. 새로 벌이기보다 시작한 일을 마무리하는 데 집중하세요.' },
  jeongin: { name: '정인(正印)', kw: '귀인과 배움',
    fav: '귀인과 배움의 도움이 따르는 기운입니다. 어른이나 스승의 조언, 공부와 자격 준비에 좋습니다.',
    unfav: '보살핌을 받다 보면 느긋해지고 결단이 늦어질 수 있습니다. 스스로 움직여야 할 때를 놓치지 마세요.' },
};
// 신강이면 [식상·재성·관성]이, 신약이면 [인성·비겁]이 나를 돕는다. 값은 도움의 정도(-1~1).
const FAV = {
  strong: { bigyeon: -.7, geobjae: -1, siksin: 1, sanggwan: .6, pyeonjae: .8, jeongjae: .9, pyeongwan: .4, jeonggwan: 1, pyeonin: -.6, jeongin: -.5 },
  weak: { bigyeon: .8, geobjae: .4, siksin: -.2, sanggwan: -.5, pyeonjae: -.4, jeongjae: -.5, pyeongwan: -1, jeonggwan: -.3, pyeonin: .7, jeongin: 1 },
};
// 십성이 어느 영역과 가까운지 (0~1)
const THEME = {
  bigyeon: { wealth: .3, love: .3, career: .4, health: .6, social: 1 },
  geobjae: { wealth: .9, love: .4, career: .3, health: .4, social: .7 },
  siksin: { wealth: .6, love: .9, career: .4, health: .9, social: .7 },
  sanggwan: { wealth: .4, love: .7, career: .5, health: .4, social: .7 },
  pyeonjae: { wealth: 1, love: .5, career: .5, health: .3, social: .6 },
  jeongjae: { wealth: 1, love: .7, career: .5, health: .4, social: .4 },
  pyeongwan: { wealth: .3, love: .3, career: .9, health: .8, social: .4 },
  jeonggwan: { wealth: .4, love: .7, career: 1, health: .4, social: .5 },
  pyeonin: { wealth: .3, love: .3, career: .6, health: .5, social: .3 },
  jeongin: { wealth: .3, love: .4, career: .8, health: .7, social: .5 },
};

// ── 12운성: 일간이 그 날(달·해)의 지지에서 얼마나 기운이 센가 ─────
const STAGES = [
  { name: '장생(長生)', text: '새 출발의 기운이 돋아나는 때', e: .6 }, { name: '목욕(沐浴)', text: '들뜨고 변화가 잦은 때', e: 0 },
  { name: '관대(冠帶)', text: '자신감이 오르고 나서기 좋은 때', e: .7 }, { name: '건록(建祿)', text: '실력이 안정되고 힘이 차오르는 때', e: .9 },
  { name: '제왕(帝旺)', text: '기운이 가장 왕성한 정점의 때', e: 1 }, { name: '쇠(衰)', text: '한풀 꺾여 차분히 내실을 다질 때', e: .2 },
  { name: '병(病)', text: '기운이 떨어지기 쉬워 몸을 아껴야 할 때', e: -.4 }, { name: '사(死)', text: '활동을 줄이고 정리·휴식이 필요한 때', e: -.6 },
  { name: '묘(墓)', text: '안으로 갈무리하며 저장하는 때', e: -.2 }, { name: '절(絶)', text: '흐름이 끊겨 새 판을 구상하는 때', e: -.5 },
  { name: '태(胎)', text: '새 가능성이 싹트는 준비의 때', e: .1 }, { name: '양(養)', text: '보살핌 속에 힘을 기르는 때', e: .3 },
];
const LIFE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];   // 甲乙丙丁戊己庚辛壬癸 의 장생 지지 (子=0 … 亥=11)
export function stageOf(stem, branch) {
  const dir = STEMS[stem].yang ? 1 : -1;
  return STAGES[(((branch - LIFE_START[stem]) * dir) % 12 + 12) % 12];
}

// ── 지지의 관계 ──────────────────────────────────────────────
export function branchRel(a, b) {
  if (a === b) return 'same';
  if ((a + b) % 12 === 1) return 'yukhap';        // 육합 (子丑, 寅亥, 卯戌, 辰酉, 巳申, 午未)
  if (Math.abs(a - b) === 6) return 'chung';      // 충
  if (a % 4 === b % 4) return 'samhap';           // 삼합 (申子辰, 寅午戌, 巳酉丑, 亥卯未)
  if (a + b === 7 || a + b === 19) return 'hae';  // 육해
  return null;
}
const REL_NAME = { same: '같은 기운', yukhap: '육합(六合)', chung: '충(沖)', samhap: '삼합(三合)', hae: '해(害)' };

// ── 점수 ─────────────────────────────────────────────────────
/**
 * @param me     { stem, dayBranch, yearBranch, strong }  나의 일간·일지·띠 지지, 신강 여부
 * @param target { stem, branch }                          그 날(달·해)의 천간·지지
 */
export function scoreTime(me, target) {
  const god = tenGod(me.stem, target.stem);
  const fav = FAV[me.strong ? 'strong' : 'weak'][god];
  const stage = stageOf(me.stem, target.branch);
  const dayRel = branchRel(me.dayBranch, target.branch), yearRel = branchRel(me.yearBranch, target.branch);
  const adj = { wealth: 0, love: 0, career: 0, health: 0, social: 0 };
  if (dayRel === 'chung') { adj.love -= 7; adj.health -= 5; } else if (dayRel === 'yukhap') { adj.love += 6; adj.health += 2; } else if (dayRel === 'samhap') { adj.love += 3; adj.social += 2; }
  if (yearRel === 'chung') { adj.social -= 6; adj.wealth -= 3; } else if (yearRel === 'yukhap') adj.social += 6; else if (yearRel === 'samhap') { adj.social += 4; adj.career += 2; } else if (yearRel === 'hae') adj.social -= 3;
  const scores = {};
  for (const k of AREA_KEYS) {
    const t = THEME[god][k];
    scores[k] = Math.round(clamp(71 + fav * 13 * (0.45 + 0.55 * t) + (t - 0.55) * 9 + stage.e * (k === 'health' ? 7 : 4) + adj[k], 48, 98));
  }
  const avg = Math.round(AREA_KEYS.reduce((a, k) => a + scores[k], 0) / 5);
  return { god, godInfo: GODS[god], fav, favorable: fav >= 0.3, stage, dayRel, yearRel, scores, avg, level: levelOf(avg) };
}

// ── 나에게 도움이 되는 기운: 행운의 색·방향·숫자·시간 ──────────
const NUM = { wood: [3, 8], fire: [2, 7], earth: [5, 10], metal: [4, 9], water: [1, 6] };
const HOURS = { wood: '새벽 3~7시', fire: '오전 9시~오후 1시', earth: '오전 7~9시·오후 1~3시', metal: '오후 3~7시', water: '밤 9시~새벽 1시' };
export function luckyOf(me, seed) {
  const meEl = STEMS[me.stem].el;
  const el = me.strong ? ([...Object.keys(GEN)].find(k => GEN[meEl] === k)) : ([...Object.keys(GEN)].find(k => GEN[k] === meEl));
  return { el, info: EL[el], number: NUM[el][seed % 2], hours: HOURS[el] };
}

const ganjiOf = (p) => `${p.ko}(${p.hanja})`;
export const meOf = (state) => ({
  stem: state.saju.pillars.day.stem, dayBranch: state.saju.pillars.day.branch, yearBranch: state.saju.pillars.year.branch,
  strong: state.reading.strong, dmName: `${STEMS[state.saju.pillars.day.stem].ko}${EL[STEMS[state.saju.pillars.day.stem].el].ko}(${STEMS[state.saju.pillars.day.stem].hanja}${EL[STEMS[state.saju.pillars.day.stem].el].hanja})`,
});
const pickAreas = (scores) => { const o = AREA_KEYS.map(k => [k, scores[k]]).sort((a, b) => b[1] - a[1]); return { best: o[0], worst: o[o.length - 1] }; };

const RELTEXT = {
  day: {
    chung: '오늘의 지지가 내 일지와 부딪히는 충(沖)이라 가까운 사이에서 말이 엇갈리거나 몸이 피곤할 수 있습니다. 약속과 이동은 여유 있게 잡으세요.',
    yukhap: '오늘의 지지가 내 일지와 합(合)을 이루어 가까운 사람과 마음이 잘 통합니다. 만남과 대화에 좋은 날입니다.',
    samhap: '오늘의 지지가 내 일지와 삼합의 결이라 주변과 호흡이 맞습니다.',
  },
  year: {
    chung: '오늘의 지지가 내 띠와 충을 이루어 사람 사이에 변수가 생기기 쉽습니다. 말과 약속을 한 번 더 확인하세요.',
    yukhap: '오늘의 지지가 내 띠와 합을 이루어 인연과 도움이 따릅니다.',
    samhap: '오늘의 지지가 내 띠와 삼합이라 협력하면 힘이 커집니다.',
    hae: '오늘의 지지가 내 띠와 해(害) 관계라 사소한 오해가 생길 수 있으니 표현을 부드럽게 하세요.',
  },
};
const ADVICE_LEVEL = {
  '대길': '흐름이 아주 좋은 날입니다. 미뤄 둔 중요한 일이나 제안을 오늘 꺼내 보세요.',
  '길': '대체로 순조로운 날입니다. 계획한 일을 차근차근 밀고 나가세요.',
  '중길': '무난한 날입니다. 욕심을 줄이고 해야 할 일에 집중하면 알찬 하루가 됩니다.',
  '평': '큰 변화 없이 잔잔한 날입니다. 내실을 다지고 쉬어 가기 좋습니다.',
  '조심': '기운이 가라앉는 날입니다. 큰 결정과 무리한 일정은 미루고 몸과 마음을 챙기세요.',
};

// ── 오늘의 운세 ──────────────────────────────────────────────
export function dailyFortune(state, date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const s = computeSaju({ year: y, month: m, day: d, calendar: 'solar', hour: 12, minute: 0 });
  const day = s.pillars.day, me = meOf(state);
  const r = scoreTime(me, { stem: day.stem, branch: day.branch });
  const { best, worst } = pickAreas(r.scores);
  const lucky = luckyOf(me, d);
  const texts = [];
  texts.push(`오늘은 ${ganjiOf(day)}일, 나의 일간 ${me.dmName}에게는 ${r.godInfo.name}의 날입니다. ${r.favorable ? r.godInfo.fav : r.godInfo.unfav}`);
  texts.push(`일간이 오늘의 지지에서 ${r.stage.name}에 놓여 ${r.stage.text}입니다.`);
  const rels = [];
  if (RELTEXT.day[r.dayRel]) rels.push(RELTEXT.day[r.dayRel]);
  if (RELTEXT.year[r.yearRel]) rels.push(RELTEXT.year[r.yearRel]);
  if (rels.length) texts.push(rels.join(' '));
  texts.push(`영역별로는 ${josa(AREA_NAMES[best[0]], '이', '가')} ${best[1]}점으로 가장 좋고 ${josa(AREA_NAMES[worst[0]], '은', '는')} ${worst[1]}점으로 조심할 자리입니다. ${ADVICE_LEVEL[r.level.ko]}`);
  const isToday = new Date().toDateString() === date.toDateString();
  const moon = moonInfo(date, isToday);
  const zodiac = zodiacProfile(state);
  const aspect = aspectOf(moon.lon, zodiac.lon);
  return { date: { y, m, d }, ganji: ganjiOf(day), dayPillar: day, ...r, best, worst, lucky, texts, moon, aspect, zodiac };
}

// ── 올해·월별 운세 + 띠운세 ──────────────────────────────────
const ANIMAL_REL = {
  same: { title: '본명년(띠의 해)', text: '내 띠와 같은 해라 환경과 마음에 큰 전환이 오기 쉽습니다. 새 출발에는 좋지만 몸과 마음을 아껴 쓰고, 큰 결정은 한 번 더 확인하세요.' },
  samhap: { title: '삼합(三合)의 해', text: '내 띠와 삼합을 이루는 해라 귀인과 협력이 따릅니다. 사람과 함께하는 일에서 크게 성과를 냅니다.' },
  yukhap: { title: '육합(六合)의 해', text: '내 띠와 합을 이루는 해라 좋은 인연과 도움이 늘고 일이 부드럽게 풀립니다.' },
  chung: { title: '충(沖)의 해', text: '내 띠와 정면으로 부딪히는 해라 이동·이사·이직 같은 변화가 생기기 쉽습니다. 건강과 안전, 사람 사이 말조심이 필요하지만 변화를 잘 타면 도약의 기회도 됩니다.' },
  hae: { title: '해(害)의 해', text: '내 띠와 서로 어긋나는 해라 사소한 오해와 구설이 생기기 쉽습니다. 믿는 사람과도 표현을 부드럽게 하세요.' },
  none: { title: '평탄한 해', text: '내 띠와 특별히 부딪히거나 합하는 관계가 없어 큰 변수 없이 흘러갑니다. 스스로 정한 목표를 꾸준히 밀고 가기에 좋습니다.' },
};
const partnerAnimals = (b) => {
  const find = (fn) => BRANCHES.filter((_, i) => i !== b && fn(i)).map(x => x.animal);
  return { samhap: find(i => i % 4 === b % 4), yukhap: find(i => (i + b) % 12 === 1), chung: find(i => Math.abs(i - b) === 6), hae: find(i => i + b === 7 || i + b === 19) };
};
export function yearlyFortune(state, date = new Date()) {
  const y = date.getFullYear(), me = meOf(state);
  const yp = computeSaju({ year: y, month: 6, day: 15, calendar: 'solar', hour: 12, minute: 0 }).pillars.year;   // 그 해의 간지 (입춘 전 1~2월에도 달력의 해 기준)
  const r = scoreTime(me, { stem: yp.stem, branch: yp.branch });
  const { best, worst } = pickAreas(r.scores);
  // 달마다: 그 달 15일의 월주를 쓴다 (절기 경계와 겹치지 않는 날)
  const months = [];
  for (let mo = 1; mo <= 12; mo++) {
    const sj = computeSaju({ year: y, month: mo, day: 15, calendar: 'solar', hour: 12, minute: 0 });
    const mp = sj.pillars.month, rr = scoreTime(me, { stem: mp.stem, branch: mp.branch });
    months.push({ month: mo, ganji: ganjiOf(mp), branch: mp.branch, god: rr.god, godInfo: rr.godInfo, favorable: rr.favorable, avg: rr.avg, level: rr.level, scores: rr.scores, stage: rr.stage });
  }
  const sorted = [...months].sort((a, b) => b.avg - a.avg);
  const best3 = sorted.slice(0, 3).sort((a, b) => a.month - b.month), worst3 = sorted.slice(-3).sort((a, b) => a.month - b.month);
  const animal = BRANCHES[me.yearBranch].animal;
  const aRel = branchRel(me.yearBranch, yp.branch) || 'none';
  const partners = partnerAnimals(me.yearBranch);
  const texts = [];
  texts.push(`${y}년은 ${ganjiOf(yp)}년, 나의 일간 ${me.dmName}에게는 ${r.godInfo.name}의 해입니다. ${r.favorable ? r.godInfo.fav : r.godInfo.unfav}`);
  texts.push(`올해 일간의 기운은 ${josa(r.stage.name, '으로', '로')} ${r.stage.text}입니다. 한 해 평균은 ${r.avg}점(${r.level.ko})이고 ${josa(AREA_NAMES[best[0]], '이', '가')} ${best[1]}점으로 가장 좋고 ${josa(AREA_NAMES[worst[0]], '은', '는')} ${worst[1]}점으로 조심할 자리입니다.`);
  texts.push(`달로 보면 ${best3.map(x => x.month + '월').join('·')}이 흐름이 좋고, ${worst3.map(x => x.month + '월').join('·')}은 기운이 가라앉아 쉬어 가기 좋습니다.`);
  return { year: y, ganji: ganjiOf(yp), yearPillar: yp, ...r, best, worst, months, best3, worst3, texts,
    zodiacAnimal: { animal, desc: ANIMAL_TEXT[animal], rel: aRel, relName: REL_NAME[aRel] || '관계 없음', ...ANIMAL_REL[aRel], partners } };
}

// ── 별자리 ───────────────────────────────────────────────────
export const SIGNS = [
  { name: '양자리', sym: '♈', el: 'fire', elKo: '불', mode: '활동', ruler: '화성', dates: '3.21~4.19', kw: '시작과 도전',
    text: '무엇이든 먼저 부딪혀 보는 개척가입니다. 솔직하고 에너지가 넘치며 승부욕이 강합니다.', love: '마음에 들면 직진하는 솔직한 연애를 합니다.', career: '새 일을 열고 이끄는 자리에서 빛납니다.', caution: '성급함과 욱하는 마음을 다스리세요.' },
  { name: '황소자리', sym: '♉', el: 'earth', elKo: '흙', mode: '고정', ruler: '금성', dates: '4.20~5.20', kw: '안정과 감각',
    text: '차분하고 끈기 있게 한 걸음씩 쌓아 가는 현실가입니다. 맛과 멋, 편안함을 아는 감각이 뛰어납니다.', love: '천천히 깊어지고 한번 맺으면 오래 갑니다.', career: '꾸준함이 필요한 재무·예술·기술 분야에 강합니다.', caution: '고집과 변화에 대한 저항을 경계하세요.' },
  { name: '쌍둥이자리', sym: '♊', el: 'air', elKo: '공기', mode: '변통', ruler: '수성', dates: '5.21~6.21', kw: '호기심과 소통',
    text: '재치 있고 말솜씨가 좋으며 배움이 빠릅니다. 관심사가 넓어 늘 새로운 것을 찾습니다.', love: '대화가 통하는 사람에게 끌립니다.', career: '기획·미디어·교육·영업에 어울립니다.', caution: '일을 벌여 놓고 마무리하지 못하는 산만함을 조심하세요.' },
  { name: '게자리', sym: '♋', el: 'water', elKo: '물', mode: '활동', ruler: '달', dates: '6.22~7.22', kw: '돌봄과 공감',
    text: '정이 깊고 가까운 사람을 아끼는 보호자입니다. 감수성이 풍부하고 기억력이 좋습니다.', love: '안전하다고 느끼면 한없이 헌신합니다.', career: '사람을 돌보고 지키는 일, 요리·상담·교육에 맞습니다.', caution: '감정 기복과 상처를 오래 품는 것을 조심하세요.' },
  { name: '사자자리', sym: '♌', el: 'fire', elKo: '불', mode: '고정', ruler: '태양', dates: '7.23~8.22', kw: '자신감과 표현',
    text: '당당하고 따뜻한 무대의 주인공입니다. 너그럽고 사람을 이끄는 카리스마가 있습니다.', love: '열정적이고 아낌없이 주는 연애를 합니다.', career: '리더·공연·브랜딩처럼 드러나는 일에서 빛납니다.', caution: '자존심과 인정받고 싶은 욕구를 다스리세요.' },
  { name: '처녀자리', sym: '♍', el: 'earth', elKo: '흙', mode: '변통', ruler: '수성', dates: '8.23~9.22', kw: '분석과 완성',
    text: '꼼꼼하고 성실하며 세부를 놓치지 않는 분석가입니다. 도움이 되는 사람이 되고 싶어 합니다.', love: '표현은 서툴러도 행동으로 챙깁니다.', career: '분석·의료·편집·품질 관리에 강합니다.', caution: '지나친 완벽주의와 걱정을 내려놓으세요.' },
  { name: '천칭자리', sym: '♎', el: 'air', elKo: '공기', mode: '활동', ruler: '금성', dates: '9.23~10.23', kw: '균형과 조화',
    text: '공정하고 세련된 중재자입니다. 사람 사이의 균형과 아름다움을 중요하게 생각합니다.', love: '분위기와 매너를 중시하는 로맨티스트입니다.', career: '디자인·외교·법·서비스 분야에 어울립니다.', caution: '결정을 미루는 우유부단함을 조심하세요.' },
  { name: '전갈자리', sym: '♏', el: 'water', elKo: '물', mode: '고정', ruler: '명왕성·화성', dates: '10.24~11.22', kw: '집중과 통찰',
    text: '깊이 파고드는 집중력과 날카로운 통찰을 가졌습니다. 속마음을 잘 드러내지 않지만 한번 믿으면 끝까지 갑니다.', love: '깊고 강렬하게 몰입하는 사랑을 합니다.', career: '연구·수사·심리·금융에서 강점이 있습니다.', caution: '의심과 집착을 경계하세요.' },
  { name: '사수자리', sym: '♐', el: 'fire', elKo: '불', mode: '변통', ruler: '목성', dates: '11.23~12.21', kw: '자유와 탐험',
    text: '낙천적이고 자유로운 탐험가입니다. 넓은 세상과 배움, 철학에 끌립니다.', love: '자유를 존중해 주는 사람과 잘 맞습니다.', career: '여행·교육·출판·무역에 어울립니다.', caution: '말이 앞서고 약속을 가볍게 여기지 않도록 하세요.' },
  { name: '염소자리', sym: '♑', el: 'earth', elKo: '흙', mode: '활동', ruler: '토성', dates: '12.22~1.19', kw: '책임과 성취',
    text: '목표를 세우면 묵묵히 이루어 내는 현실적인 노력가입니다. 책임감이 강하고 늦게 빛나는 대기만성형입니다.', love: '신중하게 시작해 신뢰로 오래 갑니다.', career: '관리·경영·건축·공공 분야에 강합니다.', caution: '일 중심의 삶과 감정 표현 부족을 조심하세요.' },
  { name: '물병자리', sym: '♒', el: 'air', elKo: '공기', mode: '고정', ruler: '천왕성·토성', dates: '1.20~2.18', kw: '독창과 자유',
    text: '독창적이고 합리적인 자유로운 사상가입니다. 틀에 얽매이지 않고 사람과 사회에 관심이 많습니다.', love: '친구 같은 편안함을 원합니다.', career: '기술·연구·사회 혁신·창작에 어울립니다.', caution: '거리를 두고 고집을 부리지 않도록 하세요.' },
  { name: '물고기자리', sym: '♓', el: 'water', elKo: '물', mode: '변통', ruler: '목성·해왕성', dates: '2.19~3.20', kw: '감성과 상상',
    text: '감수성이 풍부하고 공감 능력이 뛰어난 몽상가입니다. 예술적 영감과 직관이 강합니다.', love: '헌신적이고 로맨틱한 사랑을 합니다.', career: '예술·치유·음악·돌봄 분야에 어울립니다.', caution: '현실을 피하고 경계가 흐려지지 않도록 하세요.' },
];
export const signOf = (lon) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)];

/** 태어난 순간의 태양 황경으로 정한 태양 별자리와, 잘 맞는 별자리 */
export function zodiacProfile(state) {
  const lon = state.saju.sunLongitude, idx = Math.floor(lon / 30), sign = SIGNS[idx];
  const within = lon - idx * 30;
  const at = (off) => SIGNS[(idx + off + 12) % 12].name;
  return {
    lon, idx, sign, within, nearBoundary: within < 0.6 || within > 29.4, boundaryNote: within < 0.6 || within > 29.4 ? '별자리가 바뀌는 날 가까이 태어나셨습니다. 태어난 시각에 따라 이웃 별자리일 수 있습니다.' : '',
    best: [at(4), at(-4)], good: [at(2), at(-2)], attract: [at(6)], tense: [at(3), at(-3)],
  };
}

// ── 달의 위치 (저정밀 계산, 오차 약 0.3°) ────────────────────
export function moonLongitude(jd) {
  const T = (jd - 2451545.0) / 36525, r = Math.PI / 180, s = (x) => Math.sin(x * r);
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;
  const lon = Lp + 6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + 0.658314 * s(2 * D) + 0.213618 * s(2 * Mp) - 0.185116 * s(M) - 0.114332 * s(2 * F)
    + 0.058793 * s(2 * D - 2 * Mp) + 0.057066 * s(2 * D - M - Mp) + 0.053322 * s(2 * D + Mp) + 0.045758 * s(2 * D - M) - 0.040923 * s(M - Mp) - 0.034720 * s(D) - 0.030383 * s(M + Mp);
  return ((lon % 360) + 360) % 360;
}
const PHASES = [['삭(그믐달에서 새달로)', '새로 시작하고 씨앗을 심기 좋은 때'], ['초승달', '조심스럽게 시작을 키우는 때'], ['상현달', '행동하고 결정할 때'], ['차오르는 달', '다듬고 보완하는 때'],
  ['보름달', '결실이 드러나고 감정이 고조되는 때'], ['기우는 달', '나누고 감사하는 때'], ['하현달', '정리하고 내려놓는 때'], ['그믐달', '쉬고 비우는 때']];
export function moonInfo(date, instant = true) {
  // 오늘이면 지금 이 순간, 다른 날짜면 그날 정오의 달
  const j = instant ? date.getTime() / 86400000 + 2440587.5 : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime() / 86400000 + 2440587.5;
  const lon = moonLongitude(j), sun = sunLongitude(j);
  const elong = (((lon - sun) % 360) + 360) % 360, ph = PHASES[Math.round(elong / 45) % 8];
  return { lon, sign: signOf(lon), elong, phase: ph[0], phaseText: ph[1] };
}
const ASPECTS = [
  { deg: 0, name: '합(0°)', score: 82, text: '오늘 달이 당신의 태양 별자리 가까이 와 감정이 선명하고 자신감이 오릅니다. 새 일을 시작하기 좋습니다.' },
  { deg: 60, name: '육분(60°)', score: 86, text: '오늘 달이 당신의 별자리와 부드럽게 연결되어 기회와 도움이 자연스럽게 따릅니다.' },
  { deg: 90, name: '사각(90°)', score: 64, text: '오늘 달이 당신의 별자리와 긴장 각을 이루어 마음이 급해지거나 일이 어긋나기 쉽습니다. 서두르지 마세요.' },
  { deg: 120, name: '삼각(120°)', score: 92, text: '오늘 달이 당신의 별자리와 조화로운 각을 이루어 마음이 편하고 일이 매끄럽게 풀립니다.' },
  { deg: 180, name: '대립(180°)', score: 70, text: '오늘 달이 당신의 별자리 맞은편에 있어 주변 사람과 입장 차이가 드러나기 쉽습니다. 배려로 균형을 맞추세요.' },
];
export function aspectOf(moonLon, natalLon) {
  let d = Math.abs(moonLon - natalLon) % 360; if (d > 180) d = 360 - d;
  const hit = ASPECTS.find(a => Math.abs(d - a.deg) <= 8);
  return hit ? { ...hit, orb: +Math.abs(d - hit.deg).toFixed(1) } : { deg: null, name: '뚜렷한 각 없음', score: 76, text: '오늘 달은 큰 각 없이 흘러 평온한 하루입니다. 내 페이스를 지키세요.', orb: null };
}
