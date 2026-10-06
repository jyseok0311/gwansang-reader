// 손금 분석 실행기: 가능하면 Web Worker 에서, 안 되면(오래된 브라우저·워커 오류·시간 초과) 기존처럼 화면 스레드에서 돌린다.
import { analyzePalm } from './palm.js';

const TIMEOUT_MS = 30000;

/**
 * @param img {data: Uint8ClampedArray, width, height}  주의: 워커로 넘기면 data 는 빈 배열이 된다(소유권 이전). 필요하면 미리 복사해 둔다.
 * @param lm  21개 관절점 [{x, y}] (픽셀)
 * @param world 21개 3D 관절점(미터, 선택) — 있으면 손가락 길이를 기울기·굽힘에 영향받지 않게 잰다
 * @returns Promise<analyzePalm 결과>
 */
export function analyzePalmOffThread(img, lm, world = null) {
  if (typeof Worker === 'undefined') return Promise.resolve(analyzePalm(img, lm, world));
  const copy = { data: img.data.slice(), width: img.width, height: img.height };   // 워커가 실패해도 화면 스레드에서 다시 돌릴 수 있게 복사본을 남긴다
  return new Promise((resolve) => {
    let worker, timer;
    const fallback = () => { cleanup(); resolve(analyzePalm(copy, lm, world)); };
    const cleanup = () => { clearTimeout(timer); try { worker?.terminate(); } catch { /* 무시 */ } };
    try {
      worker = new Worker(new URL('./palm-worker.js', import.meta.url), { type: 'module' });
    } catch { fallback(); return; }
    timer = setTimeout(fallback, TIMEOUT_MS);
    worker.onmessage = (e) => { if (e.data?.ok) { cleanup(); resolve(e.data.out); } else fallback(); };
    worker.onerror = fallback;
    worker.onmessageerror = fallback;
    const buf = img.data.buffer;
    worker.postMessage({ data: buf, width: img.width, height: img.height, lm, world }, [buf]);
  });
}
