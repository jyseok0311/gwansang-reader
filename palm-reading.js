// ─────────────────────────────────────────────────────────────
//  손금 풀이 (오락용): palm.js 가 잰 선의 길이·선명도·휘어짐과 손 모양을 관상학처럼
//  표준점수로 바꿔 풀이하고 다섯 가지 운 점수를 낸다.
// ─────────────────────────────────────────────────────────────
import { HAND_POP } from './palm.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const z = (v, [m, s]) => clamp((v - m) / s, -2.5, 2.5);
const combine = (terms) => terms.reduce((a, [w, x]) => a + w * x, 0) / Math.sqrt(terms.reduce((a, [w]) => a + w * w, 0));
const score = (zz) => Math.round(clamp(77 + 9 * zz, 55, 99));

// 선별 특징의 기준값 [평균, 표준편차]. 손바닥 사진 6장에서 잰 분포에 표준편차를 1.25배 넓혀 잡은 값이라 대략적이다.
// 같은 방식으로 재면 선마다 길이·굽기가 저마다 다르므로, 절대값이 아니라 "이 선이 보통보다 긴가 짧은가"로 풀이한다.
const widen = (o) => Object.fromEntries(Object.entries(o).map(([k, [m, sd]]) => [k, [m, sd * 1.25]]));
const REF = {
  life: widen({ len: [0.92, 0.08], clr: [2.8, 0.5], cont: [0.97, 0.025], dev: [0.21, 0.07] }),
  head: widen({ len: [0.67, 0.2], clr: [2.4, 0.9], cont: [0.93, 0.05], dev: [0.06, 0.03], slope: [20, 9] }),
  heart: widen({ len: [0.80, 0.17], clr: [3.2, 1.1], cont: [0.99, 0.02], dev: [0.11, 0.05], endA: [0.19, 0.07] }),
  fate: widen({ len: [0.67, 0.18], clr: [2.25, 0.3], cont: [0.96, 0.04] }),
};
const cat = (zz) => (zz >= 0.5 ? 'hi' : zz <= -0.5 ? 'lo' : 'mid');
const SPREAD_REF = [14, 10];   // 손가락을 가볍게 벌린 사진 기준 (HAND_POP.spread 는 활짝 벌린 경우라 여기서는 따로 쓴다)

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

function headSlope(m) {   // 시작→끝 기울기(도). 양수 = 새끼 쪽으로 갈수록 손목 쪽으로 내려감. rho 는 이미 W 단위 변환된 값 사용
  const dA = m.end.a - m.start.a, dB = (m.end.b - m.start.b) * (m.rho || 1.5);
  return Math.atan2(dB, Math.abs(dA) || 1e-6) * 180 / Math.PI;
}

/** @param palm analyzePalm() 결과 */
export function interpretPalm(palm) {
  const L = palm.lines, rho = palm.frame.rho;
  const M = (k) => L[k]?.m;
  const feat = (k) => {
    const m = M(k); if (!m) return null; const R = REF[k];
    const slope = Math.atan2((m.end.b - m.start.b) * rho, Math.abs(m.end.a - m.start.a) || 1e-6) * 180 / Math.PI;
    return { m, slope, endA: Math.min(m.start.a, m.end.a),
      zLen: z(m.lengthRel, R.len), zClr: z(m.contrast, R.clr), zCont: z(m.continuity, R.cont),
      zDev: R.dev ? z(m.bulge.dev, R.dev) : 0, zSlope: R.slope ? z(slope, R.slope) : 0, zEnd: R.endA ? z(Math.min(m.start.a, m.end.a), R.endA) : 0 };
  };
  const F = { heart: feat('heart'), head: feat('head'), life: feat('life'), fate: feat('fate') };
  const shape = classifyHand(palm.hand);
  const readings = [];

  if (F.heart) {
    const f = F.heart, m = f.m;
    const lenTxt = { hi: '감정선이 길게 뻗어 마음이 깊고, 한번 마음을 주면 오래 지키는 순정파입니다.', mid: '감정선의 길이가 알맞아 감정과 이성의 균형이 좋고 사랑에 안정적입니다.', lo: '감정선이 짧은 편이라 표현이 담백하고 감정에 오래 매이지 않는 현실파입니다.' }[cat(f.zLen)];
    const endTxt = { lo: '선 끝이 검지 쪽까지 닿아 이상이 높고 상대에게 헌신하는 사랑을 합니다.', mid: '선 끝이 중지 아래에 머물러 자기 중심이 뚜렷하고 현실적인 사랑을 합니다.', hi: '선이 일찍 멈춰 마음을 천천히 열고 신중하게 사랑합니다.' }[cat(f.zEnd)];
    const curveTxt = { hi: '부드럽게 굽은 곡선이라 표정과 애정 표현이 풍부합니다.', mid: '적당히 굽은 선이라 표현과 절제가 조화롭습니다.', lo: '곧게 뻗은 선이라 감정을 절제하고 이성적으로 사랑을 판단합니다.' }[cat(f.zDev)];
    readings.push({ key: 'heart', name: '감정선', hanja: '感情線', topic: '사랑과 감정', clarity: clarityLabel(m.contrast),
      headline: { hi: '깊고 오래가는 사랑', mid: '균형 잡힌 사랑', lo: '담백한 사랑' }[cat(f.zLen)], text: `${lenTxt} ${endTxt} ${curveTxt}` });
  }
  if (F.head) {
    const f = F.head, m = f.m;
    const lenTxt = { hi: '두뇌선이 길어 깊이 생각하고 계획을 세우는 신중한 사색가입니다.', mid: '두뇌선의 길이가 알맞아 판단이 균형 잡히고 실행력도 좋습니다.', lo: '두뇌선이 짧은 편이라 결단이 빠르고 직관으로 움직이는 행동가입니다.' }[cat(f.zLen)];
    const slopeTxt = { lo: '선이 곧게 뻗어 현실적이고 논리적으로 사고하며 실속을 챙깁니다.', mid: '선이 완만하게 내려가 현실 감각과 창의성을 함께 갖춘 유연한 사고를 합니다.', hi: '선이 아래로 크게 기울어 상상력과 예술적 감성이 풍부합니다.' }[cat(f.zSlope)];
    const life = F.life?.m;
    const joined = life && Math.hypot(m.start.a - life.start.a, (m.start.b - life.start.b) * rho) < 0.16;
    const startTxt = joined ? '생명선과 가까이 붙어 시작해 신중하고 부모·가족의 영향을 크게 받습니다.' : '생명선과 떨어져 시작해 독립심이 강하고 새로운 도전을 즐깁니다.';
    readings.push({ key: 'head', name: '두뇌선', hanja: '頭腦線', topic: '지혜와 재능', clarity: clarityLabel(m.contrast),
      headline: { lo: '현실적인 사고', mid: '균형 잡힌 사고', hi: '풍부한 상상력' }[cat(f.zSlope)], text: `${lenTxt} ${slopeTxt} ${startTxt}` });
  }
  if (F.life) {
    const f = F.life, m = f.m;
    const lenTxt = { hi: '생명선이 손목 쪽까지 길게 이어져 타고난 체력과 회복력이 좋고 오래 활력을 유지합니다.', mid: '생명선의 길이가 알맞아 무리하지 않으면 건강이 안정적입니다.', lo: '생명선이 짧게 보여 체력을 아껴 쓰는 습관이 중요하며, 규칙적인 생활이 복이 됩니다.' }[cat(f.zLen)];
    const arcTxt = { hi: '엄지 아래를 크게 감싸는 넓은 호를 그려 활동적이고 에너지가 넘칩니다.', mid: '적당한 호를 그려 활동과 휴식의 균형이 잡혀 있습니다.', lo: '엄지 가까이 좁게 흘러 신중하고 안정을 좋아하는 편입니다.' }[cat(f.zDev)];
    const brkTxt = f.zCont <= -0.7 ? ' 선이 군데군데 끊겨 보여 환경이 바뀌는 시기에 컨디션 관리가 필요합니다.' : ' 선이 끊김 없이 이어져 꾸준한 기운을 보여 줍니다.';
    readings.push({ key: 'life', name: '생명선', hanja: '生命線', topic: '건강과 활력', clarity: clarityLabel(m.contrast),
      headline: { hi: '강한 체력과 회복력', mid: '안정적인 활력', lo: '아껴 쓰는 체력' }[cat(f.zLen)], text: `${lenTxt} ${arcTxt}${brkTxt}` });
  }
  let fateClear = false;
  if (F.fate) {
    const f = F.fate, m = f.m;
    fateClear = f.zClr + f.zLen >= 0.4;
    readings.push({ key: 'fate', name: '운명선', hanja: '運命線', topic: '직업과 삶의 방향', clarity: clarityLabel(m.contrast), faint: !fateClear,
      headline: fateClear ? '뚜렷한 삶의 방향' : '스스로 여는 길',
      text: fateClear ? '운명선이 또렷해 일찍부터 삶의 목표가 분명하고, 한번 정한 직업과 길을 꾸준히 밀고 갑니다. 안정적으로 경력을 쌓는 상입니다.'
        : '운명선이 옅어 정해진 길보다 스스로 길을 만들어 가는 자유로운 상입니다. 환경이 바뀌어도 적응이 빠르고, 나이가 들수록 방향이 또렷해집니다.' });
  }

  const h = palm.hand;
  const finger = h.indexRing > HAND_POP.indexRing[0] + 0.03 ? '검지가 약지보다 길어 리더십과 야망이 큰 편입니다.' : h.indexRing < HAND_POP.indexRing[0] - 0.03 ? '약지가 검지보다 길어 승부욕과 예술적 감각이 강한 편입니다.' : '검지와 약지의 길이가 고르게 균형을 이루었습니다.';
  const thumb = h.thumbRatio >= HAND_POP.thumbRatio[0] + 0.1 ? '엄지가 긴 편이라 의지가 강하고 목표를 끝까지 밀어붙입니다.' : h.thumbRatio <= HAND_POP.thumbRatio[0] - 0.1 ? '엄지가 짧은 편이라 유연하고 남의 의견을 잘 받아들입니다.' : '엄지의 길이가 알맞아 의지와 유연함이 조화롭습니다.';

  // ── 다섯 운 ── (선이 없으면 그 항은 0, 즉 보통으로 계산)
  const g = (f, k) => (f ? f[k] : 0);
  const zFate = F.fate ? 0.5 * F.fate.zClr + 0.5 * F.fate.zLen : -0.5;
  const zIdx = z(h.indexRing, HAND_POP.indexRing), zThumb = z(h.thumbRatio, HAND_POP.thumbRatio), zSpread = z(h.spread, SPREAD_REF);
  const zs = {
    wealth: combine([[0.30, zFate], [0.25, zThumb], [0.25, g(F.life, 'zDev')], [0.20, g(F.head, 'zClr')]]),
    love: combine([[0.35, g(F.heart, 'zLen')], [0.35, g(F.heart, 'zClr')], [0.30, g(F.heart, 'zDev')]]),
    career: combine([[0.30, g(F.head, 'zClr')], [0.20, g(F.head, 'zLen')], [0.30, zFate], [0.20, zIdx]]),
    health: combine([[0.35, g(F.life, 'zLen')], [0.35, g(F.life, 'zClr')], [0.30, g(F.life, 'zCont')]]),
    social: combine([[0.30, g(F.heart, 'zLen')], [0.35, zSpread], [0.35, g(F.heart, 'zDev')]]),
  };
  const fortunes = Object.fromEntries(Object.entries(zs).map(([k, v]) => [k, score(v)]));
  return { shape, readings, finger, thumb, fortunes, fateClear };
}
