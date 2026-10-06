// ─────────────────────────────────────────────────────────────
//  궁합 (오락용): 두 사람의 사주·띠·별자리를 비교한다. 두 사람을 바꿔 넣어도 점수는 같다(대칭).
//   마음(일간) 30% · 생활(일지) 25% · 인연(띠) 15% · 보완(오행) 15% · 감성(별자리) 15%
//  - 일간: 천간합이면 끌림이 크고, 오행이 서로 살리면 좋고, 서로 누르면 맞춰 가야 한다.
//  - 일지: 가장 가까운 자리(배우자궁)끼리의 합·충.   - 띠: 태어난 해 지지의 합·충.
//  - 보완: 한쪽에 비어 있는 오행을 상대가 채워 주는지.   - 별자리: 태양 별자리의 각도(같은 원소·육분·사각 등).
// ─────────────────────────────────────────────────────────────
import { STEMS, BRANCHES, EL } from './saju.js';
import { tenGod, branchRel, SIGNS, zodiacProfile } from './fortune-time.js';
import { josa } from './physiognomy.js';

export const MATCH_AXES = [
  { key: 'heart', label: '마음', weight: 0.30 }, { key: 'life', label: '생활', weight: 0.25 }, { key: 'fate', label: '인연', weight: 0.15 },
  { key: 'balance', label: '보완', weight: 0.15 }, { key: 'star', label: '감성', weight: 0.15 },
];
const GEN = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' }, CTRL = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
const ORDER = ['wood', 'fire', 'earth', 'metal', 'water'];

const ROLE = {
  bigyeon: '곁에서 어깨를 나란히 하는 친구 같은 존재', geobjae: '경쟁하며 서로를 자극하는 존재', siksin: '함께 있으면 즐겁고 여유를 주는 존재',
  sanggwan: '재치와 신선한 자극을 주는 존재', pyeonjae: '활력과 새로운 기회를 가져다주는 존재', jeongjae: '현실적으로 든든하게 챙겨 주는 존재',
  pyeongwan: '긴장감과 도전을 주는 강한 존재', jeonggwan: '믿음직하고 중심을 잡아 주는 존재', pyeonin: '독특한 영감을 주는 존재', jeongin: '보살피고 가르쳐 주는 존재',
};
const STEM_HAP = { 0: ['갑기합(甲己合)', '중정(中正)의 합으로 서로 믿고 의지하는 인연'], 1: ['을경합(乙庚合)', '인의(仁義)의 합으로 의리가 깊은 인연'], 2: ['병신합(丙辛合)', '위엄과 매력으로 강하게 끌리는 인연'],
  3: ['정임합(丁壬合)', '정이 깊어 서로에게 스며드는 인연'], 4: ['무계합(戊癸合)', '조용히 서로를 채워 주는 인연'] };
const BR_DAY = { yukhap: ['육합', '가장 가까운 자리에서 마음이 통해 함께 있으면 편안합니다.', 94], samhap: ['삼합', '생활 리듬과 가치관이 잘 맞아 손발이 척척 맞습니다.', 88],
  same: ['같은 지지', '닮은 점이 많아 서로를 잘 이해하지만 같은 약점도 닮았습니다.', 76], chung: ['충(沖)', '가까이 있을수록 부딪히기 쉬워 말투와 생활 습관을 맞춰 가야 합니다.', 52],
  hae: ['해(害)', '사소한 오해가 쌓이기 쉬우니 서운함은 바로 말로 푸세요.', 58], none: ['특별한 관계 없음', '특별히 부딪히거나 끌리는 힘은 없어 두 사람이 만드는 만큼 가까워집니다.', 72] };
const BR_YEAR = { yukhap: ['육합', '띠가 서로 합을 이뤄 자연스럽게 인연이 이어집니다.', 92], samhap: ['삼합', '띠가 삼합이라 함께하면 시너지가 큽니다.', 90],
  same: ['같은 띠', '같은 띠라 또래 같은 공감대가 있습니다.', 74], chung: ['충(沖)', '띠가 정면으로 부딪혀 의견 충돌이 잦을 수 있지만 서로 자극이 되기도 합니다.', 55],
  hae: ['해(害)', '띠가 어긋나는 관계라 서운함이 쌓이지 않게 표현이 필요합니다.', 60], none: ['평범한 관계', '띠로는 특별한 관계가 없어 무난합니다.', 72] };
const STAR_ASPECT = [
  { diff: 0, name: '같은 별자리', score: 78, text: '같은 별자리라 서로의 마음을 잘 알지만 고집이 부딪힐 수도 있습니다.' },
  { diff: 1, name: '이웃 별자리', score: 68, text: '이웃한 별자리라 비슷한 듯 다른 점이 있어 배우는 것이 많습니다.' },
  { diff: 2, name: '육분(60°)', score: 84, text: '육분을 이루는 별자리라 서로 자극과 도움이 자연스럽습니다.' },
  { diff: 3, name: '사각(90°)', score: 62, text: '사각을 이루는 별자리라 긴장감이 있지만 서로를 성장시킵니다.' },
  { diff: 4, name: '삼각(120°)', score: 92, text: '같은 원소의 삼각이라 말하지 않아도 통하는 편안한 사이입니다.' },
  { diff: 5, name: '150°', score: 66, text: '서로 낯선 면이 많아 이해하려는 노력이 필요한 사이입니다.' },
  { diff: 6, name: '대립(180°)', score: 76, text: '정반대의 별자리라 강하게 끌리면서도 입장이 갈릴 수 있습니다.' },
];

const GRADES = [[88, '천생연분', '서로가 서로의 빈 곳을 채우는 보기 드문 인연입니다.'], [80, '찰떡궁합', '함께할수록 힘이 커지는 좋은 짝입니다.'], [72, '좋은 인연', '큰 무리 없이 마음이 통하는 편안한 사이입니다.'],
  [64, '맞춰 가는 사이', '다른 점이 있지만 서로 맞추면 오래갈 수 있습니다.'], [0, '서로 다른 별', '결이 많이 다른 만큼 배려와 대화가 가장 큰 열쇠입니다.']];

const stemOf = (st) => st.saju.pillars.day.stem, dayB = (st) => st.saju.pillars.day.branch, yearB = (st) => st.saju.pillars.year.branch;

function heartScore(a, b) {
  const sa = stemOf(a), sb = stemOf(b), ea = STEMS[sa].el, eb = STEMS[sb].el;
  const hap = Math.abs(sa - sb) === 5;
  let base, kind;
  if (hap) { base = 96; kind = 'hap'; }
  else if (ea === eb) { base = 76; kind = 'same'; }
  else if (GEN[ea] === eb || GEN[eb] === ea) { base = 88; kind = 'gen'; }
  else { base = 64; kind = 'ctrl'; }
  if (!hap && STEMS[sa].yang !== STEMS[sb].yang) base += 4;   // 음양이 다르면 조화
  return { score: Math.min(98, base), kind, hap: hap ? STEM_HAP[Math.min(sa, sb) % 5] : null, ea, eb };
}
function balanceScore(a, b) {
  const ca = a.reading.counts, cb = b.reading.counts;
  const fillsA = ORDER.filter(e => ca[e] === 0 && cb[e] >= 2), fillsB = ORDER.filter(e => cb[e] === 0 && ca[e] >= 2);
  const overlap = ORDER.filter(e => ca[e] >= 3 && cb[e] >= 3);
  const score = Math.round(Math.max(55, Math.min(96, 70 + (fillsA.length + fillsB.length) * 8 - overlap.length * 6 + (Math.abs(ORDER.filter(e => ca[e] > 0).length - ORDER.filter(e => cb[e] > 0).length) === 0 ? 0 : 0))));
  return { score, fillsA, fillsB, overlap };
}
function starScore(a, b) {
  const ia = zodiacProfile(a).idx, ib = zodiacProfile(b).idx;
  let d = Math.abs(ia - ib); if (d > 6) d = 12 - d;
  return { ...STAR_ASPECT[d], signA: SIGNS[ia], signB: SIGNS[ib] };
}

/**
 * @param a, b { saju, reading }  computeSaju / interpretSaju 결과
 * @param names { a, b }          표시용 이름
 */
export function computeMatch(a, b, names = { a: '나', b: '상대' }) {
  const h = heartScore(a, b);
  const dr = branchRel(dayB(a), dayB(b)) || 'none', yr = branchRel(yearB(a), yearB(b)) || 'none';
  const bal = balanceScore(a, b), star = starScore(a, b);
  const axes = { heart: h.score, life: BR_DAY[dr][2], fate: BR_YEAR[yr][2], balance: bal.score, star: star.score };
  const raw = MATCH_AXES.reduce((s, x) => s + axes[x.key] * x.weight, 0);
  const total = Math.round(Math.max(45, Math.min(99, 75 + (raw - 75) * 1.45)));   // 점수 폭을 넓혀 좋은 사이와 맞춰 가야 하는 사이를 더 뚜렷이 구분
  const grade = GRADES.find(g => total >= g[0]);
  const A = names.a, B = names.b;
  const godAB = tenGod(stemOf(a), stemOf(b)), godBA = tenGod(stemOf(b), stemOf(a));   // A 가 본 B, B 가 본 A
  const el = (e) => `${EL[e].name}(${EL[e].hanja})`;
  const heartText = h.hap ? `${h.hap[0]}: ${h.hap[1]}입니다.`
    : h.kind === 'gen' ? `일간이 ${el(h.ea)}와 ${el(h.eb)}로 서로 살리는 상생 관계라 함께할수록 힘이 납니다.`
    : h.kind === 'same' ? `일간의 오행이 같은 ${el(h.ea)}라 성향이 닮아 이해가 빠르지만 고집도 닮았습니다.`
    : `일간이 ${el(h.ea)}와 ${el(h.eb)}로 서로 누르는 상극 관계라 처음엔 낯설지만 서로 다른 점이 배움이 됩니다.`;
  const texts = [];
  texts.push(`${josa(A, '과', '와')} ${B}의 궁합은 ${total}점, ${grade[1]}입니다. ${grade[2]}`);
  texts.push(`${heartText} ${josa(B, '은', '는')} ${A}에게 ${ROLE[godAB]}이고, ${josa(A, '은', '는')} ${B}에게 ${ROLE[godBA]}입니다.`);
  texts.push(`생활 면에서 가장 가까운 자리인 일지의 관계는 「${BR_DAY[dr][0]}」입니다. ${BR_DAY[dr][1]} 띠는 ${BRANCHES[yearB(a)].animal}띠와 ${BRANCHES[yearB(b)].animal}띠로 「${BR_YEAR[yr][0]}」입니다. ${BR_YEAR[yr][1]}`);
  const fills = [...bal.fillsA.map(e => `${A}에게 비어 있는 ${el(e)} 기운을 ${josa(B, '이', '가')} 채워 줍니다`), ...bal.fillsB.map(e => `${B}에게 비어 있는 ${el(e)} 기운을 ${josa(A, '이', '가')} 채워 줍니다`)];
  texts.push(`${fills.length ? fills.join('. ') + '. ' : '서로 비어 있는 기운을 채워 주는 관계는 뚜렷하지 않습니다. '}${bal.overlap.length ? `다만 ${bal.overlap.map(el).join('·')} 기운이 둘 다 많아 그 성향이 겹쳐 지나칠 수 있습니다.` : ''}`.trim());
  texts.push(`별자리는 ${josa(star.signA.name, '과', '와')} ${josa(star.signB.name, '으로', '로')}, 「${star.name}」입니다. ${star.text}`);
  const sorted = MATCH_AXES.map(x => [x, axes[x.key]]).sort((x, y) => y[1] - x[1]);
  const [best, worst] = [sorted[0], sorted[sorted.length - 1]];
  const ADV = { heart: '서로의 다른 성향을 인정하는 대화를 늘려 보세요.', life: '생활 습관과 말투를 서로 맞추는 작은 약속부터 만들어 보세요.', fate: '서운함은 쌓아 두지 말고 그때그때 표현하세요.', balance: '서로 부족한 점을 채워 준다는 마음으로 역할을 나눠 보세요.', star: '감정 표현 방식의 차이를 이해하려는 노력이 필요합니다.' };
  texts.push(`가장 잘 맞는 부분은 ${best[0].label}(${best[1]}점), 가장 신경 쓸 부분은 ${worst[0].label}(${worst[1]}점)입니다. ${ADV[worst[0].key]}`);
  return { total, grade: { name: grade[1], text: grade[2] }, axes, texts, godAB, godBA, names, parts: { heart: h, dayRel: dr, yearRel: yr, balance: bal, star }, best: best[0].label, worst: worst[0].label };
}
