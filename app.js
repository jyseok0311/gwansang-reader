// ─────────────────────────────────────────────────────────────
//  관상 판독기 — 메인 앱
//  카메라 → MediaPipe Face Landmarker(478점) → 자세 보정·비율 측정 → 관상 해석
//  PC와 휴대폰(안드로이드·아이폰) 모두 지원
// ─────────────────────────────────────────────────────────────
import { analyze, clamp, gradeLabel } from './physiognomy.js';
import { measure, LM, dist, mid } from './measure.js';

// ── 엔진 경로: 로컬(vendor/) 우선, 없으면 CDN ────────────────
const MP_VERSION = '0.10.14';
const abs = (p) => new URL(p, location.href).href;
const ENGINE_SOURCES = [
  { name: 'local', bundle: abs('./vendor/tasks-vision/vision_bundle.mjs'), wasm: abs('./vendor/tasks-vision/wasm'), model: abs('./vendor/face_landmarker.task') },
  { name: 'cdn', bundle: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`,
    wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
    model: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
];

// ── 환경 판별 ────────────────────────────────────────────────
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const CAN_LIVE = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
const DETECT_INTERVAL = IS_MOBILE ? 66 : 33;   // 휴대폰은 초당 15회, PC는 30회 검출
const AUTO_HOLD_MS = 1200;                     // 조건을 이만큼 유지하면 자동 촬영
const FEATURE_WINDOW_MS = 1500;                // 중앙값에 쓰는 최근 프레임 범위

// ── DOM ──────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const views = { intro: $('#view-intro'), camera: $('#view-camera'), analyzing: $('#view-analyzing'), result: $('#view-result') };
const video = $('#video');
const overlay = $('#overlay');
const snapshot = $('#snapshot');
const statusEl = $('#status');
const btnCapture = $('#btn-capture');
const btnSwitch = $('#btn-switch');
const autoToggle = $('#auto-toggle');
const progressRing = $('#shutter-progress');
const fileInput = $('#file-input');
const captureInput = $('#capture-input');
const toast = $('#toast');

// ── 상태 ─────────────────────────────────────────────────────
const engine = { mod: null, vision: null, source: null, delegate: null, landmarker: null, mode: 'VIDEO', promise: null };
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
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
  document.body.classList.toggle('cam-open', name === 'camera');
  if (mode === 'push' && prev !== name) history.pushState({ view: name }, '');
  else if (mode === 'replace') history.replaceState({ view: name }, '');
  window.scrollTo({ top: 0, behavior: name === 'result' ? 'auto' : 'smooth' });
}
history.replaceState({ view: 'intro' }, '');
window.addEventListener('popstate', (e) => {
  let v = e.state?.view || 'intro';
  if (v === 'analyzing' || (v === 'result' && !lastResult)) v = 'intro';
  if (current === 'camera' && v !== 'camera') stopCamera();
  show(v, { history: 'none' });
  if (v === 'camera') openCamera();
});

// ── 엔진 로드 ────────────────────────────────────────────────
function loadEngine() {
  if (!engine.promise) engine.promise = createEngine().catch(e => { engine.promise = null; throw e; });
  return engine.promise;
}
async function createEngine() {
  setEngineStatus('판독 엔진 준비 중…');
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

// ── 카메라 ───────────────────────────────────────────────────
async function startStream() {
  stopStream();
  const token = camToken;
  const portrait = window.innerHeight > window.innerWidth;
  const size = portrait ? { width: { ideal: 720 }, height: { ideal: 1280 } } : { width: { ideal: 1280 }, height: { ideal: 720 } };
  const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, ...size }, audio: false });
  if (token !== camToken) { s.getTracks().forEach(t => t.stop()); throw Object.assign(new Error('취소됨'), { name: 'AbortError' }); }
  stream = s;
  video.srcObject = s;
  if (video.readyState < 1) await new Promise(res => video.addEventListener('loadedmetadata', res, { once: true }));
  await video.play().catch(() => {});
  const settingsFacing = s.getVideoTracks()[0]?.getSettings?.().facingMode;
  const mirrored = settingsFacing ? settingsFacing === 'user' : facing === 'user';
  video.classList.toggle('mirror', mirrored);
  overlay.classList.toggle('mirror', mirrored);
  video.dataset.mirrored = mirrored ? '1' : '';
  syncOverlaySize();
  updateSwitchButton();
}
function stopStream() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
}
function stopCamera() {
  camToken++;
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

async function openCamera() {
  if (!CAN_LIVE) { captureInput.click(); return; }
  const token = ++camToken;
  btnCapture.disabled = true;
  resetHold();
  setLive('warn', engine.landmarker ? '카메라를 준비하는 중…' : '판독 엔진을 불러오는 중…');
  try {
    await Promise.all([startStream(), loadEngine()]);
    if (token !== camToken || current !== 'camera') { stopCamera(); return; }
    await setMode('VIDEO');
    setLive('', '타원 안에 얼굴을 맞춰 주세요.');
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
    show('intro', { history: 'replace' });
  }
}

// ── 실시간 미리보기 루프 ─────────────────────────────────────
function liveLoop(now) {
  rafId = requestAnimationFrame(liveLoop);
  const lmk = engine.landmarker;
  if (!stream || !lmk || capturing || engine.mode !== 'VIDEO') return;
  if (video.readyState < 2 || now - lastDetect < DETECT_INTERVAL || video.currentTime === lastVideoTime) return;
  lastDetect = now;
  lastVideoTime = video.currentTime;
  syncOverlaySize();

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
  const check = frontalCheck(pts, feat.pose, overlay.width, overlay.height, res.faceBlendshapes?.[0]?.categories);
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

function blend(cats, name) { return cats?.find(c => c.categoryName === name)?.score ?? 0; }

// 고개 각도 허용 범위(도). 공식 증명사진 표본의 각도 분포를 바탕으로 정함.
// pitch 가 음수면 턱을 든 상태, 양수면 턱을 숙인 상태.
const POSE_LIMIT = { yaw: 9, roll: 10, pitchMin: -10, pitchMax: 16 };

function frontalCheck(pts, pose, w, h, cats) {
  const faceW = dist(pts[LM.cheekL], pts[LM.cheekR]);
  const short = Math.min(w, h);
  const { yaw, roll, pitch } = pose;
  const center = mid(pts[LM.top], pts[LM.chin]);
  const off = Math.hypot(center.x - w / 2, center.y - h / 2) / short;

  if (faceW / short < 0.24) return { ok: false, msg: '조금 더 가까이 와 주세요.' };
  if (faceW / short > 0.85) return { ok: false, msg: '조금 뒤로 물러나 주세요.' };
  if (off > 0.24) return { ok: false, msg: '얼굴을 화면 가운데로 옮겨 주세요.' };
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
  const buf = featureBuf.map(b => b.f);
  const flash = $('#flash');
  flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
  navigator.vibrate?.(30);

  const w = video.videoWidth, h = video.videoHeight;
  const scale = Math.min(1, 1280 / Math.max(w, h));
  snapshot.width = Math.round(w * scale);
  snapshot.height = Math.round(h * scale);
  const ctx = snapshot.getContext('2d');
  ctx.save();
  if (video.dataset.mirrored) { ctx.translate(snapshot.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, snapshot.width, snapshot.height);
  ctx.restore();
  stopCamera();
  try { await analyzeSnapshot({ liveFeatures: buf, history: 'replace' }); }
  finally { capturing = false; }
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
    await drawFileToSnapshot(file);
    await analyzeSnapshot({ history: current === 'intro' ? 'push' : 'replace' });
  } catch (e) {
    showToast(e.message || String(e), 4000);
    show('intro', { history: 'replace' });
  }
}

function detectImage() {
  return engine.landmarker.detect(snapshot);
}

async function analyzeSnapshot({ liveFeatures = [], history: histMode = 'push' } = {}) {
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
    const features = liveFeatures.length >= 3 ? medianFeatures([...liveFeatures, snapFeatures], snapFeatures) : snapFeatures;
    features.frames = liveFeatures.length + 1;
    const result = analyze(features);
    result.pts = pts;
    lastResult = result;
    await stepUI;
    await sleep(300);
    if (current !== 'analyzing') return;   // 분석 중 사용자가 뒤로 감
    renderResult(result);
    show('result', { history: 'replace' });
    animateMeters();
    const { yaw, pitch } = snapFeatures.pose;
    if (!liveFeatures.length && (Math.abs(yaw) > 15 || Math.abs(pitch) > 15)) {
      showToast('얼굴이 다소 돌아가 있어 자세를 보정했습니다. 정면 사진일수록 정확합니다.', 4200);
    }
  } catch (e) {
    await stepUI;
    console.error(e);
    if (current !== 'analyzing') return;
    showToast(e.message === 'NOFACE' ? '얼굴을 찾지 못했습니다. 정면 얼굴이 잘 보이는 사진으로 다시 시도해 주세요.' : '분석 중 문제가 발생했습니다: ' + (e.message || e), 4200);
    show('intro', { history: 'replace' });
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
  const { type, samjeong, parts, palaces, fortune, summary } = r;
  const t = type.primary;

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
  $('#type-strengths').innerHTML = t.strengths.map(x => `<li>${x}</li>`).join('');
  $('#type-career').textContent = t.career;
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
function wrapLines(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(/(\s+)/)) {
    if (ctx.measureText(line + word).width <= maxW) { line += word; continue; }
    if (line.trim()) lines.push(line.trim());
    line = '';
    for (const ch of word.trimStart()) {   // 한 단어가 너무 길면 글자 단위로 자름
      if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function drawCard() {
  await document.fonts?.ready;
  const r = lastResult, t = r.type.primary, photo = $('#result-photo');
  const W = 1080, PAD = 72, IW = W - PAD * 2;
  const serif = '"Noto Serif KR", serif', sans = '"Noto Sans KR", sans-serif';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `28px ${sans}`;
  const descLines = wrapLines(ctx, t.desc, IW);
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
  ctx.fillText(`${t.name} · ${t.keyword}`, W / 2, PAD + 108);

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

async function saveCard() {
  if (!lastResult) return;
  const btn = $('#btn-save');
  btn.disabled = true;
  try {
    const canvas = await drawCard();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const name = `관상판독_${new Date().toISOString().slice(0, 10)}.png`;
    const file = new File([blob], name, { type: 'image/png' });
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

// ── 이벤트 ───────────────────────────────────────────────────
$('#btn-start').addEventListener('click', () => {
  if (!CAN_LIVE) { captureInput.click(); return; }
  show('camera');
  openCamera();
});
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

$('#btn-upload').addEventListener('click', () => fileInput.click());
for (const input of [fileInput, captureInput]) {
  input.addEventListener('change', () => { const f = input.files?.[0]; input.value = ''; handleFile(f); });
}
document.addEventListener('dragover', e => { if (current !== 'intro') return; e.preventDefault(); document.body.classList.add('drag'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drag'); });
document.addEventListener('drop', e => {
  e.preventDefault(); document.body.classList.remove('drag');
  if (current === 'intro') handleFile(e.dataTransfer?.files?.[0]);
});
$('#btn-retake').addEventListener('click', () => {
  if (!CAN_LIVE) { captureInput.click(); return; }
  show('camera', { history: 'replace' });
  openCamera();
});
$('#btn-home').addEventListener('click', () => show('intro', { history: 'replace' }));
$('#btn-save').addEventListener('click', saveCard);

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
loadEngine().catch(() => { /* 상태 문구로 안내됨 */ });

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
  get engine() { return { source: engine.source?.name, delegate: engine.delegate, mode: engine.mode }; },
  env: { IS_MOBILE, CAN_LIVE },
  measure,
};
