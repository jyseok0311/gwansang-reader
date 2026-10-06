// ─────────────────────────────────────────────────────────────
//  관상 + 손금 + 사주 종합 (오락용)
//  - 다섯 가지 운을 세 방면의 점수로 비교하고 가중 평균을 낸다.
//  - 얼굴(오행 형)·손(오행 형)·사주 일간의 오행이 서로 살리는지 누르는지, 사주에 비어 있는 오행을 채워 주는지 풀이한다.
// ─────────────────────────────────────────────────────────────
import { ELEMENTS, ELEMENT_GEN, ELEMENT_CTRL } from './saju.js';
import { josa } from './physiognomy.js';

export const FORTUNE_KEYS = ['wealth', 'love', 'career', 'health', 'social'];
export const FORTUNE_NAMES = { wealth: '재물운', love: '애정운', career: '직업·명예운', health: '건강운', social: '대인관계운' };
const WEIGHT = { face: 0.40, palm: 0.25, saju: 0.35 };
const SOURCE_NAME = { face: '관상', palm: '손금', saju: '사주' };

const gradeOf = (avg) => (avg >= 81 ? '상격(上格)' : avg >= 74 ? '중상격(中上格)' : '중격(中格)');
const el = (k) => ELEMENTS[k];

/** 두 오행의 관계: same(겹침) / gen(a 가 b 를 살림) / genBy(b 가 a 를 살림) / ctrl(a 가 b 를 누름) / ctrlBy(b 가 a 를 누름) */
export function relation(a, b) {
  if (a === b) return 'same';
  if (ELEMENT_GEN[a] === b) return 'gen';
  if (ELEMENT_GEN[b] === a) return 'genBy';
  if (ELEMENT_CTRL[a] === b) return 'ctrl';
  return 'ctrlBy';
}

/**
 * @param src { face?: {fortune:{fortunes:{key:{score}}}, type:{primary:{key},secondary:{key}}, shape}, palm?: {fortunes, shape}, saju?: {fortunes, dayMaster, lack, excess, counts, ...} }
 */
export function fuse(src) {
  const has = { face: !!src.face, palm: !!src.palm, saju: !!src.saju };
  const list = Object.keys(has).filter(k => has[k]);
  if (list.length < 2) return null;
  const wsum = list.reduce((a, k) => a + WEIGHT[k], 0);

  const scores = { face: null, palm: null, saju: null };
  if (has.face) scores.face = Object.fromEntries(FORTUNE_KEYS.map(k => [k, src.face.fortune.fortunes[k].score]));
  if (has.palm) scores.palm = src.palm.fortunes;
  if (has.saju) scores.saju = src.saju.fortunes;

  const fortunes = FORTUNE_KEYS.map(k => {
    const by = Object.fromEntries(list.map(s => [s, scores[s][k]]));
    const combined = Math.round(list.reduce((a, s) => a + by[s] * WEIGHT[s], 0) / wsum);
    const vals = list.map(s => by[s]);
    const spread = Math.max(...vals) - Math.min(...vals);
    const hi = list.reduce((a, s) => (by[s] > by[a] ? s : a), list[0]);
    const lo = list.reduce((a, s) => (by[s] < by[a] ? s : a), list[0]);
    return { key: k, name: FORTUNE_NAMES[k], by, combined, spread, hi, lo, agree: spread <= 10 };
  });
  const avg = Math.round(fortunes.reduce((a, f) => a + f.combined, 0) / fortunes.length);
  const ranked = [...fortunes].sort((a, b) => b.combined - a.combined);

  // ── 오행 ──
  const elems = {};
  if (has.face) elems.face = { key: src.face.type.primary.key, sub: src.face.type.secondary.key };
  if (has.palm) elems.palm = { key: src.palm.shape.primary.key, sub: src.palm.shape.secondary.key };
  if (has.saju) elems.saju = { key: src.saju.dayMaster.el, sub: null };
  const pairs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    pairs.push({ a, b, ea: elems[a].key, eb: elems[b].key, rel: relation(elems[a].key, elems[b].key) });
  }

  const complements = [];
  if (has.saju) {
    const lack = src.saju.lack, excess = src.saju.excess;
    for (const s of ['face', 'palm']) {
      if (!has[s]) continue;
      const cand = [elems[s].key, elems[s].sub].filter(Boolean);
      for (const e of lack) if (cand.includes(e)) complements.push({ type: 'fill', by: s, el: e, main: elems[s].key === e });
      for (const e of excess) if (elems[s].key === e) complements.push({ type: 'overlap', by: s, el: e });
    }
  }
  const summary = compose({ has, list, scores, fortunes, ranked, avg, elems, pairs, complements, src });
  return { has, sources: list, fortunes, avg, grade: gradeOf(avg), ranked, elems, pairs, complements, summary };
}

// ── 종합 총평 ────────────────────────────────────────────────
const REL_TEXT = {
  same: (a, b, e) => `${josa(a, '과', '와')} ${b}의 기운이 모두 ${josa(el(e).name + '(' + el(e).hanja + ')', '으로', '로')} 같아 그 성향이 겹쳐 더욱 뚜렷합니다.`,
  gen: (a, b, ea, eb) => `${a}의 ${josa(el(ea).name, '이', '가')} ${b}의 ${josa(el(eb).name, '을', '를')} 살리는 상생 관계입니다.`,
  genBy: (a, b, ea, eb) => `${b}의 ${josa(el(eb).name, '이', '가')} ${a}의 ${josa(el(ea).name, '을', '를')} 북돋는 상생 관계입니다.`,
  ctrl: (a, b, ea, eb) => `${a}의 ${josa(el(ea).name, '이', '가')} ${b}의 ${josa(el(eb).name, '을', '를')} 누르는 상극 관계라 안에서 서로 다른 목소리가 납니다.`,
  ctrlBy: (a, b, ea, eb) => `${b}의 ${josa(el(eb).name, '이', '가')} ${a}의 ${josa(el(ea).name, '을', '를')} 누르는 상극 관계라 안에서 서로 다른 목소리가 납니다.`,
};
const REL_NOTE = {
  same: '한 가지 기질이 삶 전반에 일관되게 드러나는 사람입니다.',
  gen: '기질이 서로를 키워 주니 타고난 재능이 자연스럽게 결실로 이어집니다.',
  genBy: '기질이 서로를 키워 주니 타고난 재능이 자연스럽게 결실로 이어집니다.',
  ctrl: '겉으로 보이는 모습과 속마음이 다를 수 있으니, 두 기질의 균형을 잡을 때 오히려 폭이 넓어집니다.',
  ctrlBy: '겉으로 보이는 모습과 속마음이 다를 수 있으니, 두 기질의 균형을 잡을 때 오히려 폭이 넓어집니다.',
};

function compose(c) {
  const { list, fortunes, ranked, avg, elems, pairs, complements, src, has } = c;
  const nameList = list.map(s => SOURCE_NAME[s]);
  const names = nameList.length === 2 ? `${josa(nameList[0], '과', '와')} ${nameList[1]}` : nameList.join(', ');
  const P = [];

  // 1. 개요
  const bits = [];
  if (has.face) bits.push(`관상은 ${src.face.shape.primary.name}에 ${src.face.type.primary.name}`);
  if (has.palm) bits.push(`손금은 ${src.palm.shape.primary.name}`);
  if (has.saju) { const dm = src.saju.dayMaster; bits.push(`사주는 ${dm.ko}${el(dm.el).ko}(${dm.hanja}${el(dm.el).hanja}) 일간에 ${src.saju.animal}띠`); }
  const missing = ['face', 'palm', 'saju'].filter(s => !has[s]).map(s => SOURCE_NAME[s]);
  P.push(`${josa(names, '을', '를')} 함께 보면, ${bits.join(', ')}의 상입니다. 종합 점수는 ${avg}점으로 ${gradeOf(avg)}에 해당합니다.${missing.length ? ` (${josa(missing.join(', '), '은', '는')} 빠져 있어 나머지로 종합했습니다.)` : ''}`);

  // 2. 오행 조합
  const label = (s) => `${SOURCE_NAME[s]}의 ${el(elems[s].key).name}(${el(elems[s].key).hanja})`;
  if (pairs.length) {
    const rels = pairs.map(p => `${josa(label(p.a), '과', '와')} ${josa(label(p.b), '은', '는')} ${{ same: '같은 기운', gen: '상생', genBy: '상생', ctrl: '상극', ctrlBy: '상극' }[p.rel]}`);
    const genCount = pairs.filter(p => p.rel === 'gen' || p.rel === 'genBy').length, ctrlCount = pairs.filter(p => p.rel === 'ctrl' || p.rel === 'ctrlBy').length;
    const first = pairs[0];
    const note = genCount >= 2 ? '세 방면의 기운이 서로를 살려 주는 귀한 조합으로, 힘이 안에서 계속 순환합니다.'
      : ctrlCount >= 2 ? '세 방면의 기운이 서로 부딪혀 마음속에 갈등이 잦을 수 있으나, 그만큼 다양한 면을 가진 입체적인 사람입니다.'
      : REL_NOTE[first.rel];
    P.push(`오행으로 보면 ${rels.join(', ')}입니다. ${REL_TEXT[first.rel](SOURCE_NAME[first.a], SOURCE_NAME[first.b], first.ea, first.eb)} ${note}`);
  }

  // 3. 사주의 빈 기운·과한 기운과의 관계
  if (has.saju) {
    const s = src.saju, parts = [];
    if (s.lack.length) parts.push(`사주에는 ${s.lack.map(e => `${el(e).name}(${el(e).hanja})`).join('·')} 기운이 비어 있습니다.`);
    else parts.push('사주에 다섯 기운이 모두 갖춰져 있어 한쪽으로 크게 기울지 않습니다.');
    const fills = complements.filter(x => x.type === 'fill'), overs = complements.filter(x => x.type === 'overlap');
    if (fills.length) {
      const desc = fills.map(f => `${SOURCE_NAME[f.by]}의 ${el(f.el).name}(${el(f.el).hanja}${f.main ? ', 주된 기질' : ''})`);
      parts.push(`다행히 ${desc.join(', ')} 기운이 사주의 빈자리를 채워 줍니다.`);
    }
    if (s.lack.length && !fills.length) parts.push(`${josa(s.lack.map(e => el(e).lucky).slice(0, 2).join(', '), '을', '를')} 가까이하면 부족한 기운을 채우는 데 도움이 됩니다.`);
    for (const o of overs) parts.push(`한편 ${SOURCE_NAME[o.by]}의 ${el(o.el).name} 기운이 사주의 많은 ${el(o.el).name} 기운과 겹쳐 그 성향이 다소 지나칠 수 있으니 절제가 필요합니다.`);
    parts.push(s.texts.strength);
    P.push(parts.join(' '));
  } else {
    P.push(`${list.map(l => `${SOURCE_NAME[l]}에서는 ${el(elems[l].key).name}(${el(elems[l].key).hanja})`).join(', ')} 기운이 두드러집니다. 태어난 때의 사주까지 더하면 이 기운이 부족한지 넘치는지를 함께 볼 수 있습니다.`);
  }

  // 4. 다섯 운 종합
  const b = ranked[0], w = ranked[ranked.length - 1];
  const divergent = [...fortunes].sort((x, y) => y.spread - x.spread)[0];
  const allHigh = fortunes.filter(f => list.every(s => f.by[s] >= 80));
  let fs = `다섯 운을 합치면 ${josa(b.name, '이', '가')} ${b.combined}점으로 가장 밝고 ${josa(w.name, '이', '가')} ${w.combined}점으로 가장 조용합니다.`;
  if (allHigh.length) fs += ` 특히 ${josa(allHigh.map(f => f.name).join(', '), '은', '는')} ${names} 모두에서 높게 나와 믿고 밀고 나가도 좋은 자리입니다.`;
  if (divergent.spread >= 14) fs += ` ${josa(divergent.name, '은', '는')} ${SOURCE_NAME[divergent.hi]}에서는 ${divergent.by[divergent.hi]}점으로 밝지만 ${SOURCE_NAME[divergent.lo]}에서는 ${divergent.by[divergent.lo]}점으로 낮아 해석이 엇갈리니, 타고난 바탕과 지금의 노력이 다를 수 있다는 뜻으로 받아들이세요.`;
  else fs += ' 세 방면의 결과가 대체로 비슷한 방향을 가리켜 신뢰도가 높은 편입니다.';
  P.push(fs);

  // 5. 마무리
  const tail = [];
  if (has.saju) tail.push(src.saju.dayMaster.advice);
  if (has.face) tail.push(src.face.shape.primary.advice);
  P.push(`마무리로, ${tail.join(' ')} 관상은 얼굴에, 손금은 손에, 사주는 태어난 때에 새겨진다고 하지만 결국 운을 만드는 것은 오늘의 선택입니다.`);
  return P.filter(Boolean);
}
