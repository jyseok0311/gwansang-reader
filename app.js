// ─────────────────────────────────────────────────────────────
//  관상 판독기 — 메인 앱
//  카메라 → MediaPipe Face Landmarker(478점) → 자세 보정·비율 측정 → 관상 해석
//  PC와 휴대폰(안드로이드·아이폰) 모두 지원
// ─────────────────────────────────────────────────────────────
import { analyze, clamp, gradeLabel } from './physiognomy.js';
import { measure, LM, dist, mid, estimateDistance, correctPerspective } from './measure.js';
import { computeSaju, interpretSaju } from './saju.js';
import { analyzePalm, isPalmFacing } from './palm.js';
import { interpretPalm } from './palm-reading.js';
import { fuse } from './fusion.js';
import * as V from './views-combo.js';
import { wrapLines, roundRect } from './util.js';

// ── 엔진 경로: 로컬(vendor/) 우선, 없으면 CDN ────────────────
const MP_VERSION = '0.10.14';
const abs = (p) => new URL(p, location.href).href;
const ENGINE_SOURCES = [
  { name: 'local', bundle: abs('./vendor/tasks-vision/vision_bundle.mjs'), wasm: abs('./vendor/tasks-vision/wasm'), model: abs('./vendor/face_landmarker.task'), handModel: abs('./vendor/hand_landmarker.task') },
  { name: 'cdn', bundle: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`,
    wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
    model: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    handModel: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
];

// ── 환경 판별 ────────────────────────────────────────────────
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const CAN_LIVE = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
const DETECT_INTERVAL = IS_MOBILE ? 66 : 33;   // 휴대폰은 초당 15회, PC는 30회 검출
const AUTO_HOLD_MS = 1200;                     // 조건을 이만큼 유지하면 자동 촬영
const FEATURE_WINDOW_MS = 1500;                // 중앙값에 쓰는 최근 프레임 범위
// 원근 보정용 카메라 대각선 화각(도) 가정: 휴대폰 전면 카메라 동영상 약 80도, 노트북 웹캠 약 72도
const CAMERA_DIAG_FOV = IS_MOBILE ? 80 : 72;

// ── DOM ──────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const views = {
  intro: $('#view-intro'), camera: $('#view-camera'), analyzing: $('#view-analyzing'), result: $('#view-result'),
  hub: $('#view-hub'), sajuform: $('#view-sajuform'), saju: $('#view-saju'), palm: $('#view-palm'), combo: $('#view-combo'),
};
const BAR_VIEWS = new Set(['result', 'saju', 'palm', 'combo']);   // 하단 고정 버튼 막대가 있는 화면
const video = $('#video');
const overlay = $('#overlay');
const camStage = $('#cam-stage');
const camLayer = $('#cam-layer');
const ovalEl = $('#oval');
const camControls = $('.cam-controls');
const snapshot = $('#snapshot');
const statusEl = $('#status');
const btnCapture = $('#btn-capture');
const btnSwitch = $('#btn-switch');
const autoToggle = $('#auto-toggle');
const progressRing = $('#shutter-progress');
const fileInput = $('#file-input');
const captureInput = $('#capture-input');
const palmInput = $('#palm-input');
const palmCaptureInput = $('#palm-capture-input');
const toast = $('#toast');

// ── 상태 ─────────────────────────────────────────────────────
const engine = { mod: null, vision: null, source: null, delegate: null, landmarker: null, mode: 'VIDEO', promise: null, hand: null, handMode: 'VIDEO', handPromise: null, handDelegate: null };
// 종합 분석: 관상(face)·손금(palm)·사주(saju) 결과와 합친 결과(fused)
const combo = { face: null, palm: null, saju: null, fused: null };
let captureKind = 'face';   // 지금 카메라로 찍는 것: 'face' | 'palm'
let flow = 'single';        // 'single': 관상만 보기 / 'combo': 종합 분석 허브에서 시작
let palmStable = { x: 0, y: 0, t: 0 };
let stream = null;
let facing = 'user';
let rafId = null;
let camToken = 0;
let capturing = false;
let lastVideoTime = -1;
let lastDetect = 0;
let goodSince = 0;
let featureBuf = [];
let lastResult = null;
let current = 'intro';
let resumeCamOnVisible = false;
let wakeLock = null;
let cardPromise = null;
let liveInfo = null;   // 마지막 실시간 판정값 (디버그용)
// 카메라 화면 배치: 영상 좌표 → 화면 좌표 변환값과 타원 위치 (layoutCamera 가 갱신)
const geo = { s: 1, left: 0, top: 0, vw: 0, vh: 0, sw: 0, sh: 0, mirrored: false, oval: null };

// ── 유틸 ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function showToast(msg, ms = 2800) {
  toast.textContent = msg;
  toast.classList.add('on');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('on'), ms);
}
function setEngineStatus(text, cls = '') {
  const el = $('#engine-status');
  el.textContent = text;
  el.className = 'engine-status ' + cls;
}

// 화면 전환 + 뒤로 가기 버튼 지원
function show(name, { history: mode = 'push' } = {}) {
  const prev = current;
  current = name;
  document.body.dataset.view = name;
  document.body.dataset.bar = BAR_VIEWS.has(name) ? '1' : '';
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
  document.body.classList.toggle('cam-open', name === 'camera');
  if (mode === 'push' && prev !== name) history.pushState({ view: name }, '');
  else if (mode === 'replace') history.replaceState({ view: name }, '');
  window.scrollTo({ top: 0, behavior: BAR_VIEWS.has(name) ? 'auto' : 'smooth' });
  syncBackLinks();
}
history.replaceState({ view: 'intro' }, '');
window.addEventListener('popstate', (e) => {
  let v = e.state?.view || 'intro';
  if (v === 'analyzing' || (v === 'result' && !lastResult)) v = 'intro';
  if ((v === 'palm' && !combo.palm) || (v === 'saju' && !combo.saju) || (v === 'combo' && !combo.fused)) v = 'hub';
  if (current === 'camera' && v !== 'camera') stopCamera();
  if (v === 'hub') renderHub();
  show(v, { history: 'none' });
  if (v === 'camera') openCamera();
});

// ── 엔진 로드 ────────────────────────────────────────────────
function loadEngine() {
  if (!engine.promise) engine.promise = createEngine().catch(e => { engine.promise = null; throw e; });
  return engine.promise;
}
async function createEngine() {
  let cached = null;
  try { cached = window.caches ? await caches.match(ENGINE_SOURCES[0].model) : null; } catch { /* 무시 */ }
  setEngineStatus(cached ? '판독 엔진 준비 중…' : '판독 엔진 내려받는 중… (처음 한 번만, 약 13MB)');
  let lastErr;
  for (const src of ENGINE_SOURCES) {
    try {
      const mod = await import(src.bundle);
      const vision = await mod.FilesetResolver.forVisionTasks(src.wasm);
      Object.assign(engine, { mod, vision, source: src });
      await buildLandmarker('GPU');
      setEngineStatus(`판독 엔진 준비 완료${engine.delegate === 'CPU' ? ' (CPU 모드)' : ''}`, 'ready');
      return engine.landmarker;
    } catch (e) {
      console.warn(`엔진 로드 실패 (${src.name})`, e);
      lastErr = e;
    }
  }
  setEngineStatus('판독 엔진을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.', 'error');
  throw lastErr;
}
async function buildLandmarker(delegate) {
  const { mod, vision, source } = engine;
  const opts = (d) => ({
    baseOptions: { modelAssetPath: source.model, delegate: d },
    runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
  });
  try { engine.landmarker?.close(); } catch { /* 무시 */ }
  engine.landmarker = null;
  try {
    engine.landmarker = await mod.FaceLandmarker.createFromOptions(vision, opts(delegate));
    engine.delegate = delegate;
  } catch (e) {
    if (delegate !== 'GPU') throw e;
    console.warn('GPU 가속 실패, CPU로 전환', e);
    engine.landmarker = await mod.FaceLandmarker.createFromOptions(vision, opts('CPU'));
    engine.delegate = 'CPU';
  }
  engine.mode = 'VIDEO';
}
async function setMode(mode) {
  if (engine.mode === mode) return;
  await engine.landmarker.setOptions({ runningMode: mode });
  engine.mode = mode;
}

// 손 인식 모델은 손금을 볼 때 처음 불러온다 (약 8MB)
function loadHand() {
  if (!engine.handPromise) engine.handPromise = (async () => {
    await loadEngine();
    return buildHand('GPU');
  })().catch(e => { engine.handPromise = null; throw e; });
  return engine.handPromise;
}
async function buildHand(delegate) {
  const { mod, vision, source } = engine;
  const opts = (d) => ({
    baseOptions: { modelAssetPath: source.handModel, delegate: d }, runningMode: 'VIDEO', numHands: 1,
    minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4,
  });
  try { engine.hand?.close(); } catch { /* 무시 */ }
  try { engine.hand = await mod.HandLandmarker.createFromOptions(vision, opts(delegate)); engine.handDelegate = delegate; }
  catch (e) {
    if (delegate !== 'GPU') throw e;
    console.warn('손 인식 GPU 실패, CPU로 전환', e);
    engine.hand = await mod.HandLandmarker.createFromOptions(vision, opts('CPU')); engine.handDelegate = 'CPU';
  }
  engine.handMode = 'VIDEO';
  return engine.hand;
}
async function setHandMode(mode) {
  if (engine.handMode === mode) return;
  await engine.hand.setOptions({ runningMode: mode });
  engine.handMode = mode;
}

// ── 카메라 ───────────────────────────────────────────────────
async function startStream() {
  stopStream();
  const token = camToken;
  // 휴대폰 브라우저는 해상도 값을 센서(가로) 기준으로 해석하고 세로 화면에서는 알아서 돌려준다.
  // 세로 값(720x1280)을 요청하면 기기에 따라 가로 영상이 와서 화면이 한쪽으로 크게 잘리므로 항상 가로 기준으로 요청한다.
  const s = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
  });
  if (token !== camToken) { s.getTracks().forEach(t => t.stop()); throw Object.assign(new Error('취소됨'), { name: 'AbortError' }); }
  stream = s;
  video.srcObject = s;
  if (video.readyState < 1) await new Promise(res => video.addEventListener('loadedmetadata', res, { once: true }));
  await video.play().catch(() => {});
  const settingsFacing = s.getVideoTracks()[0]?.getSettings?.().facingMode;
  // 노트북 웹캠은 방향 정보를 안 주는 경우가 많다. 컴퓨터에서는 거울처럼 좌우반전해서 보여 주는 것이 자연스럽다.
  const mirrored = settingsFacing ? settingsFacing === 'user' : (!IS_MOBILE || facing === 'user');
  camLayer.classList.toggle('mirror', mirrored);
  video.dataset.mirrored = mirrored ? '1' : '';
  geo.mirrored = mirrored;
  syncOverlaySize();
  layoutCamera();
  updateSwitchButton();
}
function stopStream() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
}
function stopCamera() {
  camToken++;
  keepAwake(false);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  stopStream();
  resetHold();
}
async function updateSwitchButton() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    btnSwitch.classList.toggle('hidden', devices.filter(d => d.kind === 'videoinput').length < 2);
  } catch { /* 무시 */ }
}
function syncOverlaySize() {
  if (video.videoWidth && (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight)) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
  }
}

// 영상을 화면에 꽉 차게(cover) 놓되, 비율 차이가 커서 절반 넘게 잘리면 전체가 보이게(contain) 놓는다.
// 영상과 윤곽선 캔버스가 한 레이어에 있으므로 둘은 항상 정확히 겹친다.
function layoutCamera() {
  const vw = video.videoWidth, vh = video.videoHeight;
  const sw = camStage.clientWidth, sh = camStage.clientHeight;
  if (!vw || !vh || !sw || !sh) return;
  const cover = Math.max(sw / vw, sh / vh);
  const visibleFrac = Math.min(sw / (vw * cover), sh / (vh * cover));
  const s = visibleFrac < 0.55 ? Math.min(sw / vw, sh / vh) : cover;
  const w = vw * s, h = vh * s, left = (sw - w) / 2, top = (sh - h) / 2;
  Object.assign(camLayer.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });

  // 실제로 영상이 보이는 영역 안에서, 상단 안내 문구와 하단 버튼에 가리지 않는 곳에 타원을 둔다
  const visL = Math.max(0, left), visR = Math.min(sw, left + w);
  let availT = Math.max(0, top), availB = Math.min(sh, top + h);
  const stageR = camStage.getBoundingClientRect();
  const statusR = statusEl.getBoundingClientRect();
  if (statusR.height && statusR.top - stageR.top < sh / 3) availT = Math.max(availT, statusR.bottom - stageR.top + 8);
  const ctrlR = camControls.getBoundingClientRect();
  const ctrlOverlaps = ctrlR.top < stageR.bottom - 1 && ctrlR.bottom > stageR.top && ctrlR.left < stageR.right - 1 && ctrlR.right > stageR.left + 1;
  if (ctrlOverlaps) availB = Math.min(availB, ctrlR.top - stageR.top - 8);
  let oh = (availB - availT) * 0.84, ow = oh * 0.75;
  if (ow > (visR - visL) * 0.84) { ow = (visR - visL) * 0.84; oh = ow / 0.75; }
  const cx = (visL + visR) / 2, cy = (availT + availB) / 2;
  Object.assign(ovalEl.style, { width: `${ow}px`, height: `${oh}px`, left: `${cx - ow / 2}px`, top: `${cy - oh / 2}px`, transform: 'none', aspectRatio: 'auto' });
  Object.assign(geo, { s, left, top, vw, vh, sw, sh, oval: { cx, cy, w: ow, h: oh } });
}
function relayoutCamera() { if (current === 'camera' && stream) layoutCamera(); }
/** 영상 좌표 → 카메라 화면(스테이지) 좌표. 좌우반전을 반영한다. */
function toDisplay(p) {
  const x = geo.mirrored ? geo.vw - p.x : p.x;
  return { x: geo.left + x * geo.s, y: geo.top + p.y * geo.s };
}

// 촬영 화면에서 화면이 꺼지지 않게 한다 (지원 브라우저만)
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && !document.hidden) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      const l = wakeLock; wakeLock = null; await l.release();
    }
  } catch { /* 무시 */ }
}

/** 관상(face) 또는 손금(palm) 촬영을 시작한다 */
function startCapture(kind, { replace = false } = {}) {
  captureKind = kind;
  facing = kind === 'palm' ? 'environment' : 'user';   // 손바닥은 화질이 좋은 뒷면 카메라가 기본
  if (!CAN_LIVE) { (kind === 'palm' ? palmCaptureInput : captureInput).click(); return; }
  show('camera', { history: replace ? 'replace' : 'push' });
  openCamera();
}

async function openCamera() {
  const palm = captureKind === 'palm';
  if (!CAN_LIVE) { (palm ? palmCaptureInput : captureInput).click(); return; }
  const token = ++camToken;
  views.camera.classList.toggle('palm', palm);
  $('#cam-kind').textContent = palm ? '손금 촬영' : '관상 촬영';
  btnCapture.disabled = true;
  resetHold();
  const ready = palm ? engine.hand : engine.landmarker;
  setLive('warn', ready ? '카메라를 준비하는 중…' : '판독 엔진을 불러오는 중…');
  try {
    await Promise.all([startStream(), palm ? loadHand() : loadEngine()]);
    if (token !== camToken || current !== 'camera') { stopCamera(); return; }
    if (palm) await setHandMode('VIDEO'); else await setMode('VIDEO');
    setLive('', palm ? '손가락을 펴고 손바닥을 틀 안에 맞춰 주세요.' : '타원 안에 얼굴을 맞춰 주세요.');
    layoutCamera();
    keepAwake(true);
    lastVideoTime = -1;
    if (!rafId) rafId = requestAnimationFrame(liveLoop);
  } catch (e) {
    if (e.name === 'AbortError' || token !== camToken) return;
    console.error(e);
    const msg = {
      NotAllowedError: '카메라 권한이 거부되었습니다. 브라우저 주소창의 설정에서 카메라를 허용하거나 「사진 업로드」를 이용해 주세요.',
      NotFoundError: '카메라를 찾을 수 없습니다. 「사진 업로드」를 이용해 주세요.',
      NotReadableError: '다른 앱이 카메라를 사용 중입니다. 종료 후 다시 시도해 주세요.',
      OverconstrainedError: '이 카메라 설정을 지원하지 않습니다. 카메라 전환을 시도해 주세요.',
    }[e.name] || ('카메라를 열 수 없습니다: ' + (e.message || e));
    showToast(msg, 5000);
    stopCamera();
    if (flow === 'combo') backToHub(); else show('intro', { history: 'replace' });
  }
}

// ── 실시간 미리보기 루프 ─────────────────────────────────────
function liveLoop(now) {
  rafId = requestAnimationFrame(liveLoop);
  if (captureKind === 'palm') { palmLoop(now); return; }
  const lmk = engine.landmarker;
  if (!stream || !lmk || capturing || engine.mode !== 'VIDEO') return;
  if (video.readyState < 2 || now - lastDetect < DETECT_INTERVAL || video.currentTime === lastVideoTime) return;
  lastDetect = now;
  lastVideoTime = video.currentTime;
  syncOverlaySize();
  if (video.videoWidth !== geo.vw || video.videoHeight !== geo.vh || camStage.clientWidth !== geo.sw || camStage.clientHeight !== geo.sh) layoutCamera();

  let res;
  try { res = lmk.detectForVideo(video, now); } catch (e) { return; }
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const lm = res?.faceLandmarks?.[0];
  if (!lm) {
    setLive('', '얼굴이 보이지 않습니다. 타원 안에 얼굴을 맞춰 주세요.');
    resetHold();
    return;
  }
  const pts = toPixels(lm, overlay.width, overlay.height);
  const feat = measure(pts);   // 3D 자세 보정 포함 (고개 각도 판정에도 사용)
  const check = frontalCheck(pts, feat.pose, res.faceBlendshapes?.[0]?.categories);
  drawMesh(ctx, pts, check.ok);
  setLive(check.ok ? 'ok' : 'warn', check.msg);
  btnCapture.disabled = !check.ok;

  if (!check.ok) { resetHold(); return; }
  featureBuf.push({ t: now, f: feat });
  featureBuf = featureBuf.filter(b => now - b.t <= FEATURE_WINDOW_MS);
  if (!goodSince) goodSince = now;
  if (autoToggle.checked) {
    const p = clamp((now - goodSince) / AUTO_HOLD_MS, 0, 1);
    setProgress(p);
    if (p >= 1) captureFromVideo();
  }
}
function resetHold() { goodSince = 0; featureBuf = []; setProgress(0); }
function setProgress(p) { progressRing.style.strokeDashoffset = String(283 * (1 - p)); }
function setLive(level, msg) {
  if (statusEl.textContent !== msg) statusEl.textContent = msg;
  statusEl.className = 'status ' + level;
  views.camera.classList.toggle('ok', level === 'ok');
  if (level !== 'ok') btnCapture.disabled = true;
}


// ── 손바닥 실시간 안내 ───────────────────────────────────────
const PALM_HOLD_MS = 1500;                 // 손바닥은 흔들림에 민감해 조금 더 오래 멈추게 한다
const PALM_FIT = { minW: 0.30, maxW: 0.62, maxDx: 0.22, maxDy: 0.20, maxTilt: 38, maxMove: 0.012 };
const lightCv = document.createElement('canvas'); lightCv.width = lightCv.height = 48;

function palmLoop(now) {
  const hl = engine.hand;
  if (!stream || !hl || capturing || engine.handMode !== 'VIDEO') return;
  if (video.readyState < 2 || now - lastDetect < DETECT_INTERVAL || video.currentTime === lastVideoTime) return;
  lastDetect = now; lastVideoTime = video.currentTime;
  syncOverlaySize();
  if (video.videoWidth !== geo.vw || video.videoHeight !== geo.vh || camStage.clientWidth !== geo.sw || camStage.clientHeight !== geo.sh) layoutCamera();
  let res;
  try { res = hl.detectForVideo(video, now); } catch (e) { return; }
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const raw = res?.landmarks?.[0];
  if (!raw) { setLive('', '손바닥을 펴서 틀 안에 보여 주세요.'); resetHold(); return; }
  const pts = raw.map(p => ({ x: p.x * overlay.width, y: p.y * overlay.height }));
  const check = palmCheck(pts, res.handednesses?.[0]?.[0]?.categoryName, now);
  drawHand(ctx, pts, check.ok);
  setLive(check.ok ? 'ok' : 'warn', check.msg);
  btnCapture.disabled = !check.ok;
  if (!check.ok) { resetHold(); return; }
  if (!goodSince) goodSince = now;
  if (autoToggle.checked) {
    const pr = clamp((now - goodSince) / PALM_HOLD_MS, 0, 1);
    setProgress(pr);
    if (pr >= 1) captureFromVideo();
  }
}

function palmCheck(pts, label, now) {
  const o = geo.oval;
  if (!o) return { ok: false, msg: '카메라를 준비하는 중…' };
  const W = dist(pts[5], pts[17]);
  const short = Math.min(video.videoWidth, video.videoHeight);
  // 손 전체를 감싸는 상자의 가운데를 화면 좌표로
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const c = toDisplay({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
  const dx = (c.x - o.cx) / o.w, dy = (c.y - o.cy) / o.h;
  const wrist = toDisplay(pts[0]), mcp = toDisplay(pts[9]);
  let tilt = Math.abs(Math.atan2(mcp.x - wrist.x, wrist.y - mcp.y) * 180 / Math.PI);   // 손가락이 위쪽을 향하면 0도
  const inFrame = [0, 4, 8, 12, 16, 20].every(i => pts[i].x > overlay.width * 0.01 && pts[i].x < overlay.width * 0.99 && pts[i].y > overlay.height * 0.01 && pts[i].y < overlay.height * 0.99);
  liveInfo = { palmW: +(W / short).toFixed(2), dx: +dx.toFixed(2), dy: +dy.toFixed(2), tilt: +tilt.toFixed(0) };

  if (!isPalmFacing(pts, label)) return { ok: false, msg: '손등이 보여요. 손바닥이 카메라를 향하게 해 주세요.' };
  if (!inFrame) return { ok: false, msg: '손가락 끝이 화면 밖으로 나갔어요. 조금 멀리 떨어져 주세요.' };
  // 손가락이 펴졌는지: 손목에서 각 손가락 끝까지가 손가락 뿌리까지보다 충분히 길어야 한다
  const open = [[5, 8], [9, 12], [13, 16], [17, 20]].every(([m, t]) => dist(pts[0], pts[t]) / dist(pts[0], pts[m]) > 1.55);
  if (!open) return { ok: false, msg: '손가락을 쭉 펴 주세요.' };
  if (W / short < PALM_FIT.minW) return { ok: false, msg: '손을 조금 더 가까이 가져와 주세요.' };
  if (W / short > PALM_FIT.maxW) return { ok: false, msg: '손을 조금 멀리 떨어뜨려 주세요.' };
  if (Math.abs(dx) > PALM_FIT.maxDx || Math.abs(dy) > PALM_FIT.maxDy) {
    if (Math.abs(dx) / PALM_FIT.maxDx >= Math.abs(dy) / PALM_FIT.maxDy) return { ok: false, msg: dx > 0 ? '← 손을 왼쪽으로 옮겨 주세요.' : '손을 오른쪽으로 옮겨 주세요. →' };
    return { ok: false, msg: dy > 0 ? '↑ 손을 위쪽으로 옮겨 주세요.' : '↓ 손을 아래쪽으로 옮겨 주세요.' };
  }
  if (tilt > PALM_FIT.maxTilt) return { ok: false, msg: '손가락 끝이 위쪽을 향하게 세워 주세요.' };
  // 손이 움직이는지 (움직이면 흐리게 찍힌다)
  const mv = Math.hypot(c.x - palmStable.x, c.y - palmStable.y) / Math.max(o.w, 1);
  const dt = Math.max(1, now - palmStable.t);
  palmStable = { x: c.x, y: c.y, t: now };
  if (mv / (dt / 33) > PALM_FIT.maxMove * 2.2) return { ok: false, msg: '손을 잠시 멈춰 주세요.' };
  // 밝기
  try {
    const lc = lightCv.getContext('2d', { willReadFrequently: true });
    lc.drawImage(video, 0, 0, lightCv.width, lightCv.height);
    const d = lc.getImageData(0, 0, lightCv.width, lightCv.height).data;
    let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const br = sum / (d.length / 4);
    if (br < 55) return { ok: false, msg: '너무 어두워요. 밝은 곳으로 가 주세요.' };
    if (br > 235) return { ok: false, msg: '빛이 너무 강해요. 그림자가 덜한 곳으로 가 주세요.' };
  } catch { /* 밝기 검사를 못 해도 촬영은 가능 */ }
  return { ok: true, msg: autoToggle.checked ? '좋습니다. 손을 그대로 멈춰 주세요.' : '좋습니다. 촬영 버튼을 눌러 주세요.' };
}

function drawHand(ctx, pts, ok) {
  const conns = engine.mod.HandLandmarker.HAND_CONNECTIONS;
  const lw = Math.max(2, ctx.canvas.width / 320);
  ctx.save();
  ctx.lineWidth = lw; ctx.strokeStyle = ok ? 'rgba(111,211,154,0.9)' : 'rgba(255,143,107,0.85)';
  strokeConnections(ctx, pts, conns);
  ctx.fillStyle = ok ? 'rgba(241,214,122,0.95)' : 'rgba(255,200,170,0.9)';
  for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, lw * 1.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function blend(cats, name) { return cats?.find(c => c.categoryName === name)?.score ?? 0; }

// 고개 각도 허용 범위(도). 공식 증명사진 표본의 각도 분포를 바탕으로 정함.
// pitch 가 음수면 턱을 든 상태, 양수면 턱을 숙인 상태.
const POSE_LIMIT = { yaw: 9, roll: 10, pitchMin: -10, pitchMax: 16 };

// 위치·크기 판정 기준 (타원 대비 비율). 타원은 머리카락까지 포함한 머리 전체를 감싸는 크기다.
// size: 얼굴 윤곽선(이마 윗부분~턱) 높이 ÷ 타원 높이. 머리가 타원에 알맞게 들어오면 약 0.6.
// dyTarget: 이마 위 머리카락 때문에 얼굴 중심은 타원 중심보다 약간 아래에 오는 것이 자연스럽다.
const FIT = { minSize: 0.48, maxSize: 0.85, maxDx: 0.15, maxDy: 0.13, dyTarget: 0.06 };

function frontalCheck(pts, pose, cats) {
  const o = geo.oval;
  if (!o) return { ok: false, msg: '카메라를 준비하는 중…' };
  const top = toDisplay(pts[LM.top]), chin = toDisplay(pts[LM.chin]);
  const l = toDisplay(pts[LM.cheekL]), r = toDisplay(pts[LM.cheekR]);
  const size = dist(top, chin) / o.h;
  const dx = ((l.x + r.x) / 2 - o.cx) / o.w;          // + 면 화면 오른쪽으로 치우침
  const dy = ((top.y + chin.y) / 2 - o.cy) / o.h - FIT.dyTarget;   // + 면 화면 아래쪽으로 치우침
  const { yaw, roll, pitch } = pose;
  liveInfo = { size: +size.toFixed(2), dx: +dx.toFixed(2), dy: +dy.toFixed(2), yaw: +yaw.toFixed(1), pitch: +pitch.toFixed(1), roll: +roll.toFixed(1) };

  if (size < FIT.minSize) return { ok: false, msg: '조금 더 가까이 와 주세요.' };
  if (size > FIT.maxSize) return { ok: false, msg: '조금 뒤로 물러나 주세요.' };
  if (Math.abs(dx) > FIT.maxDx || Math.abs(dy) > FIT.maxDy) {
    if (Math.abs(dx) / FIT.maxDx >= Math.abs(dy) / FIT.maxDy) return { ok: false, msg: dx > 0 ? '← 얼굴을 화면 왼쪽으로 옮겨 주세요.' : '얼굴을 화면 오른쪽으로 옮겨 주세요. →' };
    return { ok: false, msg: dy > 0 ? '↑ 얼굴을 화면 위쪽으로 옮겨 주세요.' : '↓ 얼굴을 화면 아래쪽으로 옮겨 주세요.' };
  }
  if (Math.abs(yaw) > POSE_LIMIT.yaw) return { ok: false, msg: '정면을 바라봐 주세요.' };
  if (Math.abs(roll) > POSE_LIMIT.roll) return { ok: false, msg: '고개를 바르게 세워 주세요.' };
  if (pitch < POSE_LIMIT.pitchMin) return { ok: false, msg: '턱을 조금 내려 주세요.' };
  if (pitch > POSE_LIMIT.pitchMax) return { ok: false, msg: '턱을 조금 들어 주세요.' };
  if (cats) {
    if ((blend(cats, 'eyeBlinkLeft') + blend(cats, 'eyeBlinkRight')) / 2 > 0.55) return { ok: false, msg: '눈을 편하게 떠 주세요.' };
    if (blend(cats, 'jawOpen') > 0.25) return { ok: false, msg: '입을 다물어 주세요.' };
    if ((blend(cats, 'mouthSmileLeft') + blend(cats, 'mouthSmileRight')) / 2 > 0.5) return { ok: false, msg: '웃음을 거두고 무표정으로 해 주세요.' };
  }
  return { ok: true, msg: autoToggle.checked ? '좋습니다. 그대로 잠시 멈춰 주세요.' : '좋습니다. 촬영 버튼을 눌러 주세요.' };
}

function toPixels(lm, w, h) {
  return lm.map(p => ({ x: p.x * w, y: p.y * h, z: p.z * w }));
}

function strokeConnections(ctx, pts, conns) {
  ctx.beginPath();
  for (const c of conns) { const a = pts[c.start], b = pts[c.end]; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  ctx.stroke();
}
function drawMesh(ctx, pts, ok) {
  const F = engine.mod.FaceLandmarker;
  const lw = Math.max(1, ctx.canvas.width / 640);
  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = ok ? 'rgba(212,175,55,0.28)' : 'rgba(255,120,90,0.25)';
  strokeConnections(ctx, pts, F.FACE_LANDMARKS_TESSELATION);
  ctx.lineWidth = lw * 1.6;
  ctx.strokeStyle = ok ? 'rgba(111,211,154,0.9)' : 'rgba(255,143,107,0.85)';
  strokeConnections(ctx, pts, F.FACE_LANDMARKS_CONTOURS);
  ctx.restore();
}

// ── 촬영 / 업로드 → 분석 ─────────────────────────────────────
async function captureFromVideo() {
  if (capturing || !stream) return;
  capturing = true;
  const palm = captureKind === 'palm';
  const buf = palm ? [] : featureBuf.map(b => b.f);
  const flash = $('#flash');
  flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
  navigator.vibrate?.(30);

  const w = video.videoWidth, h = video.videoHeight;
  const scale = Math.min(1, 1280 / Math.max(w, h));
  snapshot.width = Math.round(w * scale);
  snapshot.height = Math.round(h * scale);
  const ctx = snapshot.getContext('2d');
  ctx.save();
  // 얼굴은 미리보기(거울)와 같은 모습으로 저장, 손바닥은 실제 보이는 모습 그대로 저장
  if (video.dataset.mirrored && !palm) { ctx.translate(snapshot.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, snapshot.width, snapshot.height);
  ctx.restore();
  stopCamera();
  try {
    if (palm) await analyzePalmSnapshot({ history: 'replace' });
    else await analyzeSnapshot({ liveFeatures: buf, history: 'replace', fov: { deg: CAMERA_DIAG_FOV, source: 'camera' } });
  } finally { capturing = false; }
}

async function drawFileToSnapshot(file) {
  const fit = (w, h) => {
    const s = Math.min(1, 1280 / Math.max(w, h));
    snapshot.width = Math.round(w * s);
    snapshot.height = Math.round(h * s);
  };
  if (window.createImageBitmap) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      fit(bmp.width, bmp.height);
      snapshot.getContext('2d').drawImage(bmp, 0, 0, snapshot.width, snapshot.height);
      bmp.close?.();
      return;
    } catch { /* 아래 방식으로 재시도 */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    fit(img.naturalWidth, img.naturalHeight);
    snapshot.getContext('2d').drawImage(img, 0, 0, snapshot.width, snapshot.height);
  } catch {
    throw new Error('사진을 읽을 수 없습니다. JPG나 PNG 사진으로 다시 시도해 주세요.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function handleFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) { showToast('이미지 파일만 분석할 수 있습니다.'); return; }
  try {
    const exif = await readExif(file);
    await drawFileToSnapshot(file);
    // 사진 촬영 정보(EXIF)에 35mm 환산 초점거리가 있으면 화각을 알 수 있어 원근 보정을 한다.
    // 단, 잘라낸 사진은 화각이 달라지므로(원본과 가로세로 비율이 다르면) 보정하지 않는다.
    let fov = null;
    if (exif?.focal35) {
      const ratio = (a, b) => Math.max(a, b) / Math.min(a, b);
      const cropped = exif.w && exif.h && Math.abs(ratio(exif.w, exif.h) - ratio(snapshot.width, snapshot.height)) > 0.03;
      fov = cropped ? { skip: 'cropped' } : { deg: 2 * Math.atan(21.63 / exif.focal35) * 180 / Math.PI, source: 'exif' };
    }
    await analyzeSnapshot({ history: current === 'intro' ? 'push' : 'replace', fov });
  } catch (e) {
    showToast(e.message || String(e), 4000);
    if (flow === 'combo') backToHub(); else show('intro', { history: 'replace' });
  }
}

function detectImage() {
  return engine.landmarker.detect(snapshot);
}

/** JPEG 촬영 정보(EXIF)에서 35mm 환산 초점거리(0xA405)와 원본 크기(0xA002·0xA003)를 읽는다. 없으면 null. */
async function readExif(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return null;
    let off = 2;
    while (off + 10 < v.byteLength) {
      const marker = v.getUint16(off), len = v.getUint16(off + 2);
      if ((marker & 0xFF00) !== 0xFF00) return null;
      if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) {   // 'Exif'
        const tiff = off + 10, le = v.getUint16(tiff) === 0x4949;
        const u16 = (o) => v.getUint16(o, le), u32 = (o) => v.getUint32(o, le);
        const find = (ifd, tag) => { const n = u16(ifd); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === tag) return e; } return null; };
        const val = (e) => (e ? (u16(e + 2) === 4 ? u32(e + 8) : u16(e + 8)) : 0);   // 형식 3=SHORT, 4=LONG
        const exifPtr = find(tiff + u32(tiff + 4), 0x8769);
        if (!exifPtr) return null;
        const ifd = tiff + u32(exifPtr + 8);
        const f35 = val(find(ifd, 0xA405));
        return { focal35: f35 >= 10 && f35 <= 300 ? f35 : null, w: val(find(ifd, 0xA002)), h: val(find(ifd, 0xA003)) };
      }
      off += 2 + len;
    }
  } catch { /* 촬영 정보 없음 */ }
  return null;
}

async function analyzeSnapshot({ liveFeatures = [], history: histMode = 'push', fov = null } = {}) {
  show('analyzing', { history: histMode });
  $('#analyzing-steps').innerHTML = '';
  const steps = ['얼굴 윤곽을 찾는 중…', '478개 지점을 측정하는 중…', '삼정(三停)과 오관(五官)을 읽는 중…', '십이궁(十二宮)의 기운을 해석하는 중…'];
  const stepUI = (async () => { for (const s of steps) { addStep(s); await sleep(600); } })();

  try {
    await loadEngine();
    await setMode('IMAGE');
    let res;
    try { res = detectImage(); }
    catch (e) {
      if (engine.delegate !== 'GPU') throw e;
      console.warn('GPU 검출 실패, CPU로 재시도', e);
      await buildLandmarker('CPU');
      await setMode('IMAGE');
      res = detectImage();
    }
    const lm = res?.faceLandmarks?.[0];
    if (!lm) throw new Error('NOFACE');
    const pts = toPixels(lm, snapshot.width, snapshot.height);
    const snapFeatures = measure(pts);
    // 실시간 촬영이면 최근 여러 프레임의 중앙값으로 흔들림을 줄인다
    let features = liveFeatures.length >= 3 ? medianFeatures([...liveFeatures, snapFeatures], snapFeatures) : snapFeatures;
    // 원근 보정: 셀카처럼 가까이서 찍으면 비율이 한쪽으로 쏠리므로 추정 거리의 왜곡을 빼 준다
    if (fov?.skip) features.perspectiveSkip = fov.skip;
    else if (fov) {
      // 팔을 뻗은 셀카보다 가까울 수는 없으므로 25cm 아래는 25cm로 본다 (과보정 방지)
      const D = Math.max(25, estimateDistance(pts, snapshot.width, snapshot.height, fov.deg));
      features = correctPerspective(features, D);
      features.fovSource = fov.source;
    }
    // 업로드 사진은 표정 검사를 거치지 않으므로, 웃는 얼굴이면 기준값을 만들 때처럼 입 너비를 보정한다
    // (웃으면 입꼬리가 옆으로 당겨져 입이 실제보다 넓게 잡힌다)
    if (!liveFeatures.length) {
      const cats = res.faceBlendshapes?.[0]?.categories;
      const smile = (blend(cats, 'mouthSmileLeft') + blend(cats, 'mouthSmileRight')) / 2;
      if (smile > 0.5) { features = { ...features, mouthWidth: features.mouthWidth / 1.2, smileCorrected: true }; }
    }
    features.frames = liveFeatures.length + 1;
    const result = analyze(features);
    result.pts = pts;
    lastResult = result;
    combo.face = result;
    await stepUI;
    await sleep(300);
    if (current !== 'analyzing') { refreshFusion(); renderHub(); renderResult(result); return; }   // 분석 중 사용자가 뒤로 감
    renderResult(result);
    refreshFusion();
    if (flow === 'combo') { backToHub(); showToast('관상 분석이 끝났습니다.'); }
    else show('result', { history: 'replace' });
    animateMeters();
    cardPromise = null;
    setTimeout(() => { if (lastResult === result) cardPromise = makeCardFile().catch(() => null); }, 400);
    const { yaw, pitch } = snapFeatures.pose;
    if (flow !== 'combo' && !liveFeatures.length && (Math.abs(yaw) > 15 || Math.abs(pitch) > 15)) {
      showToast('얼굴이 다소 돌아가 있어 자세를 보정했습니다. 정면 사진일수록 정확합니다.', 4200);
    }
  } catch (e) {
    await stepUI;
    console.error(e);
    if (current !== 'analyzing') return;
    showToast(e.message === 'NOFACE' ? '얼굴을 찾지 못했습니다. 정면 얼굴이 잘 보이는 사진으로 다시 시도해 주세요.' : '분석 중 문제가 발생했습니다: ' + (e.message || e), 4200);
    if (flow === 'combo') backToHub(); else show('intro', { history: 'replace' });
  }
}

function medianFeatures(list, base) {
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (typeof base[k] !== 'number') continue;
    const vals = list.map(f => f[k]).filter(Number.isFinite).sort((a, b) => a - b);
    if (vals.length) out[k] = vals[Math.floor(vals.length / 2)];
  }
  return out;
}

function addStep(text) {
  const li = document.createElement('li');
  li.textContent = text;
  $('#analyzing-steps').appendChild(li);
  requestAnimationFrame(() => li.classList.add('in'));
}

// ── 결과 렌더링 ──────────────────────────────────────────────
function faceCrop(pts, W, H) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const fw = maxX - minX, fh = maxY - minY;
  let ch = fh * 1.55, cw = ch * 0.8;
  if (cw < fw * 1.45) { cw = fw * 1.45; ch = cw / 0.8; }
  cw = Math.min(cw, W); ch = Math.min(ch, H);
  const x = clamp((minX + maxX) / 2 - cw / 2, 0, W - cw);
  const y = clamp(minY - fh * 0.34, 0, H - ch);
  return { x, y, w: cw, h: ch };
}

function renderResult(r) {
  const { type, shape, samjeong, parts, palaces, fortune, summary } = r;
  const t = type.primary;
  const sh = shape.primary;

  // 얼굴 부분만 잘라서 표시
  const crop = faceCrop(r.pts, snapshot.width, snapshot.height);
  const s = clamp(760 / crop.w, 0.5, 2.5);
  const photo = $('#result-photo');
  photo.width = Math.round(crop.w * s);
  photo.height = Math.round(crop.h * s);
  const ctx = photo.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(snapshot, crop.x, crop.y, crop.w, crop.h, 0, 0, photo.width, photo.height);
  const local = r.pts.map(p => ({ x: (p.x - crop.x) * s, y: (p.y - crop.y) * s }));
  drawResultOverlay(ctx, local, t.color);

  // 얼굴형 카드
  $('#type-seal').textContent = t.hanja;
  $('#type-seal').style.setProperty('--seal', t.color);
  $('#type-name').textContent = t.name;
  $('#type-shape').textContent = t.shape;
  $('#type-keyword').textContent = t.keyword;
  $('#type-desc').textContent = t.desc;

  // 십자면상
  $('#shape-char').textContent = sh.char;
  $('#shape-name').textContent = sh.name;
  $('#shape-shape').textContent = sh.shape;
  $('#shape-text').textContent = sh.text;
  $('#shape-advice').textContent = sh.advice;
  $('#shape-top').innerHTML = shape.weights.map((w, i) => `<span class="${i ? '' : 'on'}"><b>${w.char}</b>${w.name.replace(/\(.+\)/, '')} ${w.pct}%</span>`).join('');

  // 촬영 거리와 원근 보정 안내
  const fe = r.features;
  const smileNote = fe.smileCorrected ? ' 웃는 얼굴이라 입 너비도 무표정 기준으로 보정했습니다.' : '';
  $('#photo-note').textContent = (fe.distanceCm
    ? `촬영 거리 약 ${fe.distanceCm}cm로 추정해 원근 왜곡을 보정했습니다.`
    : fe.perspectiveSkip === 'cropped'
      ? '잘라낸 사진이라 촬영 화각을 알 수 없어 원근 보정 없이 분석했습니다. 셀카라면 카메라로 직접 찍을 때 더 정확합니다.'
      : '사진에 촬영 정보가 없어 원근 보정 없이 분석했습니다. 셀카라면 카메라로 직접 찍을 때 더 정확합니다.') + smileNote;
  $('#type-strengths').innerHTML = t.strengths.map(x => `<li>${x}</li>`).join('');
  $('#type-career').textContent = t.career;
  $('#type-caution').textContent = t.caution;
  $('#type-lucky').textContent = `${t.lucky.color} · ${t.lucky.direction} · ${t.lucky.season}`;
  $('#type-secondary').textContent = `${type.secondary.name} 기운 겸비`;
  $('#type-mix').innerHTML = type.weights.map(w => `<span class="mix" style="--c:${w.type.color};--w:${w.pct}%" title="${w.type.name} ${w.pct}%"></span>`).join('');
  $('#type-mix-legend').innerHTML = type.weights.map(w => `<span><i style="background:${w.type.color}"></i>${w.type.hanja} ${w.pct}%</span>`).join('');

  // 총점
  $('#avg-score').textContent = fortune.avg;
  $('#avg-grade').textContent = gradeLabel(fortune.avg);

  // 삼정
  $('#samjeong').innerHTML = samjeong.stages.map(x => `
    <div class="sj ${x.key === samjeong.best.key ? 'best' : ''}">
      <div class="sj-head"><b>${x.name}</b><span>${x.part} · ${x.period}</span></div>
      <div class="meter"><i data-w="${clamp(x.idx - 60, 0, 80) / 80 * 100}%" style="--w:0%"></i><em>${x.idx}</em></div>
      <p>${x.text}</p>
    </div>`).join('');
  $('#samjeong-balance').textContent = samjeong.balance;

  // 다섯 가지 운
  $('#fortunes').innerHTML = fortune.ranked.map(f => `
    <div class="fortune">
      <div class="f-head"><span class="f-icon" aria-hidden="true">${f.icon}</span><b>${f.name}</b><span class="f-level ${f.level === '大吉' ? 'top' : ''}">${f.level}</span><span class="f-score">${f.score}</span></div>
      <div class="meter gold"><i data-w="${f.score}%" style="--w:0%"></i></div>
      <p>${f.text}</p>
    </div>`).join('');

  // 십이궁
  $('#palaces').innerHTML = palaces.map(p => `
    <div class="palace g-${p.grade === '上' ? 'top' : p.grade === '中' ? 'mid' : 'low'}">
      <div class="p-grade">${p.grade}</div>
      <div class="p-body"><b>${p.name}</b><span>${p.part}</span><small>${p.desc}</small></div>
    </div>`).join('');

  // 부위별
  $('#parts').innerHTML = parts.map((p, i) => `
    <details class="part"${i === 0 ? ' open' : ''}>
      <summary><span class="p-name">${p.name}<small>${p.hanja}</small></span><span class="p-label">${p.label}</span><span class="p-badge ${p.grade === '大吉' ? 'top' : ''}">${p.grade}</span></summary>
      <p>${p.text}</p>
    </details>`).join('');

  // 총평
  $('#summary').innerHTML = summary.map(x => `<p>${x}</p>`).join('');
}
function animateMeters() {
  setTimeout(() => {
    document.querySelectorAll('#view-result .meter i[data-w]').forEach(i => i.style.setProperty('--w', i.dataset.w));
  }, 60);
}

function drawResultOverlay(ctx, pts, color) {
  const F = engine.mod.FaceLandmarker;
  const w = ctx.canvas.width;
  ctx.save();
  ctx.lineWidth = Math.max(1.2, w / 500);
  ctx.strokeStyle = 'rgba(212,175,55,0.9)';
  strokeConnections(ctx, pts, F.FACE_LANDMARKS_FACE_OVAL);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  for (const set of [F.FACE_LANDMARKS_LEFT_EYE, F.FACE_LANDMARKS_RIGHT_EYE, F.FACE_LANDMARKS_LEFT_EYEBROW, F.FACE_LANDMARKS_RIGHT_EYEBROW, F.FACE_LANDMARKS_LIPS]) {
    strokeConnections(ctx, pts, set);
  }
  // 삼정 구분선
  const left = Math.max(4, pts[LM.cheekL].x - w * 0.05);
  const right = Math.min(w - w * 0.1, pts[LM.cheekR].x + w * 0.03);
  const fs = Math.round(w / 26);
  ctx.setLineDash([w / 120, w / 120]);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.font = `700 ${fs}px "Noto Serif KR", serif`;
  ctx.textBaseline = 'middle';
  const marks = [[LM.top, '上停'], [LM.glabella, '中停'], [LM.subnasale, '下停'], [LM.chin, '']];
  for (let i = 0; i < marks.length; i++) {
    const y = pts[marks[i][0]].y;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    if (marks[i][1]) {
      const yNext = pts[marks[i + 1][0]].y;
      ctx.fillText(marks[i][1], right + 6, (y + yNext) / 2);
    }
  }
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(241,214,122,0.95)';
  for (const i of [LM.noseTip, LM.glabella, LM.mouthL, LM.mouthR, LM.eyeL.outer, LM.eyeR.outer]) {
    ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, Math.max(2.5, w / 220), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── 결과 카드 (저장 · 공유) ──────────────────────────────────
async function drawCard() {
  await document.fonts?.ready;
  const r = lastResult, t = r.type.primary, photo = $('#result-photo');
  const W = 1080, PAD = 72, IW = W - PAD * 2;
  const serif = '"Noto Serif KR", serif', sans = '"Noto Sans KR", sans-serif';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `28px ${sans}`;
  const sh = r.shape.primary;
  const descLines = wrapLines(ctx, sh.text, IW);
  const PW = 560, PH = Math.round(PW * photo.height / photo.width);
  const H = PAD + 150 + PH + 60 + 70 + descLines.length * 44 + 50 + r.fortune.ranked.length * 86 + 90;
  c.width = W; c.height = H;

  ctx.fillStyle = '#0d1220'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, W);
  g.addColorStop(0, 'rgba(212,175,55,0.18)'); g.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37'; ctx.font = `900 58px ${serif}`;
  ctx.fillText('관상 판독 결과', W / 2, PAD + 52);
  ctx.fillStyle = '#e7e2d4'; ctx.font = `500 30px ${sans}`;
  ctx.fillText(`${sh.char} ${sh.name} · ${t.name}`, W / 2, PAD + 108);

  const px = (W - PW) / 2, py = PAD + 150;
  ctx.save(); roundRect(ctx, px, py, PW, PH, 28); ctx.clip(); ctx.drawImage(photo, px, py, PW, PH); ctx.restore();
  ctx.strokeStyle = 'rgba(212,175,55,0.7)'; ctx.lineWidth = 3; roundRect(ctx, px, py, PW, PH, 28); ctx.stroke();

  let y = py + PH + 80;
  ctx.fillStyle = '#f1d67a'; ctx.font = `900 44px ${serif}`;
  ctx.fillText(`종합 ${r.fortune.avg}점 · ${gradeLabel(r.fortune.avg)}`, W / 2, y);
  y += 60;
  ctx.textAlign = 'left'; ctx.fillStyle = '#c8cbd6'; ctx.font = `28px ${sans}`;
  for (const line of descLines) { ctx.fillText(line, PAD, y); y += 44; }
  y += 30;
  for (const f of r.fortune.ranked) {
    ctx.fillStyle = '#f4efe3'; ctx.font = `700 30px ${sans}`; ctx.textAlign = 'left';
    ctx.fillText(`${f.icon} ${f.name}`, PAD, y + 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#f1d67a'; ctx.fillText(`${f.score}  ${f.level}`, W - PAD, y + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, PAD, y + 48, IW, 14, 7); ctx.fill();
    ctx.fillStyle = '#d4af37'; roundRect(ctx, PAD, y + 48, IW * f.score / 100, 14, 7); ctx.fill();
    y += 86;
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#7f8698'; ctx.font = `22px ${sans}`;
  ctx.fillText('관상 판독기 · 오락용 결과이며 과학적 근거가 없습니다.', W / 2, H - 40);
  return c;
}

async function makeCardFile() {
  const canvas = await drawCard();
  // JPEG: PNG보다 인코딩이 빠르고 용량이 작아 메신저 공유에 알맞다
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
  if (!blob) throw new Error('카드 이미지를 만들지 못했습니다.');
  return new File([blob], `관상판독_${new Date().toISOString().slice(0, 10)}.jpg`, { type: 'image/jpeg' });
}

async function saveCard() {
  if (!lastResult) return;
  const btn = $('#btn-save');
  btn.disabled = true;
  try {
    const file = (await cardPromise) || await makeCardFile();
    const blob = file, name = file.name;
    const t = lastResult.type.primary;
    if (IS_MOBILE && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '관상 판독 결과', text: `나의 관상은 ${t.name}, 종합 ${lastResult.fortune.avg}점!` });
        return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    showToast(IS_MOBILE ? '결과 카드를 다운로드했습니다. 사진첩이나 다운로드 폴더를 확인하세요.' : '결과 카드를 저장했습니다.');
  } catch (e) {
    console.error(e);
    showToast('결과 카드를 만들지 못했습니다.');
  } finally {
    btn.disabled = false;
  }
}

// ── 휴대폰 접속용 QR 코드 (PC 화면) ──────────────────────────
async function setupMobileCard() {
  if (IS_MOBILE) return;
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let url = null, selfSigned = false;
  if (isLocal) {
    try {
      const info = await (await fetch('api/info', { cache: 'no-store' })).json();
      if (info.https?.length) { url = info.https[0]; selfSigned = true; } else if (info.http?.length) url = info.http[0];
    } catch { /* 정적 호스팅 환경 */ }
  } else {
    url = location.href.split('#')[0];
    selfSigned = location.protocol === 'https:' && /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname);
  }
  if (!url) return;
  try {
    if (!window.qrcode) {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    const qr = window.qrcode(0, 'M');
    qr.addData(url); qr.make();
    const n = qr.getModuleCount(), cv = $('#qr'), cell = Math.floor(200 / n) || 1;
    cv.width = cv.height = n * cell;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
  } catch { $('#qr').classList.add('hidden'); }
  const a = $('#mobile-url');
  a.textContent = url; a.href = url;
  $('#mobile-cert-note').classList.toggle('hidden', !selfSigned);
  $('#mobile-card').classList.remove('hidden');
}

// ── PWA: 오프라인 캐시 · 홈 화면 설치 ────────────────────────
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* 자체 서명 인증서 등에서는 등록 불가 */ }));
}
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#btn-install').classList.remove('hidden'); });
$('#btn-install').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice.catch(() => {});
  installEvt = null;
  $('#btn-install').classList.add('hidden');
});


// ── 손바닥 분석 ──────────────────────────────────────────────
async function analyzePalmSnapshot({ history: histMode = 'push' } = {}) {
  show('analyzing', { history: histMode });
  $('#analyzing-steps').innerHTML = '';
  const steps = ['손 모양을 찾는 중…', '손바닥을 똑바로 펴는 중…', '손금 선을 찾는 중…', '생명선·두뇌선·감정선을 읽는 중…'];
  const stepUI = (async () => { for (const st of steps) { addStep(st); await sleep(600); } })();
  try {
    await loadHand();
    await setHandMode('IMAGE');
    let res;
    try { res = engine.hand.detect(snapshot); }
    catch (e) {
      if (engine.handDelegate !== 'GPU') throw e;
      await buildHand('CPU'); await setHandMode('IMAGE'); res = engine.hand.detect(snapshot);
    }
    const raw = res?.landmarks?.[0];
    if (!raw) throw new Error('NOHAND');
    const lm = raw.map(p => ({ x: p.x * snapshot.width, y: p.y * snapshot.height }));
    if (!isPalmFacing(lm, res.handednesses?.[0]?.[0]?.categoryName)) throw new Error('BACKHAND');
    await sleep(40);   // 안내 화면이 먼저 그려지게 한 번 양보
    const img = snapshot.getContext('2d').getImageData(0, 0, snapshot.width, snapshot.height);
    const analysis = analyzePalm(img, lm);
    const reading = interpretPalm(analysis);
    const palm = { analysis, reading, lm };
    combo.palm = palm;
    await stepUI;
    await sleep(250);
    V.renderPalm(palm, snapshot);
    refreshFusion();
    renderHub();
    if (current !== 'analyzing') return;   // 분석 중 사용자가 뒤로 감
    backToHub();
    showToast(analysis.quality.level === 'poor' ? '손금 분석이 끝났습니다. 사진이 흐려 정확도가 낮을 수 있어요.' : '손금 분석이 끝났습니다.', 3600);
  } catch (e) {
    await stepUI;
    console.error(e);
    if (current !== 'analyzing') return;
    showToast({
      NOHAND: '손을 찾지 못했습니다. 손바닥 전체가 잘 보이는 사진으로 다시 시도해 주세요.',
      BACKHAND: '손등이 찍혔습니다. 손바닥이 카메라를 향한 사진으로 다시 시도해 주세요.',
    }[e.message] || ('손금 분석 중 문제가 발생했습니다: ' + (e.message || e)), 4600);
    backToHub();
  }
}

async function handlePalmFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) { showToast('이미지 파일만 분석할 수 있습니다.'); return; }
  try {
    await drawFileToSnapshot(file);
    await analyzePalmSnapshot({ history: current === 'hub' ? 'push' : 'replace' });
  } catch (e) {
    showToast(e.message || String(e), 4000);
    backToHub();
  }
}

// ── 종합 분석 (허브 · 사주 입력 · 종합 결과) ────────────────
/** 허브로 돌아간다. 허브에서 눌러 들어온 화면(카메라·분석 중·사주 입력)이면 뒤로 가기로 기록을 정리한다. */
function backToHub() {
  const v = history.state?.view;
  if (v === 'analyzing' || v === 'camera' || v === 'sajuform') history.back();
  else { renderHub(); show('hub', { history: 'replace' }); }
}

function refreshFusion() {
  combo.fused = fuse({ face: combo.face || undefined, palm: combo.palm?.reading, saju: combo.saju?.reading });
}
function syncBackLinks() {
  const has = !!combo.fused;
  document.querySelectorAll('[data-back-combo]').forEach(el => el.classList.toggle('hidden', !has));
  $('#combo-back-face').classList.toggle('hidden', !has);
  $('#btn-to-combo').classList.toggle('hidden', has);
}
function sajuSummary(st) {
  const { saju } = st, P = saju.pillars, pad = (n) => String(n).padStart(2, '0');
  const ganji = [P.year, P.month, P.day, P.hour].map(x => (x ? x.hanja : '？？')).join(' ');
  return `${saju.solar.year}.${pad(saju.solar.month)}.${pad(saju.solar.day)} · ${ganji}`;
}
function renderHub() {
  const done = { saju: !!combo.saju, face: !!combo.face, palm: !!combo.palm };
  for (const k of ['saju', 'face', 'palm']) {
    $(`#step-${k}`).classList.toggle('done', done[k]);
    $(`#hub-${k}-view`).classList.toggle('hidden', !done[k]);
  }
  $('#hub-saju-status').textContent = combo.saju ? `✓ ${sajuSummary(combo.saju)}` : '';
  $('#hub-saju').textContent = combo.saju ? '✎ 다시 입력' : '입력하기';
  $('#hub-face-status').textContent = combo.face ? `✓ ${combo.face.shape.primary.name} · ${combo.face.type.primary.name}` : '';
  $('#hub-face-cam').textContent = combo.face ? '📷 다시 촬영' : '📷 촬영';
  $('#hub-palm-status').textContent = combo.palm ? `✓ ${combo.palm.reading.shape.primary.name} · ${combo.palm.analysis.quality.level === 'poor' ? '사진이 흐림' : '선을 찾았어요'}` : '';
  $('#hub-palm-cam').textContent = combo.palm ? '📷 다시 촬영' : '📷 촬영';
  const n = Object.values(done).filter(Boolean).length;
  $('#hub-go').disabled = n < 2;
  $('#hub-hint').textContent = n < 2 ? `두 가지 이상 완료하면 종합 결과를 볼 수 있습니다. (${n}/3 완료)`
    : n === 2 ? '한 가지를 더 하면 더 정확해지지만, 지금도 종합 결과를 볼 수 있습니다.' : '세 가지를 모두 완료했습니다!';
}
function openCombo() {
  refreshFusion();
  if (!combo.fused) return;
  V.renderCombo(combo.fused, combo);
  show('combo');
}
function goto(name) {
  if (name === 'hub') { flow = 'combo'; renderHub(); show('hub'); }
  else if (name === 'combo') { if (combo.fused) { V.renderCombo(combo.fused, combo); show('combo'); } else goto('hub'); }
  else if (name === 'result') { if (lastResult) show('result'); }
  else if (name === 'palm') { if (combo.palm) show('palm'); }
  else if (name === 'saju') { if (combo.saju) show('saju'); }
  else if (name === 'sajuform') show('sajuform');
  else { if (name === 'intro') flow = 'single'; show(name); }
}

// 사주 입력 양식
const sf = { form: $('#saju-form'), year: $('#saju-year'), month: $('#saju-month'), day: $('#saju-day'), time: $('#saju-time'), unknown: $('#saju-timeunknown'), leap: $('#saju-leap'), leapWrap: $('#leap-wrap'), err: $('#saju-error') };
const sajuCalendar = () => (sf.form.elements.cal.value === 'lunar' ? 'lunar' : 'solar');
function fillSelect(el, first, items) { el.innerHTML = `<option value="">${first}</option>` + items.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); }
function updateSajuDays() {
  const y = +sf.year.value || 2000, m = +sf.month.value || 1;
  const max = sajuCalendar() === 'lunar' ? 30 : new Date(y, m, 0).getDate();
  const cur = sf.day.value;
  fillSelect(sf.day, '일', Array.from({ length: max }, (_, i) => [i + 1, `${i + 1}일`]));
  if (cur && +cur <= max) sf.day.value = cur;
}
function initSajuForm() {
  const thisYear = new Date().getFullYear();
  fillSelect(sf.year, '년', Array.from({ length: thisYear - 1929 }, (_, i) => [thisYear - i, `${thisYear - i}년`]));
  fillSelect(sf.month, '월', Array.from({ length: 12 }, (_, i) => [i + 1, `${i + 1}월`]));
  updateSajuDays();
  sf.year.addEventListener('change', updateSajuDays);
  sf.month.addEventListener('change', updateSajuDays);
  sf.form.addEventListener('change', (e) => {
    if (e.target.name === 'cal') { sf.leapWrap.classList.toggle('hidden', sajuCalendar() !== 'lunar'); if (sajuCalendar() !== 'lunar') sf.leap.checked = false; updateSajuDays(); }
  });
  sf.unknown.addEventListener('change', () => { sf.time.disabled = sf.unknown.checked; if (!sf.unknown.checked && !sf.time.value) sf.time.value = '12:00'; });
  sf.form.addEventListener('submit', (e) => { e.preventDefault(); submitSaju(); });
  $('#saju-cancel').addEventListener('click', () => history.back());
}
function submitSaju() {
  const fail = (msg) => { sf.err.textContent = msg; sf.err.classList.remove('hidden'); };
  sf.err.classList.add('hidden');
  const year = +sf.year.value, month = +sf.month.value, day = +sf.day.value;
  if (!year || !month || !day) return fail('생년월일을 모두 선택해 주세요.');
  let hour = null, minute = 0;
  if (!sf.unknown.checked) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(sf.time.value || '');
    if (!m) return fail('태어난 시간을 입력하거나 "시간을 몰라요"를 선택해 주세요.');
    hour = +m[1]; minute = +m[2];
  }
  try {
    const input = { year, month, day, calendar: sajuCalendar(), leap: sajuCalendar() === 'lunar' && sf.leap.checked, hour, minute };
    const saju = computeSaju(input);
    const st = { input, saju, reading: interpretSaju(saju) };
    combo.saju = st;
    V.renderSaju(st);
    refreshFusion();
    renderHub();
    backToHub();
    showToast('사주 계산이 끝났습니다.');
  } catch (err) { fail(err.message || '사주를 계산하지 못했습니다.'); }
}

// 파일 저장 / 공유 (종합 결과 카드)
async function shareOrDownload(file, { title, text }) {
  if (IS_MOBILE && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title, text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  showToast(IS_MOBILE ? '결과 카드를 다운로드했습니다. 사진첩이나 다운로드 폴더를 확인하세요.' : '결과 카드를 저장했습니다.');
}
async function saveComboCard() {
  if (!combo.fused) return;
  const btn = $('#combo-save'); btn.disabled = true;
  try {
    const canvas = await V.drawComboCard(combo.fused, combo, combo.palm ? $('#palm-photo') : null);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) throw new Error('카드 이미지를 만들지 못했습니다.');
    const file = new File([blob], `종합운세_${new Date().toISOString().slice(0, 10)}.jpg`, { type: 'image/jpeg' });
    await shareOrDownload(file, { title: '관상·손금·사주 종합 결과', text: `나의 종합 운세는 ${combo.fused.avg}점, ${combo.fused.grade}!` });
  } catch (e) { console.error(e); showToast('결과 카드를 만들지 못했습니다.'); }
  finally { btn.disabled = false; }
}

// ── 이벤트 ───────────────────────────────────────────────────
$('#btn-start').addEventListener('click', () => { flow = 'single'; startCapture('face'); });
$('#btn-combo').addEventListener('click', () => goto('hub'));
$('#btn-to-combo').addEventListener('click', () => goto('hub'));
document.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) goto(b.dataset.goto); });

// 종합 분석 허브
$('#hub-saju').addEventListener('click', () => show('sajuform'));
$('#hub-saju-view').addEventListener('click', () => show('saju'));
$('#hub-face-cam').addEventListener('click', () => { flow = 'combo'; startCapture('face'); });
$('#hub-face-up').addEventListener('click', () => { flow = 'combo'; captureKind = 'face'; fileInput.click(); });
$('#hub-face-view').addEventListener('click', () => show('result'));
$('#hub-palm-cam').addEventListener('click', () => { flow = 'combo'; startCapture('palm'); });
$('#hub-palm-up').addEventListener('click', () => { flow = 'combo'; captureKind = 'palm'; palmInput.click(); });
$('#hub-palm-view').addEventListener('click', () => show('palm'));
$('#hub-go').addEventListener('click', openCombo);
$('#hub-reset').addEventListener('click', () => { combo.face = combo.palm = combo.saju = combo.fused = null; renderHub(); syncBackLinks(); showToast('처음부터 다시 시작합니다.'); });
$('#palm-retake').addEventListener('click', () => { flow = 'combo'; startCapture('palm', { replace: true }); });
$('#combo-save').addEventListener('click', saveComboCard);
for (const input of [palmInput, palmCaptureInput]) {
  input.addEventListener('change', () => { const f = input.files?.[0]; input.value = ''; handlePalmFile(f); });
}
btnSwitch.addEventListener('click', async () => {
  const prev = facing;
  facing = facing === 'user' ? 'environment' : 'user';
  resetHold();
  try { await startStream(); lastVideoTime = -1; }
  catch (e) {
    if (e.name === 'AbortError') return;
    facing = prev; showToast('카메라를 전환할 수 없습니다.');
    try { await startStream(); } catch { /* 무시 */ }
  }
});
$('#btn-cancel').addEventListener('click', () => { stopCamera(); history.back(); });
btnCapture.addEventListener('click', captureFromVideo);
autoToggle.addEventListener('change', () => { resetHold(); try { localStorage.setItem('gwansang.auto', autoToggle.checked ? '1' : '0'); } catch { /* 무시 */ } });
try { const saved = localStorage.getItem('gwansang.auto'); if (saved !== null) autoToggle.checked = saved === '1'; } catch { /* 무시 */ }

$('#btn-upload').addEventListener('click', () => { flow = 'single'; captureKind = 'face'; fileInput.click(); });
for (const input of [fileInput, captureInput]) {
  input.addEventListener('change', () => { const f = input.files?.[0]; input.value = ''; handleFile(f); });
}
document.addEventListener('dragover', e => { if (current !== 'intro') return; e.preventDefault(); document.body.classList.add('drag'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drag'); });
document.addEventListener('drop', e => {
  e.preventDefault(); document.body.classList.remove('drag');
  if (current === 'intro') { flow = 'single'; handleFile(e.dataTransfer?.files?.[0]); }
});
$('#btn-retake').addEventListener('click', () => startCapture('face', { replace: true }));
$('#btn-home').addEventListener('click', () => { flow = 'single'; show('intro', { history: 'replace' }); });
$('#btn-save').addEventListener('click', saveCard);

window.addEventListener('resize', relayoutCamera);
window.visualViewport?.addEventListener('resize', relayoutCamera);
screen.orientation?.addEventListener?.('change', () => setTimeout(relayoutCamera, 250));
video.addEventListener('resize', () => { syncOverlaySize(); relayoutCamera(); });

// 다른 앱으로 전환하면 카메라를 끄고, 돌아오면 다시 켠다 (배터리·개인정보 보호)
document.addEventListener('visibilitychange', () => {
  if (current !== 'camera') return;
  if (document.hidden) { if (stream) { stopCamera(); resumeCamOnVisible = true; } }
  else if (resumeCamOnVisible) { resumeCamOnVisible = false; openCamera(); }
});

// ── 초기화 ───────────────────────────────────────────────────
if (!CAN_LIVE) {
  $('#http-note').classList.remove('hidden');
  $('#btn-start').textContent = '📷 카메라로 촬영하기';
  $('#btn-retake').textContent = '📷 다시 촬영';
}
if (IS_MOBILE && typeof navigator.canShare === 'function') $('#btn-save').textContent = '📤 결과 공유';
setupMobileCard();
initSajuForm();
renderHub();
syncBackLinks();
if (navigator.connection?.saveData) setEngineStatus('데이터 절약 모드: 촬영을 시작할 때 판독 엔진(약 13MB)을 내려받습니다.');
else loadEngine().catch(() => { /* 상태 문구로 안내됨 */ });

// 테스트 훅
window.gwansang = {
  analyzeFromUrl: async (url) => { const blob = await (await fetch(url)).blob(); await handleFile(new File([blob], 'test.jpg', { type: blob.type || 'image/jpeg' })); return lastResult; },
  // 보정용: 화면 연출 없이 사진 한 장의 측정값만 돌려준다
  measureUrl: async (url) => {
    const blob = await (await fetch(url)).blob();
    await drawFileToSnapshot(blob);
    await loadEngine();
    await setMode('IMAGE');
    const res = detectImage();
    const lm = res?.faceLandmarks?.[0];
    if (!lm) return null;
    const m = measure(toPixels(lm, snapshot.width, snapshot.height));
    m.blend = Object.fromEntries((res.faceBlendshapes?.[0]?.categories || []).map(c => [c.categoryName, +c.score.toFixed(3)]));
    return m;
  },
  get last() { return lastResult; },
  get combo() { return combo; },
  get live() { return liveInfo; },
  analyzePalmFromUrl: async (url) => { const blob = await (await fetch(url)).blob(); flow = 'combo'; await handlePalmFile(new File([blob], 'palm.jpg', { type: blob.type || 'image/jpeg' })); return combo.palm; },
  setSaju: (input) => { const saju = computeSaju(input); combo.saju = { input, saju, reading: interpretSaju(saju) }; V.renderSaju(combo.saju); refreshFusion(); renderHub(); return combo.saju; },
  openCombo,
  goto,
  get geo() { return { ...geo }; },
  get engine() { return { source: engine.source?.name, delegate: engine.delegate, mode: engine.mode }; },
  env: { IS_MOBILE, CAN_LIVE },
  measure,
};
