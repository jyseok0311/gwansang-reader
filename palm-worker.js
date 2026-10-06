// 손금 분석을 화면과 따로 도는 작업자(Web Worker)에서 실행한다.
// 분석은 휴대폰에서 1~2초 걸리는데, 화면 담당 스레드에서 돌리면 그동안 안내 문구와 터치가 모두 멈춘다.
import { analyzePalm } from './palm.js';

self.onmessage = (e) => {
  const { data, width, height, lm } = e.data;
  try {
    const out = analyzePalm({ data: new Uint8ClampedArray(data), width, height }, lm);
    self.postMessage({ ok: true, out });
  } catch (err) {
    self.postMessage({ ok: false, message: String((err && err.message) || err) });
  }
};
