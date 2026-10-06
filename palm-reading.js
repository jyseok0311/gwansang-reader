// ─────────────────────────────────────────────────────────────
//  손금 풀이 (오락용): palm.js 가 잰 선(길이·선명도·굽기·시작과 끝·끊김)과 손 모양(손가락 길이·마디·엄지 각도 등)을
//  표준점수(z)로 바꾸어 다섯 단계로 가르고, 서로 다른 특징을 조합해 사람마다 다른 풀이를 만든다.
//  - 선별 풀이: 선마다 서너 가지 특징을 각각 다섯 단계 문장으로 풀이한다.
//  - 손 모양 풀이: 검지·중지·약지·새끼손가락, 마디 비율, 엄지 등 열 가지 특징을 풀이하고 가장 두드러진 것을 골라 보여 준다.
//  - 선 사이의 관계(가장 또렷한 선, 두뇌선과 감정선의 길이 차 등)와 총평은 모든 특징을 합쳐 따로 쓴다.
// ─────────────────────────────────────────────────────────────
import { HAND_POP } from './palm.js';
import { clamp } from './util.js';

const z = (v, [m, s]) => clamp((v - m) / s, -2.5, 2.5);
const combine = (terms) => terms.reduce((a, [w, x]) => a + w * x, 0) / Math.sqrt(terms.reduce((a, [w]) => a + w * w, 0));
const score = (zz) => Math.round(clamp(77 + 10 * zz, 52, 99));
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b); };

// 다섯 단계로 가르기: 0(아주 낮음) ~ 4(아주 높음)
const tier = (zz) => (zz < -0.9 ? 0 : zz < -0.3 ? 1 : zz <= 0.3 ? 2 : zz <= 0.9 ? 3 : 4);
const pick = (zz, arr) => arr[tier(zz)];

// 선별 특징의 기준값 [평균, 표준편차]. 손바닥 사진 6장에서 잰 분포에 표준편차를 1.25배 넓혀 잡은 값이라 대략적이다.
// 선마다 길이·굵기가 저마다 다르므로, 절대값이 아니라 "이 선이 보통보다 긴가 짧은가"로 풀이한다.
const widen = (o) => Object.fromEntries(Object.entries(o).map(([k, [m, sd]]) => [k, [m, sd * 1.25]]));
const REF = {
  life: widen({ len: [0.92, 0.08], clr: [2.8, 0.5], cont: [0.97, 0.025], dev: [0.21, 0.07] }),
  head: widen({ len: [0.67, 0.2], clr: [2.4, 0.9], cont: [0.93, 0.05], dev: [0.06, 0.03], slope: [20, 9] }),
  heart: widen({ len: [0.80, 0.17], clr: [3.2, 1.1], cont: [0.99, 0.02], dev: [0.11, 0.05], endA: [0.19, 0.07] }),
  fate: widen({ len: [0.67, 0.18], clr: [2.25, 0.3], cont: [0.96, 0.04] }),
};
// 손가락 특징의 기준값. 손바닥 길이에 대한 비율이라 사람마다 실제로 꽤 다르게 나온다.
const HREF = {
  pinkyRing: [0.80, 0.06], middleIndex: [1.10, 0.05], pinkyReach: [0.0, 0.035],
  tip: [0.27, 0.03], mid: [0.27, 0.025], base: [0.46, 0.035],
  thumbOpen: [42, 12], spread: [14, 10],
};

export const HAND_TYPES = {
  wood: { key: 'wood', hanja: '木', name: '목형수(木形手)', shape: '갸름하고 곧은 손', proto: { P: 0.7, F: 0.3, T: 0 },
    text: '손이 갸름하고 손가락이 곧게 뻗은 목형수입니다. 지적이고 섬세해 학문·기획·예술에 재능이 있고, 한 가지를 꾸준히 키워 나가는 대기만성형으로 봅니다.' },
  fire: { key: 'fire', hanja: '火', name: '화형수(火形手)', shape: '손바닥은 길고 손가락은 짧은 손', proto: { P: 0.4, F: -0.9, T: 0.4 },
    text: '손바닥에 비해 손가락이 짧은 화형수입니다. 행동이 빠르고 열정적이며 승부욕이 강한 개척가로, 생각보다 몸이 먼저 움직입니다.' },
  earth: { key: 'earth', hanja: '土', name: '토형수(土形手)', shape: '네모지고 두툼한 손', proto: { P: -0.9, F: -0.6, T: 0 },
    text: '손바닥이 네모지고 손가락이 짧은 토형수입니다. 성실하고 듬직하며 재물과 신용을 차곡차곡 쌓아 가는 현실가로 봅니다.' },
  metal: { key: 'metal', hanja: '金', name: '금형수(金形手)', shape: '네모난 손바닥에 긴 손가락', proto: { P: -0.6, F: 0.5, T: -0.3 },
    text: '네모난 손바닥에 손가락이 긴 금형수입니다. 판단이 정확하고 원칙이 분명한 전문가로, 손재주와 마무리가 뛰어납니다.' },
  water: { key: 'water', hanja: '水', name: '수형수(水形手)', shape: '손가락이 길고 부드러운 손', proto: { P: 0.1, F: 1.2, T: 0.3 },
    text: '손가락이 길고 유연한 수형수입니다. 감수성과 직관이 뛰어나고 사람의 마음을 잘 읽는 사색가로, 환경에 맞춰 모양을 바꾸는 지혜가 있습니다.' },
};

export function classifyHand(h) {
  const zz = { P: z(h.palmRatio, HAND_POP.palmRatio), F: z(h.fingerRatio, HAND_POP.fingerRatio), T: z(h.thumbRatio, HAND_POP.thumbRatio) };
  const s = {};
  for (const [k, t] of Object.entries(HAND_TYPES)) {
    let dot = 0, norm = 0;
    for (const [d, v] of Object.entries(t.proto)) { dot += zz[d] * v; norm += v * v; }
    s[k] = dot - norm / 2;
  }
  const ranked = Object.entries(s).sort((a, b) => b[1] - a[1]);
  const exp = ranked.map(([k, v]) => [k, Math.exp(v * 1.5)]); const tot = exp.reduce((a, [, v]) => a + v, 0);
  return { primary: HAND_TYPES[ranked[0][0]], secondary: HAND_TYPES[ranked[1][0]], weights: exp.map(([k, v]) => ({ type: HAND_TYPES[k], pct: Math.round(v / tot * 100) })), z: zz };
}

const level = (v, cuts, labels) => labels[cuts.filter(c => v >= c).length];
const clarityLabel = (c) => level(c, [1.6, 2.2, 3.6], ['흐릿한', '옅은', '뚜렷한', '깊고 또렷한']);
const pct = (v) => `${Math.round(v * 100)}%`;

// ── 선별 풀이 문장 (z 가 낮은 쪽 → 높은 쪽 다섯 단계) ────────
const TXT = {
  heart: {
    len: ['감정선이 아주 짧아 감정 표현이 담백하고 군더더기 없는 쿨한 현실파입니다.',
      '감정선이 짧은 편이라 마음을 쉽게 드러내지 않고 감정에 오래 매이지 않습니다.',
      '감정선의 길이가 알맞아 감정과 이성의 균형이 좋고 사랑에 안정적입니다.',
      '감정선이 긴 편이라 정이 깊고 한번 마음을 주면 오래 지키는 순정파입니다.',
      '감정선이 손바닥을 가로질러 길게 뻗어 사랑에 헌신적이고 마음의 폭이 아주 넓습니다.'],
    end: ['선 끝이 검지 뿌리까지 이어져 이상이 높고 상대를 위해 헌신하는 사랑을 합니다.',
      '선 끝이 검지와 중지 사이를 향해 따뜻하고 배려 깊은 사랑을 합니다.',
      '선 끝이 중지 아래에 머물러 자기 중심이 뚜렷하고 현실적인 사랑을 합니다.',
      '선이 약지 아래쪽에서 멎어 마음을 천천히 열고 신중하게 사랑합니다.',
      '선이 일찍 멈춰 사랑에 서두르지 않고 스스로의 시간을 소중히 여깁니다.'],
    curve: ['선이 곧게 뻗어 감정을 절제하고 이성으로 사랑을 판단합니다.',
      '완만한 선이라 표현이 차분하고 절제되어 있습니다.',
      '적당히 굽은 선이라 표현과 절제가 조화롭습니다.',
      '부드럽게 굽은 곡선이라 표정과 애정 표현이 풍부합니다.',
      '크게 굽은 곡선이라 감수성이 풍부하고 기쁨과 슬픔이 얼굴에 그대로 드러납니다.'],
  },
  head: {
    len: ['두뇌선이 아주 짧아 결단이 빠르고 직관과 행동으로 움직이는 실행가입니다.',
      '두뇌선이 짧은 편이라 군더더기 없이 핵심을 짚고 빠르게 결정합니다.',
      '두뇌선의 길이가 알맞아 판단이 균형 잡히고 실행력도 좋습니다.',
      '두뇌선이 긴 편이라 깊이 생각하고 계획을 세우는 신중한 사색가입니다.',
      '두뇌선이 손바닥 끝까지 길게 이어져 분석력이 뛰어나고 멀리 내다보는 전략가입니다.'],
    slope: ['선이 곧게 뻗어 논리적이고 실속을 챙기는 현실주의자입니다.',
      '선이 완만하게 내려가 현실 감각과 창의성을 함께 갖춘 사고를 합니다.',
      '선이 적당히 기울어 이성과 감성을 두루 쓰는 유연한 사고를 합니다.',
      '선이 아래로 기울어 상상력과 예술적 감성이 풍부합니다.',
      '선이 손목 쪽으로 크게 휘어 직관과 상상이 남달라 창작·기획에 재능이 있습니다.'],
    start: ['생명선과 붙어 시작해 신중하고 부모·가족의 영향을 크게 받습니다.',
      '생명선과 가까이 시작해 조심스럽지만 차츰 자기 길을 찾아갑니다.',
      '생명선과 떨어져 시작해 독립심이 강하고 새로운 도전을 즐깁니다.',
      '생명선과 멀리 떨어져 시작해 틀에 매이지 않고 모험을 즐기는 자유로운 사고를 합니다.'],
  },
  life: {
    len: ['생명선이 짧게 보여 체력을 아껴 쓰는 습관이 복이 됩니다.',
      '생명선이 다소 짧아 무리하지 않고 규칙적으로 생활할 때 컨디션이 안정됩니다.',
      '생명선의 길이가 알맞아 무리하지 않으면 건강이 안정적입니다.',
      '생명선이 길게 이어져 타고난 체력과 회복력이 좋습니다.',
      '생명선이 손목 쪽까지 깊고 길게 이어져 활력이 오래 유지되는 튼튼한 체질입니다.'],
    arc: ['엄지 가까이 좁게 흘러 신중하고 안정을 좋아하는 편입니다.',
      '비교적 좁은 호를 그려 차분하고 꾸준한 편입니다.',
      '적당한 호를 그려 활동과 휴식의 균형이 잡혀 있습니다.',
      '넓은 호를 그려 활동적이고 에너지가 넘칩니다.',
      '엄지 아래를 크게 감싸는 아주 넓은 호라 열정과 추진력이 대단하고 도전을 즐깁니다.'],
  },
};

// ── 손 모양 특징 (낮은 쪽 → 높은 쪽 다섯 단계) ───────────────
const HTXT = {
  indexRing: { title: '검지와 약지', tiers: [
    '약지가 검지보다 훨씬 길어 승부욕과 모험심이 강하고 예술·투자 감각이 돋보입니다.',
    '약지가 검지보다 긴 편이라 감각이 뛰어나고 도전을 즐깁니다.',
    '검지와 약지의 길이가 고르게 균형을 이루어 야망과 감성이 조화롭습니다.',
    '검지가 약지보다 긴 편이라 리더십과 책임감이 큰 편입니다.',
    '검지가 약지보다 훨씬 길어 야망이 크고 사람을 이끄는 카리스마가 있습니다.'] },
  pinky: { title: '새끼손가락', tiers: [
    '새끼손가락이 짧아 말보다 행동으로 보여 주는 진중한 편이며, 재물은 시간을 들여 모읍니다.',
    '새끼손가락이 약간 짧아 말수가 적고 신뢰를 천천히 쌓는 편입니다.',
    '새끼손가락 길이가 알맞아 소통과 현실 감각이 균형을 이룹니다.',
    '새끼손가락이 긴 편이라 말솜씨와 재치가 좋고 사람을 얻는 재주가 있습니다.',
    '새끼손가락이 약지 끝마디 이음새를 훌쩍 넘어 화술과 수완이 뛰어나 협상·교육·장사에 재능이 있습니다.'] },
  middle: { title: '중지', tiers: [
    '중지가 상대적으로 짧아 구속을 싫어하고 가볍고 자유롭게 움직이는 편입니다.',
    '중지가 약간 짧아 틀에 얽매이지 않고 유연하게 처신합니다.',
    '중지가 알맞아 책임감과 자유로움이 균형을 이룹니다.',
    '중지가 긴 편이라 신중하고 책임감이 강해 맡은 일을 끝까지 해냅니다.',
    '중지가 유난히 길어 원칙과 절제가 몸에 배어 있고 오래 걸려도 큰 그릇을 만듭니다.'] },
  phalanx: { title: '손가락 마디', tiers: [
    '뿌리 마디가 길고 손끝 마디가 짧아 생각보다 실행이 앞서는 실속형입니다.',
    '뿌리 마디가 약간 길어 현실감과 생활력이 좋은 편입니다.',
    '세 마디가 고르게 균형을 이루어 생각·판단·실행의 조화가 좋습니다.',
    '손끝 마디가 약간 길어 뜻과 이상을 먼저 세우는 편입니다.',
    '손끝 마디가 길고 뿌리 마디가 짧아 의지와 정신이 앞서는 이상가형입니다.'] },
  thumbLen: { title: '엄지 길이', tiers: [
    '엄지가 짧아 유연하고 남의 의견을 잘 받아들이는 순응형입니다.',
    '엄지가 다소 짧아 고집보다 조화를 택하는 편입니다.',
    '엄지의 길이가 알맞아 의지와 유연함이 조화롭습니다.',
    '엄지가 긴 편이라 의지가 강하고 목표를 끝까지 밀어붙입니다.',
    '엄지가 유난히 길어 추진력과 자존심이 강해 한번 정하면 꺾이지 않습니다.'] },
  thumbOpen: { title: '엄지 벌어짐', tiers: [
    '엄지가 손바닥에 바짝 붙어 신중하고 절제하며 씀씀이와 감정을 단속하는 편입니다.',
    '엄지가 몸 쪽에 가까워 계획적이고 아껴 쓰는 편입니다.',
    '엄지가 알맞게 벌어져 신중함과 너그러움이 균형을 이룹니다.',
    '엄지가 시원하게 벌어져 개방적이고 마음이 넉넉합니다.',
    '엄지가 크게 젖혀져 호탕하고 씀씀이가 크며 새로운 것을 거침없이 받아들입니다.'] },
  shapeF: { title: '손가락과 손바닥', tiers: [
    '손바닥에 비해 손가락이 짧아 직관과 추진력이 앞서는 행동파입니다.',
    '손가락이 다소 짧은 편이라 현실적이고 실용적입니다.',
    '손가락과 손바닥의 비율이 고르게 균형을 이룹니다.',
    '손가락이 긴 편이라 섬세하고 손재주와 감수성이 좋습니다.',
    '손가락이 유난히 길어 예민하고 섬세하며 한 가지에 깊이 파고드는 탐구형입니다.'] },
  palmW: { title: '손바닥 모양', tiers: [
    '손바닥이 넓고 네모져 안정감을 중시하고 꾸준히 쌓아 가는 편입니다.',
    '손바닥이 넓은 편이라 포용력이 있고 믿음직합니다.',
    '손바닥의 가로세로 비율이 알맞아 무난하고 두루 어울리는 상입니다.',
    '손바닥이 길쭉한 편이라 생각이 깊고 이상이 높은 편입니다.',
    '손바닥이 아주 길쭉해 섬세하고 예술·학문 쪽의 감수성이 뛰어납니다.'] },
  spread: { title: '손가락 벌어짐', tiers: [
    '손가락이 모여 있어 신중하고 속마음을 잘 드러내지 않으며 재물을 지키는 편입니다.',
    '손가락이 다소 모이는 편이라 조심스럽고 차분합니다.',
    '손가락이 알맞게 벌어져 사교와 신중함이 조화롭습니다.',
    '손가락이 시원하게 벌어져 활달하고 사람을 잘 사귑니다.',
    '손가락이 활짝 벌어져 거침없고 독립적이며 사교성이 아주 좋습니다.'] },
  pinkyGap: { title: '새끼손가락 거리', tiers: [
    '새끼손가락이 약지에 바짝 붙어 가족과 가까운 이들에게 의지하는 편입니다.',
    '새끼손가락이 약지와 가까워 정이 많고 사람들과 어울리길 좋아합니다.',
    '새끼손가락과 약지 사이가 알맞아 가까운 이와 자기 시간을 균형 있게 챙깁니다.',
    '새끼손가락이 약지에서 떨어져 있어 독립심이 강하고 자기 세계가 뚜렷합니다.',
    '새끼손가락이 약지에서 크게 벌어져 자유로운 영혼으로, 스스로 길을 개척합니다.'] },
};

// ── 왼손·오른손: 왼손은 타고난 바탕(선천), 오른손은 살아오며 다듬은 모습과 지금의 흐름(후천)으로 읽는다 ──
export const SIDE = {
  left: { key: 'left', name: '왼손', role: '타고난 기질과 바탕', kind: '선천운', lead: '왼손은 태어날 때 받은 바탕을 보여 주는 손으로 봅니다.',
    close: '타고난 바탕이니 장점은 살리고 약한 부분은 노력으로 채워 가세요.' },
  right: { key: 'right', name: '오른손', role: '살아오며 다듬어 온 모습과 지금의 흐름', kind: '후천운', lead: '오른손은 살아오며 노력해 다듬은 모습과 지금의 흐름을 보여 주는 손으로 봅니다.',
    close: '이미 다듬어 온 모습이니 지금의 방향을 믿고 꾸준히 이어 가세요.' },
};
// 선마다 [약함, 보통, 강함] 문장
const SIDE_LINE = {
  heart: {
    left: ['타고난 감정 표현이 담백한 바탕이라 마음을 여는 데 시간이 걸립니다.', '타고난 감정 표현이 무난하고 균형 잡힌 바탕입니다.', '타고난 감정의 그릇이 크고 정이 깊은 바탕입니다.'],
    right: ['지금은 감정 표현을 아끼는 쪽이라 마음을 열 기회를 일부러 만들면 좋습니다.', '살아오며 감정을 다루는 방식이 안정적으로 다듬어졌습니다.', '살아오며 사랑과 정을 나누는 마음이 한층 깊어졌습니다.'],
  },
  head: {
    left: ['타고난 직관형 두뇌라 배움으로 깊이를 더하면 크게 빛납니다.', '타고난 판단력이 고르게 갖춰진 바탕입니다.', '타고난 사고력과 집중력이 뛰어난 바탕입니다.'],
    right: ['지금은 생각을 정리할 시간이 부족하니 기록하는 습관이 도움이 됩니다.', '경험을 거치며 판단이 안정적으로 자리 잡았습니다.', '공부와 경험으로 생각의 깊이를 키워 온 모습입니다.'],
  },
  life: {
    left: ['타고난 체력을 아껴 쓰는 체질이라 일찍부터 생활 습관을 다지면 복이 됩니다.', '타고난 체력이 무난해 관리하는 만큼 좋아집니다.', '타고난 체력과 회복력이 든든한 바탕입니다.'],
    right: ['지금은 피로가 쌓이기 쉬운 때이니 휴식과 규칙적인 생활이 우선입니다.', '지금의 생활 리듬이 건강을 안정적으로 지켜 주고 있습니다.', '생활을 잘 가꿔 활력이 한층 강해진 모습입니다.'],
  },
  fate: {
    left: ['타고난 길이 정해져 있지 않아 스스로 만들어 갈 여지가 큽니다.', '타고난 방향은 열려 있어 환경에 따라 길이 정해집니다.', '타고난 뜻과 사명감이 뚜렷한 바탕입니다.'],
    right: ['지금은 방향을 모색하는 시기라 여러 길을 시험해 보기 좋습니다.', '경험이 쌓이며 방향이 조금씩 선명해지고 있습니다.', '살아오며 걸어갈 길이 분명해지고 있습니다.'],
  },
};
const cls3 = (zz) => (zz < -0.3 ? 0 : zz > 0.3 ? 2 : 1);

/**
 * @param palm analyzePalm() 결과
 * @param side 'left' | 'right' — 사진 속 손 (handSide). 없으면 오른손으로 본다.
 */
export function interpretPalm(palm, side = 'right') {
  const SI = SIDE[side] || SIDE.right, sk = SI.key;
  const L = palm.lines, rho = palm.frame.rho, h = palm.hand;
  const feat = (k) => {
    const m = L[k]?.m; if (!m) return null; const R = REF[k];
    const slope = Math.atan2((m.end.b - m.start.b) * rho, Math.abs(m.end.a - m.start.a) || 1e-6) * 180 / Math.PI;
    return { m, slope, endA: Math.min(m.start.a, m.end.a),
      zLen: z(m.lengthRel, R.len), zClr: z(m.contrast, R.clr), zCont: z(m.continuity, R.cont),
      zDev: R.dev ? z(m.bulge.dev, R.dev) : 0, zSlope: R.slope ? z(slope, R.slope) : 0, zEnd: R.endA ? z(Math.min(m.start.a, m.end.a), R.endA) : 0 };
  };
  const F = { heart: feat('heart'), head: feat('head'), life: feat('life'), fate: feat('fate') };
  const shape = classifyHand(h);
  const readings = [];
  const metrics = (f, extra = '') => `길이 ${pct(f.m.lengthRel)} · 뚜렷함 ${f.m.contrast.toFixed(1)} · 끊김 ${f.m.breaks}번${extra}`;

  if (F.heart) {
    const f = F.heart, m = f.m;
    readings.push({ key: 'heart', name: '감정선', hanja: '感情線', topic: '사랑과 감정', clarity: clarityLabel(m.contrast),
      headline: ['담백한 사랑', '조용한 사랑', '균형 잡힌 사랑', '깊고 오래가는 사랑', '넓고 헌신적인 사랑'][tier(f.zLen)],
      text: `${pick(f.zLen, TXT.heart.len)} ${pick(f.zEnd, TXT.heart.end)} ${pick(f.zDev, TXT.heart.curve)} ${SIDE_LINE.heart[sk][cls3(0.55 * f.zClr + 0.45 * f.zLen)]}`, metrics: metrics(f) });
  }
  let joinedDist = null;
  if (F.head) {
    const f = F.head, m = f.m, life = F.life?.m;
    joinedDist = life ? Math.hypot(m.start.a - life.start.a, (m.start.b - life.start.b) * rho) : null;
    const startTier = joinedDist === null ? 2 : joinedDist < 0.08 ? 0 : joinedDist < 0.16 ? 1 : joinedDist < 0.3 ? 2 : 3;
    readings.push({ key: 'head', name: '두뇌선', hanja: '頭腦線', topic: '지혜와 재능', clarity: clarityLabel(m.contrast),
      headline: ['빠른 결단', '간결한 사고', '균형 잡힌 사고', '신중한 사색', '풍부한 상상력'][tier(0.6 * f.zLen + 0.8 * f.zSlope)],
      text: `${pick(f.zLen, TXT.head.len)} ${pick(f.zSlope, TXT.head.slope)} ${TXT.head.start[startTier]} ${SIDE_LINE.head[sk][cls3(0.55 * f.zClr + 0.45 * f.zLen)]}`,
      metrics: metrics(f, ` · 기울기 ${Math.round(f.slope)}°`) });
  }
  if (F.life) {
    const f = F.life, m = f.m;
    const brk = m.breaks >= 2 || f.zCont <= -0.9 ? ' 선이 군데군데 끊겨 보여 환경이 바뀌는 시기에 컨디션 관리가 필요합니다.'
      : m.breaks === 1 || f.zCont <= -0.4 ? ' 선이 한 곳에서 한 번 끊겨 보여 인생의 전환점에서 큰 변화를 맞을 수 있습니다.'
      : ' 선이 끊김 없이 이어져 꾸준한 기운을 보여 줍니다.';
    readings.push({ key: 'life', name: '생명선', hanja: '生命線', topic: '건강과 활력', clarity: clarityLabel(m.contrast),
      headline: ['아껴 쓰는 체력', '차분한 활력', '안정적인 활력', '강한 체력', '넘치는 생명력'][tier(f.zLen)],
      text: `${pick(f.zLen, TXT.life.len)} ${pick(f.zDev, TXT.life.arc)}${brk} ${SIDE_LINE.life[sk][cls3(0.55 * f.zClr + 0.45 * f.zLen)]}`, metrics: metrics(f) });
  }
  let fateClear = false;
  if (F.fate) {
    const f = F.fate, m = f.m, zF = 0.5 * f.zClr + 0.5 * f.zLen;
    fateClear = zF >= 0.4;
    const origin = m.start.b > 0.85 ? '손목 가까이에서 시작해 일찍부터 삶의 목표가 분명했을 상입니다.'
      : m.start.b > 0.6 ? '손바닥 가운데쯤에서 시작해 사회에 나온 뒤 방향이 서서히 또렷해지는 상입니다.'
      : '손바닥 위쪽에서 시작해 중년 이후에야 자기 길을 확신하는 대기만성의 상입니다.';
    const reach = m.end.b < 0.42 ? ' 중지 쪽까지 높이 올라 일과 명예가 오래 이어집니다.' : m.end.b < 0.58 ? ' 손바닥 중간 위까지 이어져 중년의 안정이 기대됩니다.' : ' 중간에서 흐려져 도중에 방향을 한 번 바꿀 가능성이 있습니다.';
    const head = fateClear ? (zF >= 1.0 ? '운명선이 깊고 곧게 뻗어 한번 정한 직업과 길을 꾸준히 밀고 가는 안정적인 상입니다.' : '운명선이 또렷해 삶의 목표가 분명하고 경력을 차근차근 쌓는 상입니다.')
      : (zF <= -0.9 ? '운명선이 거의 보이지 않아 정해진 길보다 스스로 길을 만들어 가는 자유로운 상입니다.' : '운명선이 옅어 환경 변화에 적응이 빠르고 여러 길을 시험해 보는 상입니다.');
    readings.push({ key: 'fate', name: '운명선', hanja: '運命線', topic: '직업과 삶의 방향', clarity: clarityLabel(m.contrast), faint: !fateClear,
      headline: fateClear ? (zF >= 1.0 ? '깊고 곧은 삶의 방향' : '뚜렷한 삶의 방향') : (zF <= -0.9 ? '자유롭게 여는 길' : '스스로 여는 길'),
      text: `${head} ${origin}${reach} ${SIDE_LINE.fate[sk][cls3(zF)]}`, metrics: metrics(f) });
  }

  // ── 손 모양 특징 ──
  const zH = {
    indexRing: z(h.indexRing, HAND_POP.indexRing),
    pinky: combine([[0.6, z(h.pinkyRing, HREF.pinkyRing)], [0.4, z(h.pinkyReach, HREF.pinkyReach)]]),
    middle: z(h.middleIndex, HREF.middleIndex),
    phalanx: z(h.phalanx.tip, HREF.tip) - z(h.phalanx.base, HREF.base),
    thumbLen: z(h.thumbRatio, HAND_POP.thumbRatio),
    thumbOpen: z(h.thumbOpen, HREF.thumbOpen),
    shapeF: z(h.fingerRatio, HAND_POP.fingerRatio),
    palmW: z(h.palmRatio, HAND_POP.palmRatio),
    spread: z(h.spread, HREF.spread),
    pinkyGap: z(h.gapRP, [6, 4]),
  };
  const traits = Object.entries(HTXT).map(([key, t]) => ({ key, title: t.title, z: zH[key], tier: tier(zH[key]), text: t.tiers[tier(zH[key])] }));
  const finger = traits.find(t => t.key === 'indexRing').text;
  const thumb = traits.find(t => t.key === 'thumbLen').text;

  // ── 선 사이의 관계 ──
  const main = ['heart', 'head', 'life'].filter(k => F[k]);
  const strength = (k) => 0.55 * F[k].zClr + 0.45 * F[k].zLen;
  const ranked = main.map(k => [k, strength(k)]).sort((a, b) => b[1] - a[1]);
  const NAME = { heart: '감정선', head: '두뇌선', life: '생명선', fate: '운명선' };
  let headHeart = null;
  if (F.head && F.heart) { const r = F.head.m.lengthW / Math.max(1e-6, F.heart.m.lengthW); headHeart = r > 1.1 ? 'head' : r < 0.9 ? 'heart' : 'even'; }
  const relations = [];
  if (ranked.length >= 2) {
    const [top, bottom] = [ranked[0], ranked[ranked.length - 1]];
    relations.push(`세 주요 선 중 ${josa(NAME[top[0]], '이', '가')} 가장 또렷하고 ${josa(NAME[bottom[0]], '이', '가')} 가장 흐려, ${{ heart: '마음의 힘이 삶을 이끄는 쪽', head: '생각의 힘이 삶을 이끄는 쪽', life: '몸의 힘과 활력이 삶을 이끄는 쪽' }[top[0]]}에 무게가 실려 있습니다.`);
  }
  if (headHeart === 'head') relations.push('두뇌선이 감정선보다 길어 감정보다 이성으로 판단하는 머리 중심형입니다.');
  else if (headHeart === 'heart') relations.push('감정선이 두뇌선보다 길어 이성보다 마음이 먼저 움직이는 가슴 중심형입니다.');
  else if (headHeart === 'even') relations.push('두뇌선과 감정선의 길이가 비슷해 머리와 가슴이 균형을 이룹니다.');
  if (F.life && F.fate && fateClear && F.life.zLen >= 0.3) relations.push('생명선이 든든하고 운명선도 또렷해 건강한 체력이 일의 성취를 받쳐 줍니다.');
  else if (F.life && F.life.zLen <= -0.3 && fateClear) relations.push('운명선은 또렷하지만 생명선이 짧은 편이라 일에 몰입하더라도 체력 안배가 중요합니다.');

  // ── 다섯 운 ── (선이 없으면 그 항은 0, 즉 보통으로 계산)
  const g = (f, k) => (f ? f[k] : 0);
  const zFate = F.fate ? 0.5 * F.fate.zClr + 0.5 * F.fate.zLen : -0.5;
  const brk = (f) => (f ? -Math.min(2, f.m.breaks) * 0.5 : 0);
  const zs = {
    wealth: combine([[0.28, zFate], [0.18, zH.thumbLen], [0.14, zH.pinky], [0.14, -zH.phalanx], [0.14, g(F.life, 'zDev')], [0.12, g(F.head, 'zClr')]]),
    love: combine([[0.30, g(F.heart, 'zLen')], [0.28, g(F.heart, 'zClr')], [0.22, g(F.heart, 'zDev')], [0.10, zH.thumbOpen], [0.10, -zH.indexRing]]),
    career: combine([[0.26, g(F.head, 'zClr')], [0.18, g(F.head, 'zLen')], [0.24, zFate], [0.16, zH.indexRing], [0.16, zH.middle]]),
    health: combine([[0.30, g(F.life, 'zLen')], [0.30, g(F.life, 'zClr')], [0.22, g(F.life, 'zCont')], [0.18, brk(F.life)]]),
    social: combine([[0.24, g(F.heart, 'zLen')], [0.20, zH.spread], [0.20, zH.pinky], [0.18, g(F.heart, 'zDev')], [0.18, zH.thumbOpen]]),
  };
  const fortunes = Object.fromEntries(Object.entries(zs).map(([k, v]) => [k, score(v)]));
  const lineScores = Object.fromEntries(['heart', 'head', 'life', 'fate'].map(k => [k, F[k] ? score(0.5 * F[k].zLen + 0.5 * F[k].zClr) : null]));

  // ── 가장 두드러진 특징: 표준에서 가장 멀리 떨어진 것부터 ──
  const cand = [...traits.map(t => ({ ...t, from: '손 모양', score: Math.abs(t.z) }))];
  for (const r of readings) {
    const f = F[r.key]; if (!f) continue;
    const zz = r.key === 'fate' ? 0.5 * f.zClr + 0.5 * f.zLen : f.zLen;
    cand.push({ key: r.key, title: r.name, z: zz, tier: tier(zz), from: '손금 선', text: r.text.split('. ')[0].replace(/\.$/, '') + '.', score: Math.abs(zz) * 0.9 });
  }
  const standout = cand.sort((a, b) => b.score - a.score).slice(0, 4);

  const summary = compose({ shape, readings, traits, standout, relations, fortunes, F, fateClear, ranked, headHeart, zH, SI });
  return { side: sk, sideInfo: SI, shape, readings, traits, standout, relations, summary, finger, thumb, fortunes, fateClear, lineScores };
}

// ── 총평 ─────────────────────────────────────────────────────
const FN = { wealth: '재물운', love: '애정운', career: '직업운', health: '건강운', social: '대인운' };
function compose(c) {
  const { shape, readings, standout, relations, fortunes, F, fateClear, ranked, headHeart, zH, SI } = c;
  const P = [];
  const p = shape.primary, s = shape.secondary;
  const lead = ranked.length ? `${josa(NAMEH[ranked[0][0]], '이', '가')} 가장 또렷한` : '';
  P.push(`${SI.lead} 이 ${SI.name}은 ${p.name}에 ${s.name}의 기운이 섞였고, ${lead ? lead + ' ' : ''}손입니다. ${p.text}`);
  if (standout.length) P.push(`이 손에서 가장 눈에 띄는 점은 다음과 같습니다. ${standout.slice(0, 3).map(x => x.text).join(' ')}`);
  if (relations.length) P.push(relations.join(' '));
  const ord = Object.entries(fortunes).sort((a, b) => b[1] - a[1]);
  const best = ord[0], worst = ord[ord.length - 1];
  P.push(`다섯 운 중에서는 ${josa(FN[best[0]], '이', '가')} ${best[1]}점으로 가장 좋고 ${josa(FN[worst[0]], '이', '가')} ${worst[1]}점으로 가장 조용합니다. ${ADVICE[worst[0]]}`);
  const key = ranked.length ? ranked[0][0] : 'life';
  const style = headHeart === 'head' ? '생각이 앞서는' : headHeart === 'heart' ? '마음이 앞서는' : '고르게 움직이는';
  P.push(`${style} 사람일수록 ${CLOSE[key]} ${SI.close} 손금은 손바닥 위의 흐름일 뿐, 지금의 선택이 그 선을 조금씩 바꿉니다.`);
  return P;
}
const NAMEH = { heart: '감정선', head: '두뇌선', life: '생명선', fate: '운명선' };
const ADVICE = {
  wealth: '재물은 큰 한 방보다 꾸준한 저축과 계획이 맞으니 지출 습관부터 점검해 보세요.',
  love: '마음을 표현하는 연습이 관계를 한결 따뜻하게 만듭니다.',
  career: '방향이 흔들릴 때는 작은 목표부터 하나씩 이루며 길을 다져 보세요.',
  health: '무리한 일정은 줄이고 규칙적인 수면과 운동으로 체력을 먼저 챙기세요.',
  social: '먼저 안부를 묻는 작은 습관이 인연을 넓혀 줍니다.',
};
const CLOSE = {
  heart: '마음을 돌보는 시간과 믿을 수 있는 사람과의 대화가 큰 힘이 됩니다.',
  head: '생각을 글이나 계획으로 꺼내 정리하면 가진 재능이 더 빨리 열매를 맺습니다.',
  life: '몸이 곧 밑천이니 활력을 지키는 생활 리듬을 만들어 두면 모든 일이 수월해집니다.',
};

// ── 두 손 비교: 왼손(타고난 바탕)과 오른손(지금)의 차이 ──────────
const CMP_NAME = { wealth: '재물운', love: '애정운', career: '직업운', health: '건강운', social: '대인운' };
const LINE_NAME2 = { heart: '감정선', head: '두뇌선', life: '생명선', fate: '운명선' };
const cmpText = (name, d) => (Math.abs(d) <= 3 ? '두 손이 비슷해 타고난 바탕과 지금의 모습이 일치합니다.'
  : d > 0 ? `오른손(지금)이 ${d}점 높아 살아오며 노력으로 키워 온 부분입니다.`
  : `왼손(타고난 바탕)이 ${-d}점 높아 아직 다 꺼내 쓰지 못한 잠재력이 남아 있습니다.`);

/** @param left, right 각각 { reading } (interpretPalm 결과를 담은 손금 결과) */
export function compareHands(left, right) {
  const rows = Object.keys(CMP_NAME).map((k) => {
    const a = left.reading.fortunes[k], b = right.reading.fortunes[k], d = b - a;
    return { key: k, name: CMP_NAME[k], left: a, right: b, delta: d, text: cmpText(CMP_NAME[k], d) };
  });
  const lineRows = Object.keys(LINE_NAME2).map((k) => {
    const a = left.reading.lineScores[k], b = right.reading.lineScores[k];
    if (a == null && b == null) return null;
    if (a == null || b == null) return { key: k, name: LINE_NAME2[k], left: a, right: b, delta: null, text: a == null ? `왼손에서는 찾지 못했지만 오른손에서는 보입니다. 살아오며 새로 또렷해진 선으로 볼 수 있습니다.` : `오른손에서는 흐려졌습니다. 타고난 바탕 중 아직 쓰지 못한 부분입니다.` };
    const d = b - a;
    return { key: k, name: LINE_NAME2[k], left: a, right: b, delta: d, text: cmpText(LINE_NAME2[k], d) };
  }).filter(Boolean);
  const mean = (r) => Math.round(Object.values(r.reading.fortunes).reduce((x, y) => x + y, 0) / 5);
  const mL = mean(left), mR = mean(right), dm = mR - mL;
  const up = [...rows].sort((x, y) => y.delta - x.delta)[0], down = [...rows].sort((x, y) => x.delta - y.delta)[0];
  const summary = [];
  summary.push(Math.abs(dm) <= 2
    ? `두 손의 평균 점수가 ${mL}점과 ${mR}점으로 비슷해, 타고난 바탕과 지금의 모습이 크게 어긋나지 않습니다.`
    : dm > 0 ? `왼손 평균 ${mL}점, 오른손 평균 ${mR}점으로 오른손이 높습니다. 타고난 바탕보다 살아오며 가꾼 부분이 더 빛나는 사람입니다.`
    : `왼손 평균 ${mL}점, 오른손 평균 ${mR}점으로 왼손이 높습니다. 타고난 바탕이 좋은데 아직 다 펼치지 못했을 수 있어 앞으로가 기대됩니다.`);
  if (up.delta > 3) summary.push(`가장 크게 자란 영역은 ${up.name}입니다 (${up.left}점 → ${up.right}점). 노력이 결실을 맺은 자리입니다.`);
  if (down.delta < -3) summary.push(`반대로 ${josa(down.name, '은', '는')} 타고난 ${down.left}점에서 ${down.right}점으로 내려와 있어, 의식적으로 돌보면 다시 올릴 수 있습니다.`);
  const l = left.reading.shape.primary, r = right.reading.shape.primary;
  if (l.key !== r.key) summary.push(`손 모양은 왼손이 ${l.name}, 오른손이 ${r.name}으로 달라, 타고난 기질과 지금 드러나는 기질이 조금 다른 사람입니다.`);
  return { rows, lineRows, summary, means: [mL, mR] };
}
