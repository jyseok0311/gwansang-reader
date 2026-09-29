// 원근 보정표 생성기
// MediaPipe 표준 얼굴 3D 모델(단위 cm)을 여러 촬영 거리에서 핀홀 카메라로 찍었다고 보고
// 거리별 측정값을 계산해 ../perspective.js 로 저장한다. 앱은 이 표로 셀카 원근 왜곡을 빼 준다.
// 실행: node tools/perspective-table.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { measure, LM, dist } from '../measure.js';

const V = readFileSync(new URL('./canonical_face_model.obj', import.meta.url), 'utf8')
  .split('\n').filter(l => l.startsWith('v ')).map(l => l.trim().split(/\s+/).slice(1).map(Number));
// 초점거리 1000px 카메라로 거리 D(cm, 카메라~모델 원점)에서 찍은 랜드마크. +z 가 카메라 쪽.
const project = (D) => V.map(([x, y, z]) => { const depth = D - z; return { x: 1000 * x / depth, y: -1000 * y / depth, z: -1000 * z / depth }; });

const KEYS = ['faceRatio', 'upperRatio', 'middleRatio', 'lowerRatio', 'foreheadWidthRatio', 'jawRatio', 'chinLen', 'eyeSize', 'eyeOpen', 'eyeTilt',
  'interEye', 'glabella', 'browArch', 'browLen', 'browEyeGap', 'underEye', 'noseLen', 'noseWidth', 'philtrum', 'mouthWidth', 'lipThick', 'jawAngle', 'chinWidth'];
const DISTANCES = [18, 20, 22, 24, 26, 28, 30, 33, 36, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120, 150, 200, 300];

const rows = DISTANCES.map(D => {
  const pts = project(D);
  const m = measure(pts, { pitchRef: null });
  // 얼굴 너비(234~454) ÷ 초점거리 : 실제 사진에서 거리를 거꾸로 추정할 때 쓴다
  const widthOverFocal = dist(pts[LM.cheekL], pts[LM.cheekR]) / 1000;
  return [D, +widthOverFocal.toFixed(6), ...KEYS.map(k => +m[k].toFixed(5))];
});

const out = `// 자동 생성 파일 — 직접 고치지 말고 node tools/perspective-table.mjs 로 다시 만드세요.
// 표준 얼굴 3D 모델을 거리 D(cm)에서 찍었을 때의 측정값. [D, 얼굴너비/초점거리, ...KEYS]
export const PERSPECTIVE_KEYS = ${JSON.stringify(KEYS)};
export const PERSPECTIVE_TABLE = [
${rows.map(r => '  ' + JSON.stringify(r)).join(',\n')},
];
`;
writeFileSync(new URL('../perspective.js', import.meta.url), out);
console.log(`perspective.js 생성: 거리 ${DISTANCES.length}단계, 측정값 ${KEYS.length}개`);
