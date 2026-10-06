// ─────────────────────────────────────────────────────────────
//  관상학 지식 베이스 & 해석 엔진
//  measure.js 가 계산한 비율값을 받아 오행 얼굴형, 삼정(三停), 오관(五官),
//  십이궁(十二宮) 관점의 해설과 다섯 가지 운세 점수를 만들어 낸다. (오락용)
//
//  모든 판정은 표본 인구(POP)의 중앙값·표준편차로 계산한 표준점수(z)로 한다.
//  z = 0 은 보통 사람, +1 은 상위 약 16%, -1 은 하위 약 16%.
//  POP 는 tools/calibrate-population.mjs 로 다시 계산할 수 있다.
// ─────────────────────────────────────────────────────────────

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 가상 인물 표본 44명 (전체 61명 중 정면 사진) · [중앙값, 표준편차]
export const POP = {
  faceRatio: [1.186, 0.0485],
  upperRatio: [0.191, 0.0091],
  middleRatio: [0.3853, 0.011],
  lowerRatio: [0.4236, 0.0141],
  foreheadWidthRatio: [0.7008, 0.0197],
  jawRatio: [0.8023, 0.0206],
  chinLen: [0.2108, 0.0181],
  eyeSize: [0.1925, 0.0087],
  eyeOpen: [0.2905, 0.043],
  eyeTilt: [2.9612, 1.5516],
  interEye: [1.2633, 0.0852],
  glabella: [1.0722, 0.041],
  browArch: [0.2183, 0.0163],
  browLen: [1.6258, 0.063],
  browEyeGap: [0.4986, 0.0493],
  underEye: [1.2911, 0.0741],
  noseLen: [0.2885, 0.0084],
  noseWidth: [0.3094, 0.0161],
  philtrum: [0.0772, 0.0135],
  mouthWidth: [0.3854, 0.0244],
  lipThick: [0.1338, 0.027],
  jawAngle: [132.2337, 2.9025],
  chinWidth: [0.5611, 0.0224],
  symmetry: [0.9414, 0.0502],
  samjeongSpread: [6.3, 4.19],
};
/** 표준점수. 측정 오류로 튀는 값은 ±2.5 로 자른다. */
export const Z = (f, k) => clamp((f[k] - POP[k][0]) / POP[k][1], -2.5, 2.5);
const sig = (z) => 1 / (1 + Math.exp(-1.6 * z));
/** 가중합을 다시 표준점수 규모로 맞춘다 (항목이 서로 독립이라고 가정). */
function combine(terms) {
  const sum = terms.reduce((a, [w, z]) => a + w * z, 0);
  return sum / Math.sqrt(terms.reduce((a, [w]) => a + w * w, 0));
}
export const gradeLabel = (avg) => avg >= 81 ? '상격 上格' : avg >= 74 ? '중상격 中上格' : '중격 中格';

function pick(buckets, v) {
  for (const b of buckets) if (v < b.max) return b;
  return buckets[buckets.length - 1];
}

// ── 오행 얼굴형 ──────────────────────────────────────────────
export const FACE_TYPES = {
  wood: {
    key: 'wood', hanja: '木', name: '목형(木形)', color: '#5cb78a',
    shape: '길고 갸름한 얼굴',
    keyword: '성장 · 인내 · 품격',
    desc: '나무처럼 위로 곧게 뻗은 상입니다. 이마에서 턱까지 길이가 폭보다 여유 있게 길고 선이 정갈합니다. 관상학에서 목형은 학문과 예술, 기획과 전략에 강하며 한 분야를 오래 파고들어 결실을 맺는 대기만성형으로 봅니다.',
    strengths: ['꾸준함과 집중력', '온화하지만 곧은 심성', '학문·전문직 적성'],
    caution: '지나친 완벽주의로 스스로를 몰아세우기 쉬우니, 몸을 움직이며 기운을 풀어주면 운이 잘 돕니다.',
    career: '연구·교육·법률·기획·문화예술 분야',
    lucky: { color: '청록·초록', direction: '동쪽', season: '봄' },
  },
  fire: {
    key: 'fire', hanja: '火', name: '화형(火形)', color: '#e0643f',
    shape: '이마는 아담하고 턱이 발달한 얼굴',
    keyword: '열정 · 추진 · 카리스마',
    desc: '위는 뾰족하고 아래는 넉넉한(上尖下闊) 불의 상입니다. 화형은 예민한 감각과 빠른 판단, 사람을 끄는 활력을 지녀 무대와 현장에서 빛납니다. 행동이 먼저인 실천가형으로 봅니다.',
    strengths: ['결단력과 실행력', '뜨거운 열정', '리더의 존재감'],
    caution: '불은 크게 타오르는 만큼 꺼지기도 쉬우니, 서두르지 않고 호흡을 고르는 습관이 운을 지킵니다.',
    career: '영업·방송·스포츠·창업·요식업 분야',
    lucky: { color: '적색·주홍', direction: '남쪽', season: '여름' },
  },
  earth: {
    key: 'earth', hanja: '土', name: '토형(土形)', color: '#c9a24a',
    shape: '넓고 두툼하며 안정감 있는 얼굴',
    keyword: '신뢰 · 포용 · 축적',
    desc: '대지처럼 넓고 두터운 상입니다. 얼굴 폭이 여유롭고 턱과 살집이 든든해 보는 이에게 안정감을 줍니다. 토형은 신용을 바탕으로 재물을 차곡차곡 모으고, 주변 사람을 품는 그릇이 큰 상으로 봅니다.',
    strengths: ['묵직한 신뢰감', '재물을 지키는 힘', '넉넉한 인덕'],
    caution: '안정에 머물다 기회를 놓칠 수 있으니, 가끔은 낯선 길로 한 발 내딛는 용기가 큰 복을 부릅니다.',
    career: '금융·부동산·경영·행정·농업 분야',
    lucky: { color: '황토·황금', direction: '중앙', season: '늦여름' },
  },
  metal: {
    key: 'metal', hanja: '金', name: '금형(金形)', color: '#d9d9e3',
    shape: '각이 살아 있는 단정한 사각형 얼굴',
    keyword: '원칙 · 결단 · 명예',
    desc: '쇠처럼 단단하고 단정한 상입니다. 이마와 턱의 폭이 고르고 윤곽에 각이 살아 있어 의지가 얼굴에 드러납니다. 금형은 원칙과 책임감이 강해 조직에서 신임을 얻고 명예운이 따르는 상으로 봅니다.',
    strengths: ['강한 의지와 책임감', '공정한 판단력', '조직에서의 신임'],
    caution: '지나친 강직함은 외로움을 부르니, 부드러운 말 한마디가 귀인을 곁에 두는 열쇠가 됩니다.',
    career: '군·경·공직·의료·엔지니어링·관리직 분야',
    lucky: { color: '백색·은색', direction: '서쪽', season: '가을' },
  },
  water: {
    key: 'water', hanja: '水', name: '수형(水形)', color: '#5b8fd9',
    shape: '둥글고 부드러운 곡선의 얼굴',
    keyword: '지혜 · 유연 · 친화',
    desc: '물처럼 둥글고 부드러운 상입니다. 윤곽에 각이 적고 곡선이 흐르듯 이어져 부드러운 인상을 줍니다. 수형은 총명하고 적응력이 뛰어나며 사람 사이를 매끄럽게 이어주는 재능이 있어 인복이 두터운 상으로 봅니다.',
    strengths: ['총명함과 임기응변', '뛰어난 친화력', '풍부한 감성'],
    caution: '물은 그릇을 따라 모양이 바뀌니, 스스로의 중심을 세우면 재물과 사람이 오래 머뭅니다.',
    career: '외교·마케팅·상담·유통·미디어 분야',
    lucky: { color: '흑색·남색', direction: '북쪽', season: '겨울' },
  },
};

/** 오행 얼굴형 원점수 (보정 전). tools/calibrate-population.mjs --offsets 가 평균을 구할 때도 쓴다. */
export function faceTypeScores(f) {
  const zF = Z(f, 'faceRatio'), zJ = Z(f, 'jawRatio'), zH = Z(f, 'foreheadWidthRatio'), zC = Z(f, 'chinLen'), zL = Z(f, 'lowerRatio');
  return {
    wood: 1.0 * zF - 0.4 * zJ - 0.3 * zH,              // 길고 갸름함
    fire: -0.9 * zH + 0.6 * zJ + 0.3 * zL,             // 위는 좁고 아래가 넓음
    earth: -0.6 * zF + 0.6 * zJ + 0.5 * zC,            // 짧고 넓으며 턱이 두툼함
    metal: 0.7 * zH + 0.5 * zJ - 0.5 * Math.abs(zF),   // 이마·턱 폭이 고른 사각
    water: -0.9 * zF - 0.5 * zJ - 0.2 * zC,            // 짧고 둥근 곡선
  };
}
// 표본 평균을 빼서 다섯 형이 고르게 나오도록 맞춘다 (node tools/calibrate-population.mjs --offsets)
const FACE_TYPE_OFFSET = { wood: 0.207, fire: -0.169, earth: -0.117, metal: -0.373, water: -0.135 };

export function classifyFaceType(f) {
  const s = faceTypeScores(f);
  for (const k in s) s[k] -= FACE_TYPE_OFFSET[k];
  const ranked = Object.entries(s).sort((a, b) => b[1] - a[1]);
  const exp = ranked.map(([k, v]) => [k, Math.exp(v * 1.4)]);
  const total = exp.reduce((acc, [, v]) => acc + v, 0);
  return {
    primary: FACE_TYPES[ranked[0][0]],
    secondary: FACE_TYPES[ranked[1][0]],
    weights: exp.map(([k, v]) => ({ type: FACE_TYPES[k], pct: Math.round((v / total) * 100) })),
  };
}


// ── 십자면상(十字面相): 얼굴 윤곽을 열 글자에 빗댄 분류 ─────────
// 각 형의 전형적인 모양을 표준점수(z) 목표값으로 정의하고, 가장 가까운 형을 고른다.
// F 얼굴 길이, H 이마 폭, J 턱 폭, A 턱 각도(작을수록 각짐), C 턱 끝 폭, S 좌우 균형, U 상정, L 하정
export const SIPJA_TYPES = {
  jeon: { char: '田', name: '전자형(田字形)', shape: '네모반듯하고 이마·광대·턱이 고르게 넓은 얼굴',
    proto: { F: -0.9, H: 0.7, J: 0.8, A: -0.9, C: 0.6 },
    text: '밭 전(田)자처럼 윤곽이 네모반듯하고 이마와 턱이 고르게 넓습니다. 관상에서는 땅처럼 든든한 상이라 하여 재물과 부동산의 복이 두텁고, 한번 쥔 것을 오래 지키는 힘이 강하다고 봅니다. 중년 이후 재산이 불어나는 흐름입니다.',
    advice: '뚝심이 고집으로 비치지 않도록 마음의 문을 조금 더 열어 두세요.',
    closing: '네모반듯한 윤곽처럼 쌓을수록 단단해지는 상입니다.' },
  yu: { char: '由', name: '유자형(由字形)', shape: '이마는 아담하고 아래턱이 넓은 얼굴',
    proto: { H: -1.1, J: 0.9, C: 0.8, U: -0.3, L: 0.3 },
    text: '말미암을 유(由)자처럼 위는 아담하고 아래가 넉넉합니다. 초년에는 스스로 길을 개척하느라 애쓰지만, 중년 이후 크게 일어서는 대기만성·자수성가의 상입니다. 말년이 풍요롭고 아랫사람이 잘 따릅니다.',
    advice: '젊은 날의 고생을 두려워하지 마세요. 뿌리가 깊을수록 늦게 핀 꽃이 오래갑니다.',
    closing: '아래가 넉넉한 윤곽처럼 갈수록 복이 차오르는 상입니다.' },
  gap: { char: '甲', name: '갑자형(甲字形)', shape: '이마가 넓고 턱이 좁아지는 역삼각형 얼굴',
    proto: { H: 1.0, J: -0.9, C: -1.0, U: 0.4 },
    text: '갑옷 갑(甲)자처럼 이마가 넓고 턱으로 갈수록 좁아집니다. 머리가 명석하고 기획·학문에 강해 초년부터 두각을 나타내는 상입니다. 생각이 앞서가는 만큼 남보다 먼저 기회를 알아봅니다.',
    advice: '말년을 위해 건강과 저축을 일찍 챙기면 초년의 빛이 끝까지 이어집니다.',
    closing: '넓은 이마처럼 멀리 내다보는 지혜가 운을 이끄는 상입니다.' },
  sin: { char: '申', name: '신자형(申字形)', shape: '이마와 턱이 좁고 광대가 넓은 마름모형 얼굴',
    proto: { H: -1.0, J: -0.8, C: -0.8, F: 0.2 },
    text: '납 신(申)자처럼 이마와 턱은 좁고 가운데 광대가 넓습니다. 활동력과 추진력이 뛰어나 중년에 기회를 크게 잡는 상입니다. 변화가 많은 환경일수록 오히려 실력이 드러납니다.',
    advice: '서두르는 마음을 다스리고 사람을 곁에 두면 중년의 기회가 오래 머뭅니다.',
    closing: '가운데가 힘찬 윤곽처럼 한창때에 크게 도약하는 상입니다.' },
  dong: { char: '同', name: '동자형(同字形)', shape: '이마·광대·턱이 고르고 반듯한 직사각형 얼굴',
    proto: { F: 0.8, H: 0.5, J: 0.6, A: -0.4, C: 0.3 },
    text: '한가지 동(同)자처럼 위아래 폭이 고르고 반듯합니다. 관상에서 복록이 고르게 갖춰진 상으로 보며, 조직에서 두루 신임을 얻고 평생 큰 굴곡 없이 안정된 길을 갑니다.',
    advice: '안정 속에서도 새로운 도전을 한 번씩 해 보면 복의 그릇이 더 커집니다.',
    closing: '반듯한 윤곽처럼 한결같은 신뢰가 복을 부르는 상입니다.' },
  wang: { char: '王', name: '왕자형(王字形)', shape: '뼈대가 드러나고 각이 선 얼굴',
    proto: { A: -1.2, H: -0.6, J: 0.2, F: 0.5 },
    text: '임금 왕(王)자처럼 이마·광대·턱의 뼈대가 또렷하고 각이 섭니다. 의지가 강하고 개척 정신이 뛰어나 역경을 뚫고 이름을 날리는 상입니다. 위기에서 오히려 진가가 드러납니다.',
    advice: '강한 기운을 부드러운 말씨로 감싸면 따르는 사람이 크게 늘어납니다.',
    closing: '또렷한 뼈대처럼 굳은 의지로 길을 여는 상입니다.' },
  won: { char: '圓', name: '원자형(圓字形)', shape: '둥글고 부드러운 곡선의 얼굴',
    proto: { F: -1.1, A: 1.1, C: 0.5, J: 0.2 },
    text: '둥글 원(圓)자처럼 윤곽이 둥글고 부드럽습니다. 성품이 원만해 사람이 모이고 인복과 식복이 두터운 상입니다. 갈등을 부드럽게 풀어 주위를 편안하게 만드는 힘이 있습니다.',
    advice: '결정할 때는 한 번 더 단호해지세요. 원만함에 결단이 더해지면 큰일을 이룹니다.',
    closing: '둥근 윤곽처럼 사람과 복이 모여드는 상입니다.' },
  mok: { char: '目', name: '목자형(目字形)', shape: '세로로 길고 갸름한 얼굴',
    proto: { F: 1.4, H: -0.3, J: -0.4, C: -0.2 },
    text: '눈 목(目)자처럼 세로로 길고 갸름합니다. 섬세하고 지적이며 예술적 감각이 뛰어나, 한 우물을 깊이 파는 전문가로 명예를 얻는 상입니다.',
    advice: '혼자 파고드는 시간만큼 사람과 어울리는 시간도 챙기면 운이 넓어집니다.',
    closing: '길게 뻗은 윤곽처럼 한 길을 깊이 가는 상입니다.' },
  yong: { char: '用', name: '용자형(用字形)', shape: '좌우가 조금 다르고 아래가 두툼한 얼굴',
    proto: { S: -1.3, L: 0.4, J: 0.4 },
    text: '쓸 용(用)자처럼 좌우의 모양이 조금씩 다르고 아래가 두툼합니다. 개성이 뚜렷하고 재주가 여러 갈래라 어디서든 쓰임이 많은 실용의 상입니다. 늦게 빛을 보지만 그만큼 오래갑니다.',
    advice: '재주가 많을수록 한곳에 힘을 모을 때 가장 크게 빛납니다.',
    closing: '쓰임이 많은 윤곽처럼 재주로 길을 넓히는 상입니다.' },
  pung: { char: '風', name: '풍자형(風字形)', shape: '이마와 턱이 넓고 볼이 갸름한 얼굴',
    proto: { H: 1.0, J: 1.0, F: 0.2, A: 0.3 },
    text: '바람 풍(風)자처럼 이마와 턱은 넓고 볼은 갸름합니다. 대범하고 사교적이며 이동과 변화가 많은 넓은 무대에서 활약하는 상입니다. 여행과 새로운 만남에서 기회를 얻습니다.',
    advice: '들어오는 만큼 나가기 쉬우니 재물 관리를 꼼꼼히 하면 복이 머뭅니다.',
    closing: '바람처럼 넓은 세상을 누비며 기회를 얻는 상입니다.' },
};

/** 십자면상 원점수 (보정 전). 목표값에 가까울수록 크다. */
export function sipjaScores(f) {
  const z = { F: Z(f, 'faceRatio'), H: Z(f, 'foreheadWidthRatio'), J: Z(f, 'jawRatio'), A: Z(f, 'jawAngle'),
    C: Z(f, 'chinWidth'), S: Z(f, 'symmetry'), U: Z(f, 'upperRatio'), L: Z(f, 'lowerRatio') };
  const out = {};
  for (const [k, t] of Object.entries(SIPJA_TYPES)) {
    let dot = 0, norm = 0;
    for (const [d, v] of Object.entries(t.proto)) { dot += z[d] * v; norm += v * v; }
    out[k] = dot - norm / 2;   // |z - proto|² 최소화와 같다 (|z|² 는 모든 형에 공통)
  }
  return out;
}
// 형마다 점수의 평균과 퍼짐 폭이 달라 일부 형만 자주 1위가 되므로, 표본 기준으로 표준화한다
// [평균, 표준편차] (node tools/calibrate-population.mjs --offsets)
const SIPJA_NORM = { yong: [-0.678, 1.387], jeon: [-1.526, 2.325], yu: [-1.69, 2.659], gap: [-1.225, 2.615], sin: [-1.077, 1.601], dong: [-0.462, 1.188], wang: [-0.607, 1.315], won: [-1.988, 0.974], mok: [-0.793, 1.497], pung: [-1.081, 1.133] };

export function classifySipja(f) {
  const s = sipjaScores(f);
  for (const k in s) s[k] = (s[k] - SIPJA_NORM[k][0]) / SIPJA_NORM[k][1];
  const ranked = Object.entries(s).sort((a, b) => b[1] - a[1]);
  const exp = ranked.map(([k, v]) => [k, Math.exp(v * 1.5)]);
  const total = exp.reduce((acc, [, v]) => acc + v, 0);
  return {
    primary: { key: ranked[0][0], ...SIPJA_TYPES[ranked[0][0]] },
    weights: exp.slice(0, 3).map(([k, v]) => ({ key: k, ...SIPJA_TYPES[k], pct: Math.round((v / total) * 100) })),
  };
}

// ── 삼정(三停): 인생 흐름 ────────────────────────────────────
export function analyzeSamjeong(f) {
  const idx = {
    upper: Math.round(f.upperRatio / POP.upperRatio[0] * 100),
    middle: Math.round(f.middleRatio / POP.middleRatio[0] * 100),
    lower: Math.round(f.lowerRatio / POP.lowerRatio[0] * 100),
  };
  const stages = [
    { key: 'upper', name: '상정(上停)', part: '이마', period: '초년운 · 15~30세', idx: idx.upper, z: Z(f, 'upperRatio'),
      high: '이마가 넉넉하게 발달해 초년에 배움과 귀인의 도움이 따릅니다. 부모와 스승의 덕이 크고 젊을 때 기반을 다지는 상입니다.',
      mid: '이마의 비율이 표준에 가까워 초년운이 안정적으로 흐릅니다. 큰 굴곡 없이 차분하게 기초를 쌓는 시기입니다.',
      low: '이마가 아담해 초년에는 스스로 길을 개척하는 자수성가형입니다. 남보다 이른 독립이 오히려 큰 그릇을 만듭니다.' },
    { key: 'middle', name: '중정(中停)', part: '눈썹~코끝', period: '중년운 · 31~50세', idx: idx.middle, z: Z(f, 'middleRatio'),
      high: '중정이 길고 힘이 있어 중년에 크게 일어서는 상입니다. 사회적 지위와 재물이 이 시기에 집중됩니다.',
      mid: '중정이 균형 잡혀 중년운이 순탄합니다. 쌓아온 것을 안정적으로 키워가는 시기입니다.',
      low: '중정이 짧아 중년에는 실속을 챙기는 것이 유리합니다. 크게 벌리기보다 다지는 전략이 재물을 지킵니다.' },
    { key: 'lower', name: '하정(下停)', part: '인중~턱', period: '말년운 · 51세 이후', idx: idx.lower, z: Z(f, 'lowerRatio'),
      high: '하정이 발달해 말년이 든든한 상입니다. 자손과 아랫사람의 덕이 있고 노후가 풍요롭습니다.',
      mid: '하정이 표준에 가까워 말년운이 평온합니다. 중년의 결실을 무리 없이 누리는 시기입니다.',
      low: '하정이 아담해 말년에는 건강과 인간관계를 미리 챙기는 것이 좋습니다. 준비된 노후가 복을 부릅니다.' },
  ];
  for (const s of stages) s.text = s.z >= 0.6 ? s.high : s.z <= -0.6 ? s.low : s.mid;
  const best = [...stages].sort((a, b) => b.z - a.z)[0];
  const spread = Math.max(idx.upper, idx.middle, idx.lower) - Math.min(idx.upper, idx.middle, idx.lower);
  const balance = spread <= POP.samjeongSpread[0] * 0.7 ? '삼정이 고르게 균형을 이루어 인생 전반이 크게 기울지 않고 순탄하게 흐르는 귀한 상입니다.'
    : spread <= POP.samjeongSpread[0] * 1.4 ? '삼정의 균형이 대체로 잘 잡혀 있습니다. 시기마다 강약은 있으나 흐름이 안정적입니다.'
    : `삼정 가운데 ${best.name}이 특히 발달해 ${best.period.split(' · ')[0]}에 운의 정점이 옵니다. 그 시기를 미리 준비하면 결실이 큽니다.`;
  return { stages, best, balance, spread };
}

// ── 부위별(오관) 해설 ────────────────────────────────────────
// metric 은 표준점수(z). -0.6 / +0.6 을 경계로 약 27% · 46% · 27% 로 나뉜다.
const LO = -0.6, HI = 0.6;
export const PARTS = [
  {
    id: 'forehead', name: '이마', hanja: '額 · 관록궁', metric: f => Z(f, 'upperRatio'),
    buckets: [
      { max: LO, grade: '平', label: '아담한 이마', text: '이마가 아담해 실행력이 좋고 현실 감각이 뛰어납니다. 머리로 재기보다 몸으로 부딪혀 성취를 얻는 상으로, 젊어서 스스로 길을 여는 자수성가의 기운이 있습니다.' },
      { max: HI, grade: '吉', label: '단정한 이마', text: '이마가 단정하고 균형이 좋아 관록궁(官祿宮)이 안정되어 있습니다. 직장과 명예운이 무난하게 따르고 윗사람과의 인연이 순조롭습니다.' },
      { max: Infinity, grade: '大吉', label: '넓고 훤한 이마', text: '이마가 넓고 훤해 관록궁이 크게 열려 있습니다. 지혜와 통찰이 깊고 귀인의 도움이 잘 따르며, 초년부터 남보다 한발 앞서 기회를 잡는 상입니다.' },
    ],
  },
  {
    id: 'brow', name: '눈썹', hanja: '眉 · 보수관', metric: f => Z(f, 'browArch'),
    buckets: [
      { max: LO, grade: '吉', label: '일자 눈썹', text: '눈썹이 곧게 뻗은 일자형입니다. 의지가 굳고 한 번 정한 일은 끝까지 밀고 가는 뚝심이 있습니다. 형제궁(兄弟宮)이 곧아 친구와 동료의 의리가 두텁습니다.' },
      { max: HI, grade: '大吉', label: '자연스러운 아치 눈썹', text: '눈썹이 부드러운 활 모양으로 흐릅니다. 이성과 감성의 균형이 좋고 사람을 대하는 감각이 뛰어나 대인 관계에서 복이 있습니다.' },
      { max: Infinity, grade: '吉', label: '높이 솟은 아치 눈썹', text: '눈썹이 높이 솟아 예술적 감각과 표현력이 풍부한 상입니다. 감정이 풍부하고 미적 안목이 뛰어나 창작·기획 분야에서 빛납니다.' },
    ],
  },
  {
    id: 'glabella', name: '미간', hanja: '印堂 · 명궁', metric: f => Z(f, 'glabella'),
    buckets: [
      { max: LO, grade: '平', label: '좁은 미간', text: '미간이 모여 있어 집중력과 분석력이 강합니다. 세밀한 일에 능하지만 걱정을 혼자 안는 편이니, 명궁(命宮)을 밝게 펴는 여유가 운을 틔웁니다.' },
      { max: HI, grade: '大吉', label: '밝고 반듯한 미간', text: '명궁(命宮)인 미간이 반듯하게 열려 있습니다. 관상에서 가장 중시하는 자리가 밝으니 소원이 잘 이루어지고 큰 위기를 피해 가는 복이 있습니다.' },
      { max: Infinity, grade: '吉', label: '넓은 미간', text: '미간이 넓어 낙천적이고 포용력이 큽니다. 사소한 일에 얽매이지 않고 크게 보는 안목이 있어 사람들이 편안하게 따릅니다.' },
    ],
  },
  {
    id: 'eyes', name: '눈', hanja: '目 · 감찰관', metric: f => Z(f, 'eyeSize'),
    buckets: [
      { max: LO, grade: '吉', label: '깊고 예리한 눈', text: '눈이 아담하고 예리해 관찰력과 신중함이 뛰어납니다. 쉽게 속지 않고 실속을 챙기는 상으로, 재물을 새지 않게 지키는 힘이 있습니다.' },
      { max: HI, grade: '大吉', label: '균형 잡힌 맑은 눈', text: '눈의 크기와 비율이 균형을 이루어 감찰관(監察官)이 바르게 서 있습니다. 판단이 공정하고 사람을 보는 눈이 밝아 신뢰를 얻습니다.' },
      { max: Infinity, grade: '吉', label: '크고 또렷한 눈', text: '눈이 크고 또렷해 감수성과 표현력이 풍부합니다. 정이 많고 매력이 강해 이성과 대중에게 사랑받는 상입니다.' },
    ],
  },
  {
    id: 'eyeTilt', name: '눈꼬리', hanja: '魚尾 · 부처궁', metric: f => Z(f, 'eyeTilt'),
    buckets: [
      { max: LO, grade: '吉', label: '부드럽게 내려간 눈꼬리', text: '눈꼬리가 순하게 내려와 온화하고 인정이 많습니다. 부처궁(夫妻宮)이 부드러워 배려 깊은 인연을 맺고, 사람들이 마음을 쉽게 열어 줍니다.' },
      { max: HI, grade: '大吉', label: '균형 잡힌 눈꼬리', text: '눈꼬리의 기울기가 알맞아 부처궁(夫妻宮)이 안정되어 있습니다. 애정 관계가 큰 굴곡 없이 오래 이어지고 가정운이 평온한 상입니다.' },
      { max: Infinity, grade: '吉', label: '위로 올라간 눈꼬리', text: '눈꼬리가 올라가 승부욕과 카리스마가 강합니다. 목표를 향해 밀고 가는 힘이 있고 이성에게 강한 매력을 발산하는 상입니다.' },
    ],
  },
  {
    id: 'eyelid', name: '눈두덩', hanja: '田宅宮 · 전택궁', metric: f => Z(f, 'browEyeGap'),
    buckets: [
      { max: LO, grade: '吉', label: '눈썹과 눈이 가까운 상', text: '눈썹과 눈 사이가 가까워 판단이 빠르고 실속을 챙깁니다. 전택궁(田宅宮)이 촘촘해 자기 것을 알차게 지키는 힘이 있습니다.' },
      { max: HI, grade: '大吉', label: '넉넉한 전택궁', text: '눈두덩이 넉넉해 전택궁(田宅宮)이 잘 발달했습니다. 부동산과 주거의 복이 있고 마음의 여유가 얼굴에 드러나 사람을 편안하게 합니다.' },
      { max: Infinity, grade: '吉', label: '매우 넓은 눈두덩', text: '눈두덩이 넓어 느긋하고 포용력이 큽니다. 크게 베풀고 크게 받는 상으로 집안과 재산의 복이 두텁습니다.' },
    ],
  },
  {
    id: 'nose', name: '코', hanja: '鼻 · 재백궁', metric: f => Z(f, 'noseWidth'),
    buckets: [
      { max: LO, grade: '吉', label: '단정하고 오목한 코', text: '코가 단정하고 콧방울이 정갈합니다. 재백궁(財帛宮)이 정밀하게 잡혀 있어 계획적으로 돈을 다루고 낭비가 적은 상입니다.' },
      { max: HI, grade: '大吉', label: '균형 잡힌 재백궁', text: '코의 길이와 폭이 균형을 이루어 재백궁(財帛宮)이 든든합니다. 들어오는 재물과 나가는 재물의 흐름이 안정되어 중년에 재산이 쌓입니다.' },
      { max: Infinity, grade: '大吉', label: '풍성한 콧방울', text: '콧방울이 풍성해 금고(金庫)가 큰 상입니다. 재물을 끌어당기는 힘이 강하고 큰돈을 다루는 그릇이 있어 사업·투자에서 복이 따릅니다.' },
    ],
  },
  {
    id: 'philtrum', name: '인중', hanja: '人中 · 수명궁', metric: f => Z(f, 'philtrum'),
    buckets: [
      { max: LO, grade: '吉', label: '짧고 또렷한 인중', text: '인중이 짧아 순발력과 감정 표현이 풍부합니다. 젊은 기운이 오래 유지되고 주변을 즐겁게 만드는 재치가 있습니다.' },
      { max: HI, grade: '大吉', label: '반듯한 인중', text: '인중이 반듯하고 골이 선명해 생명력이 강한 상입니다. 자손의 복이 있고 건강운이 안정되어 오래도록 활력을 유지합니다.' },
      { max: Infinity, grade: '大吉', label: '길고 깊은 인중', text: '인중이 길고 깊어 장수(長壽)의 상입니다. 인내심이 깊고 위기를 견디는 힘이 강해 말년까지 복록이 이어집니다.' },
    ],
  },
  {
    id: 'mouth', name: '입', hanja: '口 · 출납관', metric: f => Z(f, 'mouthWidth'),
    buckets: [
      { max: LO, grade: '吉', label: '단아한 입', text: '입이 단아하고 다부집니다. 말을 아끼고 비밀을 지키는 신중함이 있어 신뢰를 얻고, 세밀한 일에서 실력을 발휘합니다.' },
      { max: HI, grade: '大吉', label: '균형 잡힌 입', text: '입의 크기가 얼굴과 조화를 이루어 출납관(出納官)이 바릅니다. 말에 신용이 있고 먹고사는 복(食祿)이 안정된 상입니다.' },
      { max: Infinity, grade: '大吉', label: '크고 시원한 입', text: '입이 크고 시원해 대범하고 사교적입니다. 사람을 모으는 힘이 있고 큰 조직을 이끄는 그릇으로, 말년 식록(食祿)이 풍족합니다.' },
    ],
  },
  {
    id: 'lips', name: '입술', hanja: '唇 · 정애', metric: f => Z(f, 'lipThick'),
    buckets: [
      { max: LO, grade: '吉', label: '얇고 정갈한 입술', text: '입술이 얇고 정갈해 이성적이고 언변이 논리적입니다. 감정에 휘둘리지 않고 냉철하게 판단하는 힘이 있습니다.' },
      { max: HI, grade: '大吉', label: '도톰한 입술', text: '입술이 도톰하고 균형이 좋아 정(情)이 깊고 애정운이 좋은 상입니다. 사람을 따뜻하게 대해 곁에 좋은 인연이 오래 머뭅니다.' },
      { max: Infinity, grade: '吉', label: '풍성한 입술', text: '입술이 풍성해 애정이 넘치고 감성이 풍부합니다. 정이 깊어 사랑받는 상이나, 정 때문에 손해 보지 않도록 경계선을 지키면 더 좋습니다.' },
    ],
  },
  {
    id: 'jaw', name: '턱', hanja: '顎 · 노복궁', metric: f => Z(f, 'jawRatio'),
    buckets: [
      { max: LO, grade: '吉', label: '갸름한 턱', text: '턱선이 갸름해 섬세하고 예술적인 감각이 있습니다. 변화를 두려워하지 않는 유연함이 있어 새로운 환경에 잘 적응합니다.' },
      { max: HI, grade: '大吉', label: '균형 잡힌 턱', text: '턱이 얼굴과 조화를 이루어 노복궁(奴僕宮)이 안정되어 있습니다. 아랫사람의 도움을 받고 말년에 든든한 기반을 누리는 상입니다.' },
      { max: Infinity, grade: '大吉', label: '넓고 든든한 턱', text: '턱이 넓고 든든해 추진력과 지도력이 강합니다. 노복궁이 크게 발달해 따르는 사람이 많고 말년에 재물과 명예가 함께 오는 상입니다.' },
    ],
  },
  {
    id: 'symmetry', name: '좌우 균형', hanja: '陰陽 · 조화', metric: f => Z(f, 'symmetry'),
    buckets: [
      { max: LO, grade: '吉', label: '개성 있는 좌우', text: '좌우의 미묘한 차이가 개성으로 드러나는 얼굴입니다. 다면적인 매력이 있고 상황에 따라 다른 얼굴을 보여주는 재능이 있습니다.' },
      { max: HI, grade: '大吉', label: '조화로운 좌우', text: '좌우가 조화롭게 균형을 이루어 심신이 안정된 상입니다. 감정 기복이 적고 판단이 일관되어 주변의 신뢰를 얻습니다.' },
      { max: Infinity, grade: '大吉', label: '매우 정교한 균형', text: '좌우 대칭이 매우 정교해 음양의 조화가 뛰어난 귀상입니다. 건강운이 좋고 인생의 큰 굴곡을 피해 가는 힘이 있습니다.' },
    ],
  },
];

export function analyzeParts(f) {
  return PARTS.map(p => {
    const v = p.metric(f);
    const b = pick(p.buckets, v);
    return { id: p.id, name: p.name, hanja: p.hanja, value: v, grade: b.grade, label: b.label, text: b.text };
  });
}

// ── 십이궁(十二宮) 요약 ──────────────────────────────────────
export function analyzePalaces(f) {
  const up = (k) => sig(Z(f, k));                                 // 클수록 길
  const mid = (k) => clamp(1 - Math.abs(Z(f, k)) / 2, 0, 1);       // 알맞을수록 길
  const g = (x) => x >= 0.65 ? '上' : x >= 0.35 ? '中' : '下';
  const list = [
    { name: '명궁(命宮)', part: '미간', score: mid('glabella'), desc: '운명의 중심, 소원 성취' },
    { name: '관록궁(官祿宮)', part: '이마 중앙', score: up('upperRatio'), desc: '직업 · 명예 · 지위' },
    { name: '재백궁(財帛宮)', part: '코', score: up('noseWidth'), desc: '재물 · 금전 흐름' },
    { name: '전택궁(田宅宮)', part: '눈두덩', score: up('browEyeGap'), desc: '부동산 · 주거 · 가업' },
    { name: '형제궁(兄弟宮)', part: '눈썹', score: up('browLen'), desc: '형제 · 친구 · 동료' },
    { name: '부처궁(夫妻宮)', part: '눈꼬리', score: up('eyeTilt'), desc: '배우자 · 연애 · 가정' },
    { name: '남녀궁(男女宮)', part: '눈 아래', score: up('underEye'), desc: '자손 · 창조력' },
    { name: '질액궁(疾厄宮)', part: '산근(콧대 위)', score: up('interEye'), desc: '건강 · 재난 회피' },
    { name: '천이궁(遷移宮)', part: '이마 양옆', score: up('foreheadWidthRatio'), desc: '이동 · 여행 · 변화' },
    { name: '노복궁(奴僕宮)', part: '턱', score: up('jawRatio'), desc: '아랫사람 · 말년' },
    { name: '복덕궁(福德宮)', part: '눈썹 꼬리 위', score: sig((Z(f, 'browEyeGap') + Z(f, 'upperRatio')) / Math.SQRT2), desc: '복 · 덕 · 정신적 만족' },
    { name: '부모궁(父母宮)', part: '이마 좌우 상단', score: up('symmetry'), desc: '부모 · 윗사람의 덕' },
  ];
  return list.map(p => ({ ...p, grade: g(p.score) }));
}

// ── 다섯 가지 운세 점수 ──────────────────────────────────────
/** 다섯 운의 원점수(표준점수, 보정 전). tools/calibrate-population.mjs --offsets 가 평균을 구할 때도 쓴다. */
export function fortuneZ(f, samjeong) {
  const z = (k) => Z(f, k);
  const zBalance = clamp((POP.samjeongSpread[0] - samjeong.spread) / POP.samjeongSpread[1], -2.5, 2.5);
  return {
    wealth: combine([[0.35, z('noseWidth')], [0.25, z('jawRatio')], [0.2, z('upperRatio')], [0.2, z('browEyeGap')]]),
    love: combine([[0.3, z('lipThick')], [0.25, z('eyeSize')], [0.25, z('eyeTilt')], [0.2, z('glabella')]]),
    career: combine([[0.3, z('upperRatio')], [0.25, z('jawRatio')], [0.2, z('browLen')], [0.25, zBalance]]),
    health: combine([[0.35, zBalance], [0.3, z('symmetry')], [0.2, z('philtrum')], [0.15, z('chinLen')]]),
    social: combine([[0.3, z('mouthWidth')], [0.25, z('interEye')], [0.25, z('glabella')], [0.2, z('browEyeGap')]]),
  };
}
// 표본 평균을 빼서 다섯 운이 고르게 1위가 되도록 맞춘다 (node tools/calibrate-population.mjs --offsets)
const FORTUNE_OFFSET = { wealth: 0.008, love: 0.014, career: -0.132, health: -0.268, social: -0.059 };

export function analyzeFortunes(f, samjeong) {
  const raw = fortuneZ(f, samjeong);
  const zs = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v - FORTUNE_OFFSET[k]]));
  const meta = {
    wealth: { name: '재물운', hanja: '財', icon: '🪙',
      tiers: ['재물의 그릇이 크게 열려 있습니다. 코와 턱이 든든해 큰돈을 다루고 지키는 힘이 함께 있으니 사업·투자에서 결실이 큽니다.',
        '재물운이 안정적으로 흐릅니다. 들어오는 것과 나가는 것의 균형이 좋아 꾸준히 자산이 쌓이는 상입니다.',
        '재물은 계획적으로 다룰 때 힘을 발휘합니다. 한 번에 크게 벌기보다 흐름을 관리하면 재백궁이 살아납니다.',
        '재물은 사람에게서 옵니다. 신뢰를 쌓는 데 집중하면 재물이 뒤따르는 상이니 조급함을 내려놓으세요.'] },
    love: { name: '애정운', hanja: '愛', icon: '💞',
      tiers: ['애정운이 매우 밝습니다. 눈과 입술에 정이 가득해 사랑을 주고받는 힘이 크고, 깊고 오래가는 인연을 만나는 상입니다.',
        '애정운이 순탄합니다. 부처궁이 안정되어 관계에 큰 굴곡이 없고 따뜻한 인연이 곁에 머뭅니다.',
        '애정은 표현할 때 꽃핍니다. 마음을 조금 더 드러내면 인연이 빠르게 다가오는 상입니다.',
        '이성적인 매력이 강한 상입니다. 감정을 천천히 열어가는 만큼 한 번 맺은 인연이 매우 견고합니다.'] },
    career: { name: '직업·명예운', hanja: '官', icon: '🏛️',
      tiers: ['관록궁이 크게 열려 있습니다. 이마와 턱이 함께 힘을 실어 조직에서 빠르게 인정받고 높은 자리에 오르는 상입니다.',
        '직업운이 안정적입니다. 맡은 일을 성실히 해내는 신뢰가 쌓여 자연스럽게 지위가 올라갑니다.',
        '전문성을 깊게 파는 길이 유리합니다. 넓게 벌리기보다 한 분야의 장인이 될 때 명예가 따릅니다.',
        '스스로 길을 만드는 상입니다. 조직보다 자유로운 환경에서 재능이 살아나니 독립과 창업의 기운을 살피세요.'] },
    health: { name: '건강운', hanja: '壽', icon: '🌿',
      tiers: ['삼정이 고르고 좌우가 조화로워 생명력이 매우 강한 상입니다. 인중이 반듯해 장수의 기운이 뚜렷합니다.',
        '건강운이 안정적입니다. 큰 병치레 없이 꾸준한 활력을 유지하는 상이니 규칙적인 생활로 지키세요.',
        '기운의 흐름에 강약이 있습니다. 무리한 시기를 지나면 반드시 쉬어주는 리듬이 건강을 지킵니다.',
        '몸의 신호에 귀를 기울이는 것이 복입니다. 쉬는 것도 실력이라 여기면 말년까지 활력이 이어집니다.'] },
    social: { name: '대인관계운', hanja: '人', icon: '🤝',
      tiers: ['인복이 매우 두텁습니다. 입과 미간이 시원하게 열려 사람이 모이고, 귀인이 곳곳에서 손을 내미는 상입니다.',
        '대인관계가 원만합니다. 사람을 편안하게 하는 인상이라 갈등이 적고 오래가는 인연이 많습니다.',
        '깊고 좁은 관계에서 힘을 얻는 상입니다. 소수의 진짜 인연에 정성을 쏟을 때 인복이 살아납니다.',
        '신중하게 사람을 가리는 눈이 있습니다. 문을 조금만 더 열면 뜻밖의 귀인이 들어오는 상입니다.'] },
  };
  const out = {};
  for (const k of Object.keys(zs)) {
    // 보통 사람 77점, 표준편차 1 당 9점
    const score = Math.round(clamp(77 + 9 * zs[k], 55, 99));
    const tier = score >= 88 ? 0 : score >= 78 ? 1 : score >= 68 ? 2 : 3;
    const level = ['大吉', '吉', '中吉', '平'][tier];
    out[k] = { key: k, ...meta[k], score, level, text: meta[k].tiers[tier] };
  }
  const ranked = Object.values(out).sort((a, b) => b.score - a.score);
  const avg = Math.round(ranked.reduce((a, b) => a + b.score, 0) / ranked.length);
  return { fortunes: out, ranked, best: ranked[0], weakest: ranked[ranked.length - 1], avg };
}

// ── 총평 ─────────────────────────────────────────────────────
// 사람마다 달라지도록 ① 윤곽·오행 조합 ② 가장 두드러진 부위 두 곳 ③ 삼정 흐름
// ④ 가장 밝은 운과 조용한 운의 조합 ⑤ 등급·윤곽·오행별 마무리로 문장을 엮는다.

/** 받침 유무에 따라 조사를 고른다. josa('코', '이', '가') → '코가' */
export function josa(word, withBatchim, without) {
  const base = word.replace(/\s*\([^)]*\)$/, '');   // '불(火)' 처럼 괄호로 끝나면 괄호 앞 글자로 판단
  const ch = base.charCodeAt(base.length - 1);
  const jong = ch >= 0xAC00 && ch <= 0xD7A3 ? (ch - 0xAC00) % 28 : 0;
  const has = jong !== 0 && !(withBatchim === '으로' && jong === 8);   // 'ㄹ' 받침은 '으로' 가 아니라 '로' (물로, 불로)
  return word + (has ? withBatchim : without);
}
/** 표준정규분포 누적확률 (근사) */
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// 오행 상생(生)·상극(剋) 관계: 앞 기운이 뒤 기운을 살리거나 누른다
const ELEMENT = { wood: '나무(木)', fire: '불(火)', earth: '흙(土)', metal: '쇠(金)', water: '물(水)' };
const SAENG = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const GEUK = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
const SAENG_IMAGE = {
  wood: '나무가 불을 지피듯 재능이 열정으로 타오르는', fire: '불이 재를 남겨 흙을 기름지게 하듯 열정이 실속으로 쌓이는',
  earth: '흙 속에서 쇠가 나듯 꾸준함이 귀한 결실을 맺는', metal: '바위틈에서 샘이 솟듯 원칙 속에서 지혜가 흘러나오는',
  water: '물이 나무를 키우듯 지혜가 성장의 밑거름이 되는',
};
const GEUK_IMAGE = {
  wood: '나무뿌리가 흙을 붙잡듯', earth: '둑이 물길을 다스리듯', water: '물이 불길을 잠재우듯',
  fire: '불이 쇠를 녹여 다듬듯', metal: '도끼가 나무를 다듬듯',
};
// 기운마다의 덕목: 두 기운의 관계를 사람마다 다른 말로 풀어 준다
const VIRTUE = { wood: '성장', fire: '열정', earth: '신용', metal: '결단', water: '지혜' };
function elementRelation(pk, sk) {
  const P = ELEMENT[pk], S = ELEMENT[sk], vp = VIRTUE[pk], vs = VIRTUE[sk];
  if (SAENG[pk] === sk) return `${josa(P, '이', '가')} ${josa(S, '을', '를')} 살리는 상생의 조합으로, ${SAENG_IMAGE[pk]} 상입니다. 타고난 ${josa(vp, '이', '가')} ${josa(vs, '으로', '로')} 이어지니 가진 것을 나눌수록 복이 커집니다.`;
  if (SAENG[sk] === pk) return `${josa(S, '이', '가')} ${josa(P, '을', '를')} 받쳐 주는 상생의 조합으로, ${SAENG_IMAGE[sk]} 상입니다. ${josa(vs, '이', '가')} ${josa(vp, '을', '를')} 북돋아 주니 주변의 도움으로 힘을 얻습니다.`;
  if (GEUK[pk] === sk) return `${josa(P, '이', '가')} ${josa(S, '을', '를')} 누르는 상극의 조합으로, ${GEUK_IMAGE[pk]} 스스로를 다잡는 힘이 강합니다. ${josa(vp, '으로', '로')} ${josa(vs, '을', '를')} 다스리니 욕심에 휘둘려 큰일을 그르치지 않습니다.`;
  return `${josa(S, '이', '가')} ${josa(P, '을', '를')} 견제하는 상극의 조합으로, ${GEUK_IMAGE[sk]} 긴장 속에서 단련되며 크는 상입니다. ${josa(vs, '이', '가')} ${josa(vp, '을', '를')} 담금질하니 어려움을 겪을수록 단단해집니다.`;
}

// 부위별로 가장 두드러질 때의 이름·방향·짧은 풀이 [작은 쪽, 큰 쪽]
const PART_TRAITS = {
  forehead: { noun: '이마', adj: ['좁은', '넓은'], brief: ['머리보다 몸으로 부딪혀 길을 여는 실행가입니다', '지혜가 깊고 윗사람의 덕을 타고났습니다'] },
  brow: { noun: '눈썹', adj: ['곧게 뻗은', '높이 솟은'], brief: ['한번 정한 일은 끝까지 밀고 가는 뚝심이 있습니다', '감성과 표현력이 풍부해 예술적 재능이 엿보입니다'] },
  glabella: { noun: '미간', adj: ['좁은', '넓은'], brief: ['집중력과 분석력이 날카롭습니다', '낙천적이고 마음의 그릇이 큽니다'] },
  eyes: { noun: '눈', adj: ['작은', '큰'], brief: ['눈매가 깊고 예리해 쉽게 속지 않고 실속을 챙깁니다', '감수성이 풍부하고 사람을 끄는 매력이 있습니다'] },
  eyeTilt: { noun: '눈꼬리', adj: ['내려간', '올라간'], brief: ['온화하고 정이 많아 사람들이 쉽게 마음을 엽니다', '승부욕과 카리스마가 강해 목표를 향해 밀고 갑니다'] },
  eyelid: { noun: '눈두덩', adj: ['좁은', '넓은'], brief: ['판단이 빠르고 행동이 민첩합니다', '느긋하고 집안과 재산의 복이 두텁습니다'] },
  nose: { noun: '콧방울', adj: ['좁은', '넓은'], brief: ['돈을 계획적으로 다루고 낭비가 적습니다', '재물을 끌어당기는 힘이 강합니다'] },
  philtrum: { noun: '인중', adj: ['짧은', '긴'], brief: ['순발력이 좋고 젊은 기운이 오래갑니다', '인내심과 생명력이 강해 위기를 잘 견딥니다'] },
  mouth: { noun: '입', adj: ['작은', '큰'], brief: ['말을 아끼고 비밀을 잘 지켜 신뢰를 얻습니다', '대범하고 사교적이라 사람을 모읍니다'] },
  lips: { noun: '입술', adj: ['얇은', '도톰한'], brief: ['말이 논리적이고 판단이 냉철합니다', '정이 깊고 애정운이 따뜻합니다'] },
  jaw: { noun: '턱', adj: ['갸름한', '넓은'], brief: ['섬세하고 변화에 유연하게 적응합니다', '지도력이 있고 말년의 복이 큽니다'] },
  symmetry: { noun: '좌우 균형', adj: ['개성 있는', '정교한'], brief: ['다면적인 매력으로 상황마다 다른 얼굴을 보여 줍니다', '심신이 안정되어 판단이 한결같습니다'] },
};
function distinctiveParts(parts) {
  // 좌우 균형은 고개가 조금만 돌아가도 흔들리는 측정값이라 두드러짐을 덜 반영한다
  const weight = (p) => Math.abs(p.value) * (p.id === 'symmetry' ? 0.7 : 1);
  const ranked = parts.filter(p => PART_TRAITS[p.id] && Number.isFinite(p.value)).sort((a, b) => weight(b) - weight(a));
  const [a, b] = ranked;
  const phrase = (p) => {
    const t = PART_TRAITS[p.id], hi = p.value >= 0 ? 1 : 0;
    const pct = Math.max(1, Math.round((hi ? 1 - normCdf(p.value) : normCdf(p.value)) * 100));
    // 표본이 작아 정확한 백분율 대신 대략적인 빈도로 말한다
    const rarity = pct <= 5 ? '스무 명 중 한 명꼴로 드물게' : pct <= 10 ? '열 명 중 한 명꼴로' : pct <= 20 ? '다섯 명 중 한 명꼴로' : '눈에 띄게';
    return { t, hi, pct, rarity, noun: t.noun, adj: t.adj[hi], brief: t.brief[hi] };
  };
  const A = phrase(a), B = phrase(b);
  if (Math.abs(a.value) < 0.5) {
    return '어느 한 부위가 튀지 않고 오관이 고르게 어우러진 얼굴입니다. 두루 균형 잡힌 상은 한쪽으로 치우치지 않아 큰 굴곡 없이 오래 복을 누립니다.';
  }
  return `얼굴에서 가장 두드러진 곳은 ${A.noun}입니다. ${josa(A.noun, '이', '가')} ${A.rarity} ${A.adj} 편으로, ${A.brief}. `
    + `그다음으로 눈에 띄는 ${josa(B.noun, '은', '는')} ${B.adj} 편인데, ${B.brief}.`;
}

// 삼정: 가장 두터운 시기 → 가장 가벼운 시기 조합별 흐름
const SAMJEONG_FLOW = {
  'upper>lower': '젊어서 일찍 빛을 보는 선발형 흐름이니, 말년을 위한 준비를 남보다 일찍 시작하면 좋습니다.',
  'upper>middle': '초년의 배움과 말년의 여유 사이에 중년의 고비가 있으니, 한창때에 무리하지 않는 것이 관건입니다.',
  'middle>upper': '젊은 날의 수고가 중년에 크게 보상받는 흐름입니다. 초년의 고생은 밑거름이 됩니다.',
  'middle>lower': '중년에 정점을 찍는 흐름이니, 그때 거둔 것을 말년까지 지키는 지혜가 필요합니다.',
  'lower>upper': '늦게 필수록 크게 피는 대기만성의 흐름입니다. 조급해하지 않으면 말년이 가장 풍요롭습니다.',
  'lower>middle': '중년의 굴곡을 지나면 말년에 복이 모이는 흐름입니다. 사오십 대를 잘 넘기면 이후가 편안합니다.',
};
function samjeongFlow(samjeong) {
  const st = [...samjeong.stages].sort((a, b) => b.z - a.z);
  const hi = st[0], lo = st[2];
  const period = (x) => x.period.split(' · ')[0];
  if (samjeong.spread <= POP.samjeongSpread[0] * 0.7) {
    return {
      upper: '삼정이 고르게 균형을 이룬 가운데 이마 쪽이 조금 더 두텁습니다. 초년에 쌓은 배움이 평생의 밑천이 되어 크게 기울지 않는 삶을 삽니다.',
      middle: '삼정이 고르게 균형을 이룬 가운데 눈썹에서 코끝까지가 조금 더 두텁습니다. 한창때의 노력이 가장 크게 보답받고, 앞뒤로도 흐름이 순탄합니다.',
      lower: '삼정이 고르게 균형을 이룬 가운데 인중에서 턱까지가 조금 더 두텁습니다. 나이가 들수록 삶이 편안해지고 곁에 사람이 늘어납니다.',
    }[hi.key];
  }
  return `삼정 가운데 ${period(hi)}을 뜻하는 ${josa(hi.name, '이', '가')} 두텁고, ${period(lo)}을 뜻하는 ${josa(lo.name, '이', '가')} 상대적으로 가볍습니다. ${SAMJEONG_FLOW[`${hi.key}>${lo.key}`]}`;
}

// 다섯 운: 가장 밝은 운 × 가장 조용한 운 조합별 풀이
const FORTUNE_PAIR = {
  'wealth>love': '재물은 잘 모이나 정은 아끼는 편이니, 가까운 사람에게 쓰는 돈이 오히려 복을 부릅니다.',
  'wealth>career': '돈복이 이름보다 앞서니, 자리보다 실속을 좇는 길이 잘 맞습니다.',
  'wealth>health': '재물을 모으는 힘이 강한 만큼 몸을 돌보는 일은 뒤로 밀리기 쉬우니 건강에 먼저 투자하세요.',
  'wealth>social': '혼자 힘으로 재물을 일구는 상이라, 믿을 만한 사람 몇만 곁에 두어도 충분합니다.',
  'love>wealth': '정이 넘쳐 베풀기를 좋아하니, 지갑은 조금 더 단단히 여미세요.',
  'love>career': '사랑과 사람을 얻는 복이 커서, 일보다 관계에서 행복을 찾는 상입니다.',
  'love>health': '마음을 쏟는 만큼 기운이 빠지기 쉬우니, 남보다 스스로를 먼저 챙기세요.',
  'love>social': '넓은 인맥보다 깊은 한 사람과의 인연이 인생을 바꾸는 상입니다.',
  'career>wealth': '명예가 재물보다 먼저 오는 상이라, 이름을 얻고 나면 재물은 뒤따라옵니다.',
  'career>love': '일에 몰두하는 만큼 곁의 사람을 놓치기 쉬우니, 마음 표현을 아끼지 마세요.',
  'career>health': '책임감이 강해 무리하기 쉬우니, 쉬는 시간을 일정에 먼저 넣으세요.',
  'career>social': '실력으로 인정받는 상이라, 사교보다 성과가 사람을 모읍니다.',
  'health>wealth': '타고난 활력이 가장 큰 재산이니, 그 힘으로 꾸준히 벌면 재물은 따라옵니다.',
  'health>love': '스스로 서는 힘이 강해 기대는 일이 적으니, 가끔은 마음을 기대 보세요.',
  'health>career': '지치지 않는 체력이 있으니, 한 분야를 오래 밀고 가면 자리가 생깁니다.',
  'health>social': '혼자서도 단단한 사람이라, 먼저 손을 내밀면 귀인을 만납니다.',
  'social>wealth': '사람이 모이는 만큼 씀씀이도 커지기 쉬우니, 나가는 돈을 살피세요.',
  'social>love': '많은 사람과 두루 잘 지내지만, 한 사람에게 깊이 마음을 여는 데는 시간이 걸립니다.',
  'social>career': '사람을 얻는 재주가 뛰어나니, 혼자 하는 일보다 함께하는 일에서 이름이 납니다.',
  'social>health': '사람 만나는 즐거움에 쉴 틈이 줄기 쉬우니, 혼자만의 시간을 지키세요.',
};
function fortuneStory(fortune) {
  const b = fortune.best, w = fortune.weakest;
  if (b.score - w.score < 8) {
    return `다섯 운이 ${w.score}~${b.score}점으로 고르게 모여 어느 한쪽에 치우치지 않는 상입니다. 그중에서도 ${josa(b.name, '이', '가')} 가장 밝으니 이 방면에서 먼저 기회가 옵니다.`;
  }
  return `다섯 운 가운데 ${josa(b.name, '이', '가')} ${b.score}점으로 가장 밝고, ${josa(w.name, '이', '가')} ${w.score}점으로 가장 조용합니다. ${FORTUNE_PAIR[`${b.key}>${w.key}`]}`;
}

// 마무리: 주된 오행별 한마디
// 주된 오행 × 등급(상격·중상격·중격)별 마무리 한마디
const ELEMENT_MOTTO = {
  wood: ['이미 큰 그늘을 드리운 나무이니, 그 그늘에 사람을 쉬게 할 때 복이 배로 늘어납니다.',
    '곧게 자라는 나무처럼 서두르지 않으면 반드시 큰 그늘을 드리웁니다.',
    '겨울나무가 봄을 기다리듯, 지금 다지는 뿌리가 곧 싹을 틔웁니다.'],
  fire: ['활활 타오르는 불처럼 이미 주위를 밝히는 상이니, 불씨를 나누면 온기가 오래갑니다.',
    '불씨를 오래 지키는 사람이 결국 가장 밝게 빛납니다.',
    '작은 불씨도 바람을 만나면 들불이 되니, 기회가 오는 방향으로 몸을 돌리세요.'],
  earth: ['기름진 땅처럼 이미 많은 것을 품은 상이니, 거둔 것을 나누면 이듬해 더 큰 수확이 옵니다.',
    '넉넉한 땅이 모든 것을 기르듯, 베푼 만큼 돌아옵니다.',
    '묵은 땅도 갈아엎으면 옥토가 되니, 익숙한 방식을 한 번 바꿔 보세요.'],
  metal: ['잘 벼린 보검처럼 이미 날이 선 상이니, 칼집에 넣을 때를 아는 지혜가 복을 지킵니다.',
    '잘 벼린 쇠처럼 원칙은 지키되 날은 부드럽게 다듬으세요.',
    '거친 쇠도 두드릴수록 명검이 되니, 지금의 담금질을 두려워하지 마세요.'],
  water: ['큰 강처럼 이미 많은 것을 실어 나르는 상이니, 물길을 넓게 열어 두면 복이 모입니다.',
    '물이 바위를 돌아가듯 유연함이 가장 큰 힘이 됩니다.',
    '고인 물도 길을 만나면 흐르니, 작은 변화 하나가 운의 물꼬를 틉니다.'],
};

export function composeSummary(type, samjeong, fortune, shape, parts) {
  const t = type.primary, s = type.secondary, sh = shape.primary;
  const grade = gradeLabel(fortune.avg).replace(/ (.+)$/, '($1)');
  return [
    `얼굴 윤곽은 십자면상의 ${sh.name}으로 ${sh.shape}입니다. 기질은 ${t.name}에 ${s.name}이 섞였는데, ${elementRelation(t.key, s.key)}`,
    distinctiveParts(parts),
    samjeongFlow(samjeong),
    fortuneStory(fortune),
    `종합하면 ${grade}에 해당하며, ${sh.closing} ${ELEMENT_MOTTO[t.key][fortune.avg >= 81 ? 0 : fortune.avg >= 74 ? 1 : 2]}`,
  ];
}

// ── 통합 분석 진입점 ─────────────────────────────────────────
export function analyze(f) {
  const type = classifyFaceType(f);
  const samjeong = analyzeSamjeong(f);
  const parts = analyzeParts(f);
  const palaces = analyzePalaces(f);
  const fortune = analyzeFortunes(f, samjeong);
  const shape = classifySipja(f);
  const summary = composeSummary(type, samjeong, fortune, shape, parts);
  return { features: f, type, shape, samjeong, parts, palaces, fortune, summary };
}
