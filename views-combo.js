// ─────────────────────────────────────────────────────────────
//  손금·사주·종합 결과 화면 그리기 (DOM 채우기와 결과 카드 그림)
// ─────────────────────────────────────────────────────────────
import { ELEMENTS, STEMS, BRANCHES } from './saju.js';
import { FORTUNE_KEYS, FORTUNE_NAMES } from './fusion.js';
import { wrapLines, roundRect, $, clamp, esc } from './util.js';
import { compareHands } from './palm-reading.js';
import { josa } from './physiognomy.js';
import { SRC_COLOR, mountChart, createOrrery, drawRadar, drawFlow, drawElementMap, renderRadarImage, drawWheel, drawDonut, drawColumns } from './charts.js';

const ICON = { wealth: '🪙', love: '💞', career: '🏛️', health: '🌿', social: '🤝' };
const LEVEL = (n) => (n >= 88 ? '大吉' : n >= 78 ? '吉' : n >= 68 ? '中吉' : '平');
const SRC = { face: '관상', palm: '손금', saju: '사주' };
const elColor = (k) => ELEMENTS[k].color;
const glyphEl = (k) => `--c:${elColor(k)}`;

// ── 그래프 ───────────────────────────────────────────────────
const AXES = FORTUNE_KEYS.map(k => ({ key: k, label: { wealth: '재물', love: '애정', career: '직업', health: '건강', social: '대인' }[k] }));
const legend = (items) => items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('');
const vals = (m) => FORTUNE_KEYS.map(k => m[k]);
const aria = (title, names, values) => `${title}: ` + names.map((n, i) => `${n} ${values[i]}점`).join(', ');

/** 관상 결과: 다섯 운 레이더 + 삼정(초년·중년·말년) 흐름선 */
export function renderFaceCharts(r) {
  const v = FORTUNE_KEYS.map(k => r.fortune.fortunes[k].score);
  const radar = $('#face-radar');
  radar.setAttribute('aria-label', aria('관상으로 본 인생 영역별 점수', AXES.map(a => a.label), v));
  mountChart(radar, (ctx, w, h, k) => drawRadar(ctx, w, h, k, { axes: AXES, series: [{ color: SRC_COLOR.face, values: v, glow: true }] }));
  // 열두 궁 휠: 상·중·하 등급을 색과 길이로
  const GR = { 上: ['#ffb24d', 1], 中: ['#6fd39a', 0.68], 下: ['#8a8f9e', 0.42] };
  const wheel = $('#face-wheel');
  wheel.setAttribute('aria-label', '열두 궁 등급: ' + r.palaces.map(p => `${p.name.replace(/\(.+\)/, '')} ${p.grade}`).join(', '));
  mountChart(wheel, (ctx, w, h, k) => drawWheel(ctx, w, h, k, { segs: r.palaces.map(p => ({ label: p.name.replace(/\(.+\)/, ''), color: GR[p.grade][0], fill: GR[p.grade][1] })), center: '十二宮', centerSub: '열두 궁' }));
  const st = r.samjeong.stages;
  const flow = $('#face-flow');
  flow.setAttribute('aria-label', '인생의 흐름: ' + st.map(x => `${x.period.split(' · ')[0]} ${x.idx}`).join(', '));
  mountChart(flow, (ctx, w, h, k) => drawFlow(ctx, w, h, k, {
    points: st.map(x => ({ name: x.period.split(' · ')[0], sub: x.period.split(' · ')[1], value: x.idx, best: x.key === r.samjeong.best.key })),
  }));
}

/** 손금 결과: 네 선의 세기 레이더 + 다섯 운 레이더 */
function renderPalmCharts(r, hand) {
  const lineAxes = [{ label: '감정선' }, { label: '두뇌선' }, { label: '생명선' }, { label: '운명선' }];
  const lv = ['heart', 'head', 'life', 'fate'].map(k => r.lineScores[k] ?? 40);
  const lr = $('#palm-line-radar');
  lr.setAttribute('aria-label', aria('손금 네 선의 뚜렷함과 길이', lineAxes.map(a => a.label), lv));
  mountChart(lr, (ctx, w, h, k) => drawRadar(ctx, w, h, k, { axes: lineAxes, series: [{ color: SRC_COLOR.palm, values: lv, glow: true }] }));
  if (hand && hand.fingerLen) {   // 손가락 길이 막대 (손바닥 길이 = 1)
    const FL = hand.fingerLen, fl = [['검지', FL.index], ['중지', FL.middle], ['약지', FL.ring], ['새끼', FL.pinky]], fc = $('#palm-fingers');
    fc.setAttribute('aria-label', '손가락 길이: ' + fl.map(([n, x]) => `${n} ${x.toFixed(2)}`).join(', '));
    mountChart(fc, (ctx, w, h, k) => drawColumns(ctx, w, h, k, { labels: fl.map(x => x[0]), min: 0, max: 1.3, fmt: (x) => x.toFixed(2), series: [{ color: SRC_COLOR.palm, values: fl.map(x => x[1]) }] }));
  }
  const v = vals(r.fortunes), fr = $('#palm-radar');
  fr.setAttribute('aria-label', aria('손금으로 본 인생 영역별 점수', AXES.map(a => a.label), v));
  mountChart(fr, (ctx, w, h, k) => drawRadar(ctx, w, h, k, { axes: AXES, series: [{ color: SRC_COLOR.palm, values: v, glow: true }] }));
}

/** 사주 결과: 오행 구성도 + 다섯 운 레이더 */
function renderSajuCharts(r) {
  const em = $('#saju-elmap');
  em.setAttribute('aria-label', '오행 분포: ' + Object.entries(r.counts).map(([k, n]) => `${ELEMENTS[k].name} ${n}글자`).join(', '));
  mountChart(em, (ctx, w, h, k) => drawElementMap(ctx, w, h, k, { markers: [{ src: 'saju', el: r.dayMaster.el }], counts: r.counts }));
  const GODN = { same: '비겁', genMe: '인성', iGen: '식상', iCtrl: '재성', ctrlMe: '관성' }, gk = Object.keys(GODN);
  const gc = $('#saju-godcols'); gc.setAttribute('aria-label', '십성 분포: ' + gk.map(k => `${GODN[k]} ${r.gods[k]}`).join(', '));
  mountChart(gc, (ctx, w, h, k) => drawColumns(ctx, w, h, k, { labels: gk.map(x => GODN[x]), min: 0, max: Math.max(4, ...gk.map(x => r.gods[x])) + 1, highlight: gk.indexOf(r.topGod.key), series: [{ color: SRC_COLOR.saju, values: gk.map(x => r.gods[x]) }] }));
  const EO = ['wood', 'fire', 'earth', 'metal', 'water'], dn = $('#saju-donut');
  dn.setAttribute('aria-label', '오행 비율: ' + EO.map(k => `${ELEMENTS[k].name} ${r.counts[k]}`).join(', '));
  $('#saju-donut-legend').innerHTML = EO.map(k => `<span><i style="background:${ELEMENTS[k].color}"></i>${ELEMENTS[k].hanja} ${r.counts[k]}</span>`).join('');
  mountChart(dn, (ctx, w, h, k) => drawDonut(ctx, w, h, k, { items: EO.map(e => ({ label: ELEMENTS[e].hanja, value: r.counts[e], color: ELEMENTS[e].color })), center: r.dayMaster.hanja, centerSub: '일간' }));
  const v = vals(r.fortunes), fr = $('#saju-radar');
  fr.setAttribute('aria-label', aria('사주로 본 인생 영역별 점수', AXES.map(a => a.label), v));
  mountChart(fr, (ctx, w, h, k) => drawRadar(ctx, w, h, k, { axes: AXES, series: [{ color: SRC_COLOR.saju, values: v, glow: true }] }));
}

/** 종합 결과: 3D 운명 구성도 + 겹쳐 보는 레이더 + 오행 구성도 */
function renderComboCharts(f, c) {
  const by = (s) => FORTUNE_KEYS.map(k => f.fortunes.find(x => x.key === k).by[s]);
  const all = FORTUNE_KEYS.map(k => f.fortunes.find(x => x.key === k).combined);
  const order = ['saju', 'palm', 'face'].filter(s => f.has[s]);                    // 아래에서 위로: 바탕(사주) → 손 → 얼굴 → 종합
  const layers = [...order.map(s => ({ label: SRC[s], color: SRC_COLOR[s], values: by(s) })), { label: '종합', color: SRC_COLOR.all, values: all, top: true }];
  const series = [...order.map(s => ({ color: SRC_COLOR[s], values: by(s) })), { color: SRC_COLOR.all, values: all, glow: true }];
  const text = (title) => aria(title, AXES.map(a => a.label), all);

  const orr = $('#combo-orrery');
  orr.setAttribute('aria-label', text('종합 점수 입체 그래프. 좌우 방향키로 돌릴 수 있습니다'));
  createOrrery(orr, { axes: AXES, layers });
  const rd = $('#combo-radar');
  rd.setAttribute('aria-label', text('인생 영역별 종합 점수'));
  mountChart(rd, (ctx, w, h, k) => drawRadar(ctx, w, h, k, { axes: AXES, series }));
  const legends = legend([...order.map(s => [SRC_COLOR[s], SRC[s]]), [SRC_COLOR.all, '종합']]);
  $('#combo-radar-legend').innerHTML = legends;
  $('#combo-orrery-legend').innerHTML = legends;

  const em = $('#combo-elmap');
  const counts = c.saju ? c.saju.reading.counts : null;
  em.setAttribute('aria-label', '세 방면의 오행 위치: ' + f.sources.map(s => `${SRC[s]} ${ELEMENTS[f.elems[s].key].name}`).join(', '));
  mountChart(em, (ctx, w, h, k) => drawElementMap(ctx, w, h, k, { markers: f.sources.map(s => ({ src: s, el: f.elems[s].key })), counts }));
}

/** 결과 카드에 넣을 레이더 그림 */
function comboRadarImage(f, size) {
  const by = (s) => FORTUNE_KEYS.map(k => f.fortunes.find(x => x.key === k).by[s]);
  const all = FORTUNE_KEYS.map(k => f.fortunes.find(x => x.key === k).combined);
  return renderRadarImage(size, { axes: AXES, fs: 24, series: [...f.sources.map(s => ({ color: SRC_COLOR[s], values: by(s) })), { color: SRC_COLOR.all, values: all, glow: true }] });
}

// ── 사주 ─────────────────────────────────────────────────────
const FORTUNE_BASIS = {
  wealth: '재성(財星)의 많고 적음', love: '식상(食傷)과 도화(桃花)의 기운', career: '관성(官星)의 힘',
  health: '오행이 고르게 갖춰진 정도', social: '비겁(比劫)과 인성(印星)의 도움',
};
const GOD_ORDER = ['same', 'genMe', 'iGen', 'iCtrl', 'ctrlMe'];

export function renderSaju(state) {
  const { saju: s, reading: r } = state;
  const P = s.pillars;
  const hh = (n) => String(n).padStart(2, '0');
  const timeTxt = s.timeKnown ? ` ${hh(state.input.hour)}:${hh(state.input.minute || 0)}` : ' (태어난 시간 모름)';
  const lunar = s.lunar;
  $('#saju-meta').textContent = `양력 ${s.solar.year}년 ${s.solar.month}월 ${s.solar.day}일${timeTxt} · 음력 ${lunar.month}월 ${lunar.day}일${lunar.intercalation ? '(윤달)' : ''} · ${r.animal}띠`;

  const cell = (p, label, isDay) => {
    if (!p) return `<div class="pillar unknown" role="cell"><div class="pillar-label">${label}</div><div class="pillar-q">?</div></div>`;
    const st = STEMS[p.stem], br = BRANCHES[p.branch];
    return `<div class="pillar${isDay ? ' day' : ''}" role="cell"><div class="pillar-label">${label}</div>
      <div class="glyph" style="${glyphEl(st.el)}" title="${st.ko}${ELEMENTS[st.el].ko}">${st.hanja}</div><div class="glyph-ko">${st.ko}<small>${ELEMENTS[st.el].ko}·${st.yang ? '양' : '음'}</small></div>
      <div class="glyph" style="${glyphEl(br.el)}" title="${br.ko} · ${br.animal}">${br.hanja}</div><div class="glyph-ko">${br.ko}<small>${ELEMENTS[br.el].ko}·${br.animal}</small></div></div>`;
  };
  $('#pillars').innerHTML = cell(P.hour, '시주 時') + cell(P.day, '일주 日 · 나', true) + cell(P.month, '월주 月') + cell(P.year, '년주 年');

  const notes = [];
  if (!s.timeKnown) notes.push('태어난 시간을 몰라 시주를 뺀 여섯 글자로 풀이했습니다. 시간을 알면 더 정확해집니다.');
  if (s.nearBoundary) notes.push('태어난 때가 절기가 바뀌는 시각에 가까워, 절기표에 따라 월주가 달라질 수 있습니다.');
  const nEl = $('#saju-notes'); nEl.textContent = notes.join(' '); nEl.classList.toggle('hidden', !notes.length);

  const dm = r.dayMaster, E = ELEMENTS[dm.el];
  const seal = $('#dm-seal'); seal.textContent = dm.hanja; seal.style.setProperty('--seal', E.color);
  $('#dm-name').textContent = `${dm.ko}${E.ko}(${dm.hanja}${E.hanja}) · ${dm.image}`;
  $('#dm-image').textContent = `${r.animal}띠 · ${r.strong ? '신강(身强)' : '신약(身弱)'} · 가장 많은 십성은 ${r.topGod.name}`;
  $('#dm-text').textContent = dm.text;
  $('#dm-advice').textContent = dm.advice;

  const maxC = Math.max(4, ...Object.values(r.counts));
  $('#el-bars').innerHTML = ['wood', 'fire', 'earth', 'metal', 'water'].map((k) => `
    <div class="el-row${r.counts[k] === 0 ? ' lack' : ''}" style="${glyphEl(k)}">
      <span class="el-name"><b>${ELEMENTS[k].hanja}</b>${ELEMENTS[k].name}</span>
      <span class="el-track"><i style="--w:0%" data-w="${r.counts[k] / maxC * 100}%"></i></span>
      <span class="el-count">${r.counts[k]}</span></div>`).join('');
  $('#el-texts').innerHTML = [...r.texts.excess, ...r.texts.lack, r.texts.strength].map((t) => `<p>${esc(t)}</p>`).join('');

  $('#gods').innerHTML = GOD_ORDER.map((k) => {
    const g = r.tenGods[k];
    return `<div class="god${r.topGod.key === k ? ' top' : ''}"><b>${g.name}<span>${r.gods[k]}</span></b><small>${g.mean}</small></div>`;
  }).join('');

  $('#saju-fortunes').innerHTML = FORTUNE_KEYS.map((k) => {
    const sc = r.fortunes[k];
    return `<div class="fortune"><div class="f-head"><span class="f-icon" aria-hidden="true">${ICON[k]}</span><b>${FORTUNE_NAMES[k]}</b><span class="f-level ${sc >= 88 ? 'top' : ''}">${LEVEL(sc)}</span><span class="f-score">${sc}</span></div>
      <div class="meter gold"><i data-w="${sc}%" style="--w:0%"></i></div><p>${josa(FORTUNE_BASIS[k], '을', '를')} 기준으로 계산한 점수입니다.</p></div>`;
  }).join('');
  renderSajuCharts(r);
  animate('#view-saju');
}

// ── 손금 ─────────────────────────────────────────────────────
const LINE_COLOR = { heart: '#ff4d6d', head: '#4ade80', life: '#4da3ff', fate: '#ffcc33' };
const LINE_NAME = { heart: '감정선', head: '두뇌선', life: '생명선', fate: '운명선' };
const QUALITY_TEXT = {
  dark: '사진이 어두워 선이 잘 안 보입니다. 밝은 곳에서 다시 찍으면 더 정확합니다.',
  bright: '빛이 너무 강해 선이 하얗게 날아갔습니다. 그림자가 덜한 곳에서 다시 찍어 보세요.',
  blur: '초점이 흐려 선이 뭉개졌습니다. 손을 멈추고 초점이 맞은 뒤 다시 찍어 보세요.',
  faint: '손금이 옅게 찍혀 선을 찾는 정확도가 낮습니다. 손바닥이 화면에 크게 나오도록 가까이서 찍어 보세요.',
};

export function palmCrop(analysis, lm, W, H) {
  const pts = [lm[0], lm[1], lm[2], lm[5], lm[9], lm[13], lm[17]];
  for (const l of Object.values(analysis.lines)) if (l) for (const p of l.fullPoints) pts.push(p);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.14;
  x0 = clamp(x0 - pad, 0, W); y0 = clamp(y0 - pad, 0, H); x1 = clamp(x1 + pad, 0, W); y1 = clamp(y1 + pad, 0, H);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function drawPalmOverlay(canvas, src, palm) {
  const { analysis, lm } = palm;
  const crop = palmCrop(analysis, lm, src.width, src.height);
  const s = clamp(760 / crop.w, 0.3, 2);
  canvas.width = Math.round(crop.w * s); canvas.height = Math.round(crop.h * s);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  const tx = (p) => ({ x: (p.x - crop.x) * s, y: (p.y - crop.y) * s });
  const lw = Math.max(3, canvas.width / 130);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const key of ['fate', 'life', 'head', 'heart']) {
    const l = analysis.lines[key]; if (!l) continue;
    const faint = key === 'fate' && palm.reading.fateClear === false;
    const stroke = (pts, width, color, dash) => { ctx.beginPath(); pts.forEach((p, i) => { const q = tx(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.setLineDash(dash); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(); };
    stroke(l.fullPoints, lw * 0.5, LINE_COLOR[key] + '88', [lw, lw * 1.2]);           // 흐린 나머지 구간
    if (!faint) { stroke(l.points, lw + 3, 'rgba(0,0,0,.55)', []); stroke(l.points, lw, LINE_COLOR[key], []); }
    else stroke(l.points, lw * 0.8, LINE_COLOR[key], [lw * 1.4, lw]);
    // 이름표
    const a = tx(l.points[Math.floor(l.points.length * 0.15)] || l.fullPoints[0]);
    ctx.setLineDash([]); ctx.font = `700 ${Math.max(12, canvas.width / 34)}px "Noto Sans KR", sans-serif`;
    const label = LINE_NAME[key] + (faint ? '(희미)' : ''), tw = ctx.measureText(label).width + 12, th = Math.max(20, canvas.width / 26);
    const lx = clamp(a.x - tw / 2, 4, canvas.width - tw - 4), ly = clamp(a.y - th - 8, 4, canvas.height - th - 4);
    ctx.fillStyle = 'rgba(5,6,10,.8)'; roundRect(ctx, lx, ly, tw, th, th / 2); ctx.fill();
    ctx.fillStyle = LINE_COLOR[key]; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(label, lx + 6, ly + th / 2 + 1);
  }
}

export function renderPalm(palm, srcCanvas, palms = null) {
  const { analysis: a, reading: r } = palm;
  renderPalmSide(palm, palms);
  drawPalmOverlay($('#palm-photo'), srcCanvas, palm);
  $('#palm-legend').innerHTML = ['heart', 'head', 'life', 'fate'].filter(k => a.lines[k]).map(k => `<span style="--c:${LINE_COLOR[k]}"><i></i>${LINE_NAME[k]}</span>`).join('');
  const iss = a.quality.issues;
  $('#palm-note').textContent = iss.length ? '' : '선명하게 찍혀 선을 비교적 잘 찾았습니다. 굵은 선은 뚜렷한 부분, 점선은 흐린 부분입니다.';
  const qEl = $('#palm-quality'); qEl.textContent = iss.map(k => QUALITY_TEXT[k]).join(' '); qEl.classList.toggle('hidden', !iss.length);

  const h = r.shape.primary, E = ELEMENTS[h.key];
  const seal = $('#hand-seal'); seal.textContent = h.hanja; seal.style.setProperty('--seal', E.color);
  $('#hand-name').textContent = h.name; $('#hand-shape').textContent = h.shape; $('#hand-text').textContent = h.text;
  $('#hand-mix').innerHTML = r.shape.weights.map(w => `<span class="mix" style="--c:${elColor(w.type.key)};--w:${w.pct}%" title="${w.type.name} ${w.pct}%"></span>`).join('');
  $('#hand-mix-legend').innerHTML = r.shape.weights.map(w => `<span><i style="background:${elColor(w.type.key)}"></i>${w.type.hanja} ${w.pct}%</span>`).join('');
  $('#hand-fingers').textContent = `${r.finger} ${r.thumb}`;

  $('#palm-readings').innerHTML = r.readings.map((x, i) => `
    <details class="part"${i === 0 ? ' open' : ''}>
      <summary><span class="p-name">${x.name}<small>${x.hanja} · ${x.topic}</small></span><span class="p-label">${x.headline}</span><span class="p-badge ${x.faint ? 'faint' : 'top'}">${x.clarity}</span></summary>
      <p>${esc(x.text)}</p><p class="metrics">${esc(x.metrics || '')}</p></details>`).join('');
  $('#palm-standout').innerHTML = r.standout.map(x => `<div class="standout-item"><div class="so-head"><b>${esc(x.title)}</b><span>${esc(x.from)}</span></div><p>${esc(x.text)}</p></div>`).join('');
  $('#palm-traits').innerHTML = r.traits.map(t => `<div class="trait"><div class="trait-head"><b>${esc(t.title)}</b><span class="dots" role="img" aria-label="5단계 중 ${t.tier + 1}단계">${[0, 1, 2, 3, 4].map(i => `<i class="${i === t.tier ? 'on' : ''}"></i>`).join('')}</span></div><p>${esc(t.text)}</p></div>`).join('');
  $('#palm-summary').innerHTML = r.summary.map(t => `<p>${esc(t)}</p>`).join('');
  $('#palm-fortunes').innerHTML = FORTUNE_KEYS.map((k) => {
    const sc = r.fortunes[k];
    return `<div class="fortune"><div class="f-head"><span class="f-icon" aria-hidden="true">${ICON[k]}</span><b>${FORTUNE_NAMES[k]}</b><span class="f-level ${sc >= 88 ? 'top' : ''}">${LEVEL(sc)}</span><span class="f-score">${sc}</span></div>
      <div class="meter gold"><i data-w="${sc}%" style="--w:0%"></i></div></div>`;
  }).join('');
  renderPalmCharts(r, a.hand);
  animate('#view-palm');
}

/** 왼손·오른손 표시, 두 손 전환 탭, 두 손 비교 */
function renderPalmSide(palm, palms) {
  const S = palm.reading.sideInfo;
  $('#palm-side').innerHTML = `<b>${S.name}</b> · ${S.role} <small>(${S.kind})</small>`;
  const both = !!(palms && palms.left && palms.right);
  const tabs = $('#palm-tabs');
  tabs.classList.toggle('hidden', !both);
  tabs.innerHTML = both ? ['left', 'right'].map(k => `<button type="button" role="tab" data-side="${k}" aria-selected="${palm.side === k}" class="${palm.side === k ? 'on' : ''}">${k === 'left' ? '왼손 · 타고난 바탕' : '오른손 · 지금의 모습'}</button>`).join('') : '';
  const cmp = $('#palm-compare');
  if (!both) {
    const other = palm.side === 'left' ? '오른손' : '왼손';
    cmp.innerHTML = `<p class="note">${other}도 촬영하면 타고난 바탕(왼손)과 살아오며 가꾼 모습(오른손)을 비교해 드립니다. 처음으로 돌아가 「다시 촬영」으로 ${other}을 찍어 보세요.</p>`;
    return;
  }
  const C = compareHands(palms.left, palms.right);
  const row = (x) => {
    const pos = (v) => (v == null ? null : clamp((v - 40) / 60 * 100, 0, 100));
    const a = pos(x.left), b = pos(x.right);
    const lo = Math.min(a ?? b, b ?? a), hi = Math.max(a ?? b, b ?? a);
    const tag = x.delta == null ? '' : x.delta > 0 ? `<span class="up">+${x.delta}</span>` : x.delta < 0 ? `<span class="down">${x.delta}</span>` : '<span>±0</span>';
    return `<div class="cmp"><div class="cmp-head"><b>${x.name}</b><span>왼 ${x.left ?? '-'} → 오 ${x.right ?? '-'} ${tag}</span></div>
      <div class="cmp-track">${a != null && b != null ? `<em style="left:${lo}%;width:${hi - lo}%"></em>` : ''}${a != null ? `<i class="l" style="left:${a}%"></i>` : ''}${b != null ? `<i class="r" style="left:${b}%"></i>` : ''}</div>
      <p>${esc(x.text)}</p></div>`;
  };
  cmp.innerHTML = `<div class="cmp-legend"><span><i class="l"></i>왼손(타고난)</span><span><i class="r"></i>오른손(지금)</span></div>`
    + `<div class="cmp-grid">${C.rows.map(row).join('')}</div><h4 class="cmp-sub">선별 비교</h4><div class="cmp-grid">${C.lineRows.map(row).join('')}</div>`
    + C.summary.map(t => `<p class="cmp-sum">${esc(t)}</p>`).join('');
}

// ── 종합 ─────────────────────────────────────────────────────
const REL_LABEL = { same: '같은 기운', gen: '상생', genBy: '상생', ctrl: '상극', ctrlBy: '상극' };
export function elementLabel(src, c) {
  if (src === 'face') return `${c.face.type.primary.name}`;
  if (src === 'palm') return `${c.palm.reading.shape.primary.name}`;
  const dm = c.saju.reading.dayMaster; return `${dm.ko}${ELEMENTS[dm.el].ko}(${dm.hanja}${ELEMENTS[dm.el].hanja}) 일간`;
}

export function renderCombo(f, c) {
  $('#dl-face').disabled = !c.face; $('#dl-palm').disabled = !c.palm; $('#dl-saju').disabled = !c.saju;
  $('#combo-core').classList.toggle('hidden', !f);   // 관상·손금·사주 중 둘 이상이 없으면 핵심 합산 부분은 숨기고 통합 리포트만 보여 준다
  if (!f) return;
  $('#combo-avg').textContent = f.avg;
  $('#combo-grade').textContent = f.grade;
  $('#combo-sources').innerHTML = ['face', 'palm', 'saju'].map(k => `<span class="${f.has[k] ? 'on' : ''}">${f.has[k] ? '✓ ' : ''}${SRC[k]}</span>`).join('');

  $('#combo-elems').innerHTML = f.sources.map(k => {
    const e = f.elems[k].key, E = ELEMENTS[e];
    return `<div class="elem-chip"><b>${SRC[k]}</b><div class="glyph" style="${glyphEl(e)}">${E.hanja}</div><span>${esc(elementLabel(k, c))}</span></div>`;
  }).join('');
  $('#combo-rels').innerHTML = f.pairs.map(p => {
    const cls = p.rel === 'same' ? '' : (p.rel === 'gen' || p.rel === 'genBy') ? 'gen' : 'ctrl';
    const arrow = p.rel === 'gen' ? '→' : p.rel === 'genBy' ? '←' : p.rel === 'ctrl' ? '⇢' : p.rel === 'ctrlBy' ? '⇠' : '＝';
    return `<div class="rel ${cls}"><b>${SRC[p.a]} ${ELEMENTS[p.ea].hanja}</b> ${arrow} <b>${SRC[p.b]} ${ELEMENTS[p.eb].hanja}</b> · ${REL_LABEL[p.rel]}</div>`;
  }).join('');

  $('#combo-fortunes').innerHTML = f.ranked.map(x => {
    const tag = x.agree ? `<span class="cf-tag agree">${f.sources.length === 3 ? '세' : '두'} 방면 일치</span>` : x.spread >= 14 ? '<span class="cf-tag diff">해석이 엇갈림</span>' : '';
    return `<div class="cf"><div class="cf-head"><span class="f-icon" aria-hidden="true">${ICON[x.key]}</span><b>${x.name}</b>${tag}<span class="cf-score">${x.combined}</span></div>
      <div class="meter gold"><i data-w="${x.combined}%" style="--w:0%"></i></div>
      <div class="cf-srcs">${f.sources.map(s => `<span class="${s === x.hi && x.spread >= 6 ? 'hi' : ''}">${SRC[s]}<b>${x.by[s]}</b></span>`).join('')}</div></div>`;
  }).join('');
  $('#combo-summary').innerHTML = f.summary.map(t => `<p>${esc(t)}</p>`).join('');
  $('#dl-face').disabled = !c.face; $('#dl-palm').disabled = !c.palm; $('#dl-saju').disabled = !c.saju;
  renderComboCharts(f, c);
  animate('#view-combo');
}

function animate(sel) {
  setTimeout(() => document.querySelectorAll(`${sel} [data-w]`).forEach(i => i.style.setProperty('--w', i.dataset.w)), 80);
}

// ── 종합 결과 카드(이미지) ───────────────────────────────────
export async function drawComboCard(f, c, palmCanvas) {
  await document.fonts?.ready;
  const W = 1080, PAD = 72, IW = W - PAD * 2;
  const serif = '"Noto Serif KR", serif', sans = '"Noto Sans KR", sans-serif';
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = `28px ${sans}`;
  const lead = wrapLines(ctx, f.summary[0], IW).slice(0, 5);
  const hasPalm = !!(c.palm && palmCanvas), hasSaju = !!c.saju;
  const PH = hasPalm ? 380 : 0;
  // 위에서부터 쌓이는 높이: 제목, 사주 글자, 세 오행, 종합 점수, 손바닥 사진, 요약 글, 다섯 운 막대, 맨 아래 안내
  const RS = 520;   // 레이더 그림 한 변
  const H = PAD + 150 + (hasSaju ? 300 : 0) + 200 + 150 + RS + 30 + (hasPalm ? PH + 40 : 0) + lead.length * 44 + 40 + f.ranked.length * 100 + 90;
  cv.width = W; cv.height = H;
  ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, W); g.addColorStop(0, 'rgba(255,178,77,0.2)'); g.addColorStop(1, 'rgba(255,178,77,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  let y = PAD;
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffb24d'; ctx.font = `900 54px ${serif}`;
  ctx.fillText('관상 · 손금 · 사주 종합', W / 2, y + 50);
  ctx.fillStyle = '#c8cbd6'; ctx.font = `500 26px ${sans}`;
  ctx.fillText(f.sources.map(k => SRC[k]).join(' + ') + ' 종합 결과', W / 2, y + 98);
  y += 150;

  if (hasSaju) {   // 사주 여덟 글자
    const P = c.saju.saju.pillars, cols = [[P.hour, '時'], [P.day, '日'], [P.month, '月'], [P.year, '年']];
    const cw = 200, gap = 26, x0 = (W - (cw * 4 + gap * 3)) / 2;
    cols.forEach(([p, lab], i) => {
      const x = x0 + i * (cw + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(ctx, x, y, cw, 270, 22); ctx.fill();
      if (lab === '日') { ctx.strokeStyle = 'rgba(255,178,77,0.8)'; ctx.lineWidth = 3; roundRect(ctx, x, y, cw, 270, 22); ctx.stroke(); }
      ctx.fillStyle = '#9aa1b4'; ctx.font = `500 24px ${sans}`; ctx.textAlign = 'center'; ctx.fillText(lab, x + cw / 2, y + 36);
      if (!p) { ctx.fillStyle = '#6f7689'; ctx.font = `700 60px ${serif}`; ctx.fillText('?', x + cw / 2, y + 160); return; }
      [[STEMS[p.stem], 50], [BRANCHES[p.branch], 150]].forEach(([it, oy]) => {
        ctx.fillStyle = elColor(it.el); roundRect(ctx, x + cw / 2 - 48, y + oy, 96, 96, 20); ctx.fill();
        ctx.fillStyle = '#10131c'; ctx.font = `900 62px ${serif}`; ctx.textBaseline = 'middle'; ctx.fillText(it.hanja, x + cw / 2, y + oy + 52); ctx.textBaseline = 'alphabetic';
      });
    });
    y += 300;
  }
  // 세 오행
  const n = f.sources.length, chipW = 260, cgap = 30, cx0 = (W - (chipW * n + cgap * (n - 1))) / 2;
  f.sources.forEach((k, i) => {
    const e = f.elems[k].key, x = cx0 + i * (chipW + cgap);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(ctx, x, y, chipW, 150, 22); ctx.fill();
    ctx.fillStyle = elColor(e); roundRect(ctx, x + 20, y + 25, 100, 100, 22); ctx.fill();
    ctx.fillStyle = '#10131c'; ctx.font = `900 64px ${serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ELEMENTS[e].hanja, x + 70, y + 78); ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#9aa1b4'; ctx.font = `500 24px ${sans}`; ctx.textAlign = 'left'; ctx.fillText(SRC[k], x + 136, y + 62);
    ctx.fillStyle = '#f4efe3'; ctx.font = `700 30px ${sans}`; ctx.fillText(`${ELEMENTS[e].name}(${ELEMENTS[e].hanja})`, x + 136, y + 104);
  });
  y += 200;
  // 종합 점수
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd08a'; ctx.font = `900 96px ${serif}`; ctx.fillText(`${f.avg}점`, W / 2, y + 60);
  ctx.fillStyle = '#e7e2d4'; ctx.font = `700 34px ${serif}`; ctx.fillText(f.grade, W / 2, y + 112);
  y += 150;
  {   // 인생 영역별 레이더 (세 방면과 종합을 겹쳐서)
    ctx.drawImage(comboRadarImage(f, RS), (W - RS) / 2, y, RS, RS);
    y += RS + 14;
    const items = [...f.sources.map(s => [SRC_COLOR[s], SRC[s]]), [SRC_COLOR.all, '종합']];
    ctx.font = `500 24px ${sans}`;
    const tw = items.map(([, t]) => ctx.measureText(t).width + 40), total = tw.reduce((a, b) => a + b, 0);
    let lx = (W - total) / 2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    items.forEach(([c, t], i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx + 8, y + 4, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c8cbd6'; ctx.fillText(t, lx + 24, y + 4); lx += tw[i]; });
    ctx.textBaseline = 'alphabetic';
    y += 16;
  }
  if (hasPalm) {
    const pw = Math.min(IW, PH * palmCanvas.width / palmCanvas.height), px = (W - pw) / 2;
    ctx.save(); roundRect(ctx, px, y, pw, PH, 26); ctx.clip(); ctx.drawImage(palmCanvas, px, y, pw, PH); ctx.restore();
    ctx.strokeStyle = 'rgba(255,178,77,0.7)'; ctx.lineWidth = 3; roundRect(ctx, px, y, pw, PH, 26); ctx.stroke();
    y += PH + 40;
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#c8cbd6'; ctx.font = `28px ${sans}`;
  for (const line of lead) { ctx.fillText(line, PAD, y + 30); y += 44; }
  y += 40;
  for (const x of f.ranked) {
    ctx.fillStyle = '#f4efe3'; ctx.font = `700 30px ${sans}`; ctx.textAlign = 'left'; ctx.fillText(`${ICON[x.key]} ${x.name}`, PAD, y + 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd08a'; ctx.fillText(`${x.combined}`, W - PAD, y + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, PAD, y + 46, IW, 14, 7); ctx.fill();
    ctx.fillStyle = '#ffb24d'; roundRect(ctx, PAD, y + 46, IW * x.combined / 100, 14, 7); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#7f8698'; ctx.font = `22px ${sans}`;
    ctx.fillText(f.sources.map(s => `${SRC[s]} ${x.by[s]}`).join('   '), PAD, y + 88);
    y += 100;
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#7f8698'; ctx.font = `22px ${sans}`;
  ctx.fillText('운명 판독기 · 오락용 결과이며 과학적 근거가 없습니다.', W / 2, H - 40);
  return cv;
}
