// ─────────────────────────────────────────────────────────────
//  동물상 (오락용): 얼굴 측정값(눈꼬리·눈 크기·얼굴 길이·턱선·이목구비 크기 등)을 표준점수로 바꾸어
//  여덟 동물의 대표 얼굴 특징과 얼마나 닮았는지 잰다. 관상 결과의 측정값을 그대로 쓰므로 사진을 다시 찍지 않는다.
//  - 균형 보정: 표본(가상 인물 얼굴)에서 어느 동물로 쏠리지 않도록 동물별 점수를 표본 평균·표준편차로 표준화한다 (tools/calibrate-animal.mjs).
// ─────────────────────────────────────────────────────────────
import { POP, Z } from './physiognomy.js';

// 특징별 방향 설명 (z 가 높을 때 / 낮을 때)
const PHRASE = {
  eyeTilt: ['눈꼬리가 위로 올라간', '눈꼬리가 아래로 내려간'], eyeOpen: ['눈이 동그랗고 큰', '눈이 가늘고 긴'], eyeSize: ['눈이 얼굴에 비해 큰', '눈이 작은 편인'],
  faceRatio: ['얼굴이 갸름하고 긴', '얼굴이 둥글고 짧은'], jawRatio: ['턱선이 넓은', '턱선이 좁은'], jawAngle: ['턱선이 둥근', '턱선이 각진'],
  chinWidth: ['턱 끝이 넓은', '턱 끝이 뾰족한'], interEye: ['두 눈 사이가 먼', '두 눈 사이가 가까운'], browEyeGap: ['눈썹과 눈 사이가 여유 있는', '눈썹이 눈에 바짝 붙은'],
  noseLen: ['코가 긴', '코가 짧은'], noseWidth: ['콧방울이 넓은', '콧방울이 좁은'], philtrum: ['인중이 긴', '인중이 짧은'],
  mouthWidth: ['입이 큰', '입이 작은'], lipThick: ['입술이 도톰한', '입술이 얇은'],
};

export const ANIMALS = {
  dog: { key: 'dog', emoji: '🐶', name: '강아지상', kw: '다정함 · 순수함', norm: [-1.365, 0.903], bias: -0.106,
    proto: { eyeTilt: -0.9, eyeOpen: 0.8, eyeSize: 0.4, faceRatio: -0.4, jawAngle: 0.5, chinWidth: 0.3, lipThick: 0.2, jawRatio: -0.2 },
    desc: '눈꼬리가 부드럽게 내려오고 눈이 동그랗게 열려 있어 첫인상이 순하고 친근합니다. 처음 만나는 사람도 경계심을 풀게 만드는 따뜻한 얼굴입니다.',
    charm: '웃을 때 더 친근해지고 신뢰감을 줍니다.', trait: '사람을 좋아하고 의리가 있으며 애정 표현이 솔직합니다.',
    style: '밝은 파스텔 톤, 부드러운 니트, 둥근 안경', love: '한결같이 곁을 지키는 헌신적인 연애를 합니다.', caution: '거절을 못 해 손해를 보기 쉬우니 "아니요"도 연습하세요.', match: ['cat', 'bear'] },
  cat: { key: 'cat', emoji: '🐱', name: '고양이상', kw: '도도함 · 세련됨', norm: [-0.559, 1.003], bias: 0.108,
    proto: { eyeTilt: 0.9, eyeOpen: -0.3, eyeSize: 0.2, chinWidth: -0.6, jawAngle: -0.2, noseLen: -0.2, mouthWidth: -0.3, interEye: 0.2 },
    desc: '눈꼬리가 살짝 올라가고 턱 끝이 갸름해 도도하고 세련된 분위기가 납니다. 말없이 있어도 눈빛만으로 시선을 끄는 얼굴입니다.',
    charm: '알 듯 말 듯한 분위기와 또렷한 눈매가 매력입니다.', trait: '독립적이고 자기 취향이 뚜렷하며 가까워지면 의외로 다정합니다.',
    style: '깔끔한 모노톤, 포인트 액세서리, 선이 살아 있는 실루엣', love: '마음을 열기까지는 오래 걸리지만 한번 열면 깊이 사랑합니다.', caution: '속마음을 숨기다 오해를 사기 쉬우니 표현을 한 번 더 하세요.', match: ['dog', 'deer'] },
  fox: { key: 'fox', emoji: '🦊', name: '여우상', kw: '영리함 · 센스', norm: [-0.841, 1.500], bias: 0.11,
    proto: { eyeTilt: 0.8, faceRatio: 0.7, chinWidth: -0.8, jawRatio: -0.4, eyeOpen: -0.5, lipThick: -0.4, noseLen: 0.2 },
    desc: '갸름한 얼굴에 올라간 눈매, 뾰족한 턱선이 어우러져 영리하고 매력적인 인상을 줍니다. 한 번 보면 잊히지 않는 선명한 이미지입니다.',
    charm: '눈치가 빠르고 말 한마디가 센스 있어 분위기를 사로잡습니다.', trait: '관찰력이 뛰어나고 상황 판단이 빠르며 사람의 마음을 잘 읽습니다.',
    style: '선명한 컬러 포인트, 샤프한 재킷, 깔끔한 헤어', love: '밀고 당기기에 능하지만 진심일 땐 누구보다 성실합니다.', caution: '영리함이 계산적으로 보이지 않게 솔직함을 곁들이세요.', match: ['bear', 'dog'] },
  rabbit: { key: 'rabbit', emoji: '🐰', name: '토끼상', kw: '청순 · 발랄', norm: [-1.013, 1.499], bias: 0.038,
    proto: { eyeSize: 0.5, eyeOpen: 0.6, noseWidth: -0.6, noseLen: -0.6, philtrum: -0.5, mouthWidth: -0.5, faceRatio: -0.2, chinWidth: -0.2 },
    desc: '큰 눈과 작은 코, 작은 입이 아담하게 모여 있어 청순하고 발랄한 인상입니다. 나이보다 어려 보이는 맑은 얼굴입니다.',
    charm: '표정이 풍부하고 웃음이 밝아 주변을 환하게 만듭니다.', trait: '호기심이 많고 감수성이 풍부하며 사람들과 금방 친해집니다.',
    style: '화사한 톤, 가벼운 소재, 리본·헤어핀 같은 소품', love: '표현이 솔직하고 애교가 있어 사랑받는 연애를 합니다.', caution: '여린 마음에 상처받기 쉬우니 스스로를 다독이는 시간을 가지세요.', match: ['bear', 'wolf'] },
  bear: { key: 'bear', emoji: '🐻', name: '곰상', kw: '듬직함 · 포근함', norm: [-1.231, 1.605], bias: -0.152,
    proto: { faceRatio: -0.8, jawRatio: 0.7, eyeSize: -0.5, eyeOpen: -0.3, noseWidth: 0.5, mouthWidth: 0.2, jawAngle: 0.3, interEye: 0.2 },
    desc: '둥글고 넓은 얼굴에 선이 부드러워 보기만 해도 마음이 놓이는 듬직한 인상입니다. 큰 덩치처럼 푸근하게 감싸 주는 분위기가 있습니다.',
    charm: '곁에 있으면 편안해지고 믿고 기대고 싶어집니다.', trait: '느긋하고 너그러우며 한번 정하면 묵묵히 끝까지 갑니다.',
    style: '자연스러운 어스 톤, 오버핏 셔츠, 편안한 실루엣', love: '표현은 서툴러도 행동으로 챙기는 든든한 연애를 합니다.', caution: '느긋함이 게으름으로 보이지 않도록 가끔은 먼저 움직여 보세요.', match: ['rabbit', 'fox'] },
  deer: { key: 'deer', emoji: '🦌', name: '사슴상', kw: '맑음 · 우아함', norm: [-0.850, 1.355], bias: 0.161,
    proto: { faceRatio: 0.5, eyeSize: 0.8, eyeOpen: 0.5, eyeTilt: -0.4, interEye: 0.4, noseWidth: -0.3, chinWidth: -0.3, jawRatio: -0.5 },
    desc: '크고 맑은 눈에 갸름한 얼굴선이 어우러져 우아하고 순한 인상입니다. 조용히 있어도 깨끗한 분위기가 납니다.',
    charm: '눈빛이 맑아 대화할 때 진심이 잘 전해집니다.', trait: '섬세하고 감성이 풍부하며 조용히 사람을 살피는 편입니다.',
    style: '은은한 아이보리·베이지, 부드러운 소재, 단정한 라인', love: '조심스럽게 다가가 깊고 순수하게 마음을 나눕니다.', caution: '예민해져 혼자 삭이기 쉬우니 힘들 땐 털어놓으세요.', match: ['cat', 'wolf'] },
  dino: { key: 'dino', emoji: '🦖', name: '공룡상', kw: '강인함 · 카리스마', norm: [-1.277, 1.402], bias: -0.106,
    proto: { jawRatio: 0.8, jawAngle: -0.8, eyeTilt: 0.3, mouthWidth: 0.7, eyeOpen: -0.5, browEyeGap: -0.6, lipThick: 0.2, faceRatio: 0.1 },
    desc: '각진 턱선과 또렷한 이목구비가 시원하게 자리 잡아 강인하고 카리스마 있는 인상입니다. 한눈에 존재감이 드러나는 얼굴입니다.',
    charm: '표정과 목소리에 힘이 있어 믿음직한 리더로 보입니다.', trait: '결단력이 있고 시원시원하며 맡은 일은 끝까지 해냅니다.',
    style: '선이 굵은 아우터, 짙은 색 포인트, 미니멀한 스타일', love: '직진하는 스타일로 마음에 들면 확실하게 표현합니다.', caution: '강한 인상이 거리감을 줄 수 있어 웃는 표정을 자주 보여 주세요.', match: ['rabbit', 'dog'] },
  wolf: { key: 'wolf', emoji: '🐺', name: '늑대상', kw: '날카로움 · 고독한 매력', norm: [-0.679, 0.810], bias: -0.052,
    proto: { eyeTilt: 0.6, faceRatio: 0.5, jawRatio: 0.5, jawAngle: -0.4, browEyeGap: -0.5, eyeOpen: -0.5, mouthWidth: 0.3, chinWidth: 0.1 },
    desc: '또렷한 눈썹과 올라간 눈매, 선명한 턱선이 날카롭고 시크한 분위기를 만듭니다. 말수가 적어도 깊이 있어 보이는 얼굴입니다.',
    charm: '눈빛에 집중력이 있고 신비로운 분위기가 매력입니다.', trait: '자기 세계가 뚜렷하고 의리가 깊으며 가까운 사람에게만 마음을 엽니다.',
    style: '다크 톤, 가죽·울 소재, 직선적인 실루엣', love: '신중하게 시작하지만 한번 마음을 주면 끝까지 지킵니다.', caution: '혼자 감당하려는 습관을 줄이고 도움을 청해 보세요.', match: ['deer', 'rabbit'] },
};
const KEYS = Object.keys(ANIMALS);

/** 동물별 점수 (보정 전). 표본 보정 스크립트도 이 함수를 쓴다. */
export function animalScores(f) {
  const z = {}; for (const k of Object.keys(PHRASE)) z[k] = Number.isFinite(f[k]) && POP[k] ? Z(f, k) : 0;
  const out = {};
  for (const a of KEYS) {
    let dot = 0, norm = 0;
    for (const [k, w] of Object.entries(ANIMALS[a].proto)) { dot += w * z[k]; norm += w * w; }
    out[a] = dot - norm / 2;   // 대표 얼굴과 가까울수록 높다 (거리 제곱의 음수와 같은 순서)
  }
  return out;
}

/** @param f 관상 분석의 측정값(features) */
export function classifyAnimal(f) {
  const raw = animalScores(f), z = {};
  for (const k of Object.keys(PHRASE)) z[k] = Number.isFinite(f[k]) && POP[k] ? Z(f, k) : 0;
  const s = Object.fromEntries(KEYS.map(a => [a, (raw[a] - ANIMALS[a].norm[0]) / ANIMALS[a].norm[1] + ANIMALS[a].bias]));   // 표본 평균·표준편차로 표준화한 뒤 쏠림 보정값을 더한다
  const ranked = Object.entries(s).sort((a, b) => b[1] - a[1]);
  const exp = ranked.map(([k, v]) => [k, Math.exp(v * 1.4)]), tot = exp.reduce((a, [, v]) => a + v, 0);
  const weights = exp.map(([k, v]) => ({ animal: ANIMALS[k], pct: Math.round(v / tot * 100) }));
  const primary = ANIMALS[ranked[0][0]], secondary = ANIMALS[ranked[1][0]];
  // 그 동물이 되게 한 가장 큰 특징 세 가지 (기여도 = 가중치 × 표준점수가 큰 순)
  const contrib = Object.entries(primary.proto).map(([k, w]) => [k, w * z[k]]).filter(([, c]) => c > 0.15).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const reasons = contrib.map(([k]) => PHRASE[k][z[k] > 0 ? 0 : 1]);
  const similar = Math.round(clamp01((s[primary.key] + 0.4) / 3) * 100);   // 대표 얼굴과의 닮은 정도(대략)
  return { primary, secondary, weights, reasons, similar, z };
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
