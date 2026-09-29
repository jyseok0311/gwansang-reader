// MediaPipe 표준 얼굴 메시(canonical_face_model.obj)로 측정 기준값을 계산한다.
// 실행: node tools/calibrate.mjs
import { readFileSync } from 'node:fs';
import { measure, pitchAngle, frontalize } from '../measure.js';

const obj = readFileSync(new URL('./canonical_face_model.obj', import.meta.url), 'utf8');
// OBJ: y 위쪽, z 관찰자 쪽(+). 이미지 좌표계(y 아래, z 카메라 쪽이 -)로 변환.
const pts = obj.split('\n').filter(l => l.startsWith('v ')).map(l => {
  const [, x, y, z] = l.trim().split(/\s+/).map(Number);
  return { x: x * 50, y: -y * 50, z: -z * 50 };
});
console.log('vertices:', pts.length);
const { pts: fr } = frontalize(pts, { pitchRef: null });
console.log('PITCH_REF (rad):', pitchAngle(fr).toFixed(5));
const m = measure(pts, { pitchRef: null });
delete m._pts;
for (const [k, v] of Object.entries(m)) console.log(k.padEnd(20), typeof v === 'number' ? v.toFixed(4) : JSON.stringify(v));
