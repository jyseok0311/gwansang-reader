// ─────────────────────────────────────────────────────────────
//  얼굴 비율 측정 모듈 (MediaPipe 의존성 없음 → Node 보정 스크립트에서도 사용)
//  입력: 픽셀 좌표 랜드마크 배열 [{x, y, z}] (468개 이상)
//  1) 롤(기울기) → 2) 요(좌우 회전) → 3) 피치(상하 회전) 순으로 정면화한 뒤 비율을 계산한다.
// ─────────────────────────────────────────────────────────────

export const LM = {
  top: 10, chin: 152, cheekL: 234, cheekR: 454, jawL: 172, jawR: 397, foreheadL: 103, foreheadR: 332,
  glabella: 9, nasion: 168, noseTip: 1, subnasale: 2, alaL: 129, alaR: 358,
  lipTop: 0, lipBottom: 17, mouthL: 61, mouthR: 291,
  eyeL: { outer: 33, inner: 133, top: 159, bottom: 145 },
  eyeR: { outer: 263, inner: 362, top: 386, bottom: 374 },
  browL: { inner: 107, peak: 105, outer: 70, bottom: 52 },
  browR: { inner: 336, peak: 334, outer: 300, bottom: 282 },
  cheekPtL: 50, cheekPtR: 280,
};
export const SYM_PAIRS = [[33, 263], [133, 362], [61, 291], [234, 454], [129, 358], [70, 300], [107, 336], [172, 397], [159, 386], [145, 374], [50, 280], [103, 332]];

// 표준 얼굴(canonical_face_model)의 이마→턱 벡터가 y-z 평면에서 이루는 각도(라디안).
// calibrate.mjs 로 계산한 값. 실제 얼굴의 피치를 이 각도에 맞춰 정면화한다.
export const PITCH_REF = 0.01229;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 });
const deg = (r) => r * 180 / Math.PI;

function rotZ(p, c, a) { const cos = Math.cos(a), sin = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y; return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos, z: p.z }; }
function rotY(p, c, a) { const cos = Math.cos(a), sin = Math.sin(a), dx = p.x - c.x, dz = p.z - c.z; return { x: c.x + dx * cos + dz * sin, y: p.y, z: c.z - dx * sin + dz * cos }; }
function rotX(p, c, a) { const cos = Math.cos(a), sin = Math.sin(a), dy = p.y - c.y, dz = p.z - c.z; return { x: p.x, y: c.y + dy * cos - dz * sin, z: c.z + dy * sin + dz * cos }; }

export function pitchAngle(p) {
  const a = p[LM.top], b = p[LM.chin];
  return Math.atan2(b.z - a.z, b.y - a.y);
}

/** 롤·요·피치를 제거해 정면 얼굴 좌표로 변환. pose 정보도 함께 돌려준다. */
export function frontalize(raw, { pitchRef = PITCH_REF } = {}) {
  let p = raw.map(q => ({ x: q.x, y: q.y, z: q.z ?? 0 }));
  const c = mid(p[LM.cheekL], p[LM.cheekR]);
  const roll = Math.atan2(p[LM.eyeR.outer].y - p[LM.eyeL.outer].y, p[LM.eyeR.outer].x - p[LM.eyeL.outer].x);
  p = p.map(q => rotZ(q, c, -roll));
  const yaw = Math.atan2(p[LM.cheekR].z - p[LM.cheekL].z, p[LM.cheekR].x - p[LM.cheekL].x);
  p = p.map(q => rotY(q, c, yaw));
  let pitch = 0;
  if (pitchRef !== null) {
    pitch = pitchAngle(p) - pitchRef;
    p = p.map(q => rotX(q, c, -pitch));
  }
  return { pts: p, pose: { roll: deg(roll), yaw: deg(yaw), pitch: deg(pitch) } };
}

export function measure(rawPts, opts = {}) {
  const { pts: p, pose } = frontalize(rawPts, opts);
  const faceH = dist(p[LM.top], p[LM.chin]);
  const faceW = dist(p[LM.cheekL], p[LM.cheekR]);
  const upper = Math.abs(p[LM.glabella].y - p[LM.top].y);
  const middle = Math.abs(p[LM.subnasale].y - p[LM.glabella].y);
  const lower = Math.abs(p[LM.chin].y - p[LM.subnasale].y);
  const total = upper + middle + lower;

  const eyeW = (dist(p[LM.eyeL.outer], p[LM.eyeL.inner]) + dist(p[LM.eyeR.outer], p[LM.eyeR.inner])) / 2;
  const eyeH = (dist(p[LM.eyeL.top], p[LM.eyeL.bottom]) + dist(p[LM.eyeR.top], p[LM.eyeR.bottom])) / 2;
  const tilt = (eye) => deg(Math.atan2(p[eye.inner].y - p[eye.outer].y, Math.abs(p[eye.outer].x - p[eye.inner].x)));
  const arch = (brow) => ((p[brow.inner].y + p[brow.outer].y) / 2 - p[brow.peak].y) / eyeW;
  const browLen = (dist(p[LM.browL.inner], p[LM.browL.outer]) + dist(p[LM.browR.inner], p[LM.browR.outer])) / 2;
  const browEyeGap = ((p[LM.eyeL.top].y - p[LM.browL.bottom].y) + (p[LM.eyeR.top].y - p[LM.browR.bottom].y)) / 2;
  const underEye = (dist(p[LM.eyeL.bottom], p[LM.cheekPtL]) + dist(p[LM.eyeR.bottom], p[LM.cheekPtR])) / 2;

  // 좌우 대칭: 정면화된 좌표에서 중심선 기준 좌우 편차 + 상하 편차
  const midX = [LM.top, LM.glabella, LM.nasion, LM.noseTip, LM.subnasale, LM.chin].reduce((s, i) => s + p[i].x, 0) / 6;
  let asym = 0;
  for (const [a, b] of SYM_PAIRS) asym += Math.abs((midX - p[a].x) - (p[b].x - midX)) + Math.abs(p[a].y - p[b].y);
  asym /= SYM_PAIRS.length * faceW;

  return {
    faceRatio: faceH / faceW,
    upperRatio: upper / total, middleRatio: middle / total, lowerRatio: lower / total,
    foreheadWidthRatio: dist(p[LM.foreheadL], p[LM.foreheadR]) / faceW,
    jawRatio: dist(p[LM.jawL], p[LM.jawR]) / faceW,
    chinLen: dist(p[LM.lipBottom], p[LM.chin]) / faceH,
    eyeSize: eyeW / faceW,
    eyeOpen: eyeH / eyeW,
    eyeTilt: (tilt(LM.eyeL) + tilt(LM.eyeR)) / 2,
    interEye: dist(p[LM.eyeL.inner], p[LM.eyeR.inner]) / eyeW,
    glabella: dist(p[LM.browL.inner], p[LM.browR.inner]) / eyeW,
    browArch: (arch(LM.browL) + arch(LM.browR)) / 2,
    browLen: browLen / eyeW,
    browEyeGap: browEyeGap / eyeW,
    underEye: underEye / eyeW,
    noseLen: dist(p[LM.nasion], p[LM.subnasale]) / faceH,
    noseWidth: dist(p[LM.alaL], p[LM.alaR]) / faceW,
    philtrum: dist(p[LM.subnasale], p[LM.lipTop]) / faceH,
    mouthWidth: dist(p[LM.mouthL], p[LM.mouthR]) / faceW,
    lipThick: dist(p[LM.lipTop], p[LM.lipBottom]) / faceH,
    asym,
    symmetry: clamp(1 - asym * 5, 0, 1),
    pose,
    _pts: p,
  };
}
