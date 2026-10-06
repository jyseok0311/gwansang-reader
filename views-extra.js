// ─────────────────────────────────────────────────────────────
//  오늘의 운세 · 올해·월별 운세 · 띠 · 별자리 화면과 오늘의 운세 카드
// ─────────────────────────────────────────────────────────────
import { dailyFortune, yearlyFortune, zodiacProfile, AREA_KEYS, AREA_NAMES, levelOf } from './fortune-time.js';
import { SRC_COLOR, mountChart, drawRadar, drawMonthly, drawBio } from './charts.js';
import { esc, $, wrapLines, roundRect } from './util.js';
import { biorhythm, CYCLES } from './biorhythm.js';
import { classifyAnimal, ANIMALS } from './animal-face.js';
import { computeMatch, MATCH_AXES } from './match.js';
import { computeSaju, interpretSaju } from './saju.js';

const ICON = { wealth: '🪙', love: '💞', career: '🏛️', health: '🌿', social: '🤝' };
const SHORT = { wealth: '재물', love: '애정', career: '직업', health: '건강', social: '대인' };
const AXES = AREA_KEYS.map(k => ({ key: k, label: SHORT[k] }));
const ANIMAL_EMOJI = { 쥐: '🐭', 소: '🐮', 호랑이: '🐯', 토끼: '🐰', 용: '🐲', 뱀: '🐍', 말: '🐴', 양: '🐑', 원숭이: '🐵', 닭: '🐔', 개: '🐶', 돼지: '🐷' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const LV_CLASS = { 대길: 'lv-top', 길: 'lv-good', 중길: 'lv-mid', 평: 'lv-flat', 조심: 'lv-low' };
const animate = (root) => setTimeout(() => document.querySelectorAll(`${root} [data-w]`).forEach(i => i.style.setProperty('--w', i.dataset.w)), 80);
const areaRows = (scores) => AREA_KEYS.map(k => {
  const sc = scores[k], lv = levelOf(sc);
  return `<div class="fortune"><div class="f-head"><span class="f-icon" aria-hidden="true">${ICON[k]}</span><b>${AREA_NAMES[k]}</b><span class="f-level ${sc >= 86 ? 'top' : ''}">${lv.hanja}</span><span class="f-score">${sc}</span></div>
    <div class="meter gold"><i data-w="${sc}%" style="--w:0%"></i></div></div>`;
}).join('');
const dateLabel = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
export const dayAt = (offset) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };

// ── 오늘 ─────────────────────────────────────────────────────
function renderToday(state, offset) {
  const date = offset === 0 ? new Date() : dayAt(offset);
  const r = dailyFortune(state, date);
  const label = offset === 0 ? '오늘' : offset === 1 ? '내일' : offset === -1 ? '어제' : (offset > 0 ? `${offset}일 뒤` : `${-offset}일 전`);
  const z = r.zodiac, a = r.aspect;
  $('#extra-today').innerHTML = `
    <div class="day-nav"><button type="button" data-d="${offset - 1}" aria-label="전날">◀</button>
      <div><b>${dateLabel(date)}</b><small>${label}${offset !== 0 ? ' · <a href="#" data-d="0">오늘로</a>' : ''}</small></div>
      <button type="button" data-d="${offset + 1}" aria-label="다음날">▶</button></div>
    <div class="combo-hero">
      <div class="combo-hero-label">${r.ganji}일 · 나의 ${esc(r.godInfo.name)}의 날</div>
      <div class="combo-score"><b>${r.avg}</b><span>점</span></div>
      <div class="combo-grade">${r.level.hanja} · ${r.level.ko}</div>
      <div class="combo-sources"><span class="on">${esc(r.godInfo.kw)}</span><span class="on">${esc(r.stage.name)}</span></div>
    </div>
    <h3 class="sec"><span>圖</span>영역별 운세</h3>
    <div class="chart-grid"><div class="chart-card"><canvas id="today-radar" class="chart radar" role="img"></canvas></div><div class="fortunes one">${areaRows(r.scores)}</div></div>
    <h3 class="sec"><span>解</span>오늘의 풀이</h3>
    <div class="summary">${r.texts.map(t => `<p>${esc(t)}</p>`).join('')}</div>
    <h3 class="sec"><span>吉</span>행운 포인트</h3>
    <div class="lucky">
      <div><small>행운의 색·방향</small><b>${esc(r.lucky.info.lucky)}</b></div>
      <div><small>행운의 숫자</small><b>${r.lucky.number}</b></div>
      <div><small>힘이 나는 시간</small><b>${esc(r.lucky.hours)}</b></div>
      <div><small>나를 돕는 기운</small><b style="color:${r.lucky.info.color}">${r.lucky.info.hanja} ${r.lucky.info.name}</b></div>
    </div>
    <h3 class="sec"><span>星</span>오늘의 별 흐름</h3>
    <div class="astro-card">
      <div class="astro-head"><span class="sym">${z.sign.sym}</span><div><b>${z.sign.name}</b><small>태양 별자리</small></div>
        <div class="astro-moon"><b>🌙 ${r.moon.sign.name}</b><small>${esc(r.moon.phase)}</small></div></div>
      <p><b>달과 나의 각도: ${esc(a.name)}</b>${a.orb != null ? ` (오차 ${a.orb}°)` : ''}<br>${esc(a.text)}</p>
      <p>${esc(r.moon.phaseText)}에는 ${esc(r.moon.phase.includes('보름') ? '감정이 커지니 말과 소비를 한 박자 늦추세요.' : r.moon.phase.includes('삭') || r.moon.phase.includes('그믐') ? '큰일을 벌이기보다 계획을 세우고 비우는 데 쓰세요.' : '하고 싶은 일을 차분히 이어 가기 좋습니다.')}</p>
    </div>`;
  const radar = $('#today-radar'), v = AREA_KEYS.map(k => r.scores[k]);
  radar.setAttribute('aria-label', '오늘의 영역별 점수: ' + AXES.map((x, i) => `${x.label} ${v[i]}점`).join(', '));
  mountChart(radar, (ctx, w, h, k) => drawRadar(ctx, w, h, k, { axes: AXES, series: [{ color: SRC_COLOR.all, values: v, glow: true }] }));
  animate('#extra-today');
  return r;
}

// ── 올해·월별 + 띠 ───────────────────────────────────────────
function renderYear(state, selMonth) {
  const now = new Date(), r = yearlyFortune(state, now);
  const curM = now.getMonth() + 1, sel = selMonth || curM, m = r.months[sel - 1];
  const za = r.zodiacAnimal, p = za.partners;
  const names = (arr) => (arr.length ? arr.join('·') : '-');
  $('#extra-year').innerHTML = `
    <div class="combo-hero">
      <div class="combo-hero-label">${r.year}년 ${r.ganji}년 · 나의 ${esc(r.godInfo.name)}의 해</div>
      <div class="combo-score"><b>${r.avg}</b><span>점</span></div>
      <div class="combo-grade">${r.level.hanja} · ${r.level.ko}</div>
      <div class="combo-sources"><span class="on">${esc(r.godInfo.kw)}</span><span class="on">${ANIMAL_EMOJI[za.animal]} ${za.animal}띠 · ${esc(za.title)}</span></div>
    </div>
    <h3 class="sec"><span>月</span>월별 운세 흐름</h3>
    <div class="chart-card wide"><canvas id="year-monthly" class="chart monthly" role="img"></canvas>
      <p class="chart-hint">월은 절기 기준의 간지(月建)로 읽었습니다. 점이 높을수록 그달의 흐름이 좋습니다.</p></div>
    <div class="month-grid">${r.months.map(x => `<button type="button" data-month="${x.month}" class="${LV_CLASS[x.level.ko]}${x.month === sel ? ' sel' : ''}${x.month === curM ? ' cur' : ''}"><small>${x.month}월</small><b>${x.avg}</b></button>`).join('')}</div>
    <div class="astro-card month-detail">
      <p><b>${sel}월 · ${esc(m.ganji)}월 (${esc(m.godInfo.name)}) · ${m.avg}점 ${m.level.ko}</b><br>${esc(m.favorable ? m.godInfo.fav : m.godInfo.unfav)}</p>
      <p>${AREA_KEYS.map(k => `${SHORT[k]} ${m.scores[k]}`).join(' · ')}</p>
    </div>
    <h3 class="sec"><span>解</span>올해의 풀이</h3>
    <div class="summary">${r.texts.map(t => `<p>${esc(t)}</p>`).join('')}</div>
    <h3 class="sec"><span>圖</span>올해 영역별 운세</h3>
    <div class="fortunes">${areaRows(r.scores)}</div>
    <h3 class="sec"><span>歲</span>${za.animal}띠 운세</h3>
    <div class="astro-card">
      <div class="astro-head"><span class="sym">${ANIMAL_EMOJI[za.animal]}</span><div><b>${za.animal}띠</b><small>${esc(za.desc)} 사람</small></div></div>
      <p><b>${esc(za.title)}</b> (${esc(za.relName)})<br>${esc(za.text)}</p>
      <p><b>잘 맞는 띠</b> ${esc(names([...p.samhap, ...p.yukhap]))}<br><b>부딪히기 쉬운 띠</b> ${esc(names([...p.chung, ...p.hae]))}</p>
    </div>`;
  const mc = $('#year-monthly'), vals = r.months.map(x => x.avg);
  mc.setAttribute('aria-label', '월별 운세 점수: ' + r.months.map(x => `${x.month}월 ${x.avg}점`).join(', '));
  mountChart(mc, (ctx, w, h, k) => drawMonthly(ctx, w, h, k, { values: vals, current: curM, selected: sel }));
  animate('#extra-year');
  return r;
}

// ── 별자리 ───────────────────────────────────────────────────
function renderZodiac(state) {
  const z = zodiacProfile(state), s = z.sign, a = state.reading.animal;
  $('#extra-zodiac').innerHTML = `
    <div class="combo-hero zodiac-hero">
      <div class="zodiac-sym">${s.sym}</div>
      <div class="combo-score"><b style="font-size:2.4rem">${s.name}</b></div>
      <div class="combo-grade">${s.dates} · ${s.kw}</div>
      <div class="combo-sources"><span class="on">${s.elKo}(${{ fire: '火', earth: '土', air: '風', water: '水' }[s.el]})</span><span class="on">${s.mode}궁</span><span class="on">수호성 ${esc(s.ruler)}</span></div>
    </div>
    ${z.nearBoundary ? `<p class="note">${esc(z.boundaryNote)}</p>` : ''}
    <h3 class="sec"><span>性</span>${s.name}의 성격</h3>
    <div class="summary"><p>${esc(s.text)}</p>
      <p><b>연애</b> ${esc(s.love)}</p><p><b>일</b> ${esc(s.career)}</p><p><b>조심할 점</b> ${esc(s.caution)}</p></div>
    <h3 class="sec"><span>合</span>잘 맞는 별자리</h3>
    <div class="compat">
      <div><small>가장 잘 맞음 (같은 ${s.elKo} 기운)</small><b>${esc(z.best.join(' · '))}</b></div>
      <div><small>잘 맞음</small><b>${esc(z.good.join(' · '))}</b></div>
      <div><small>끌리는 상대</small><b>${esc(z.attract.join(' · '))}</b></div>
      <div><small>긴장되는 사이</small><b>${esc(z.tense.join(' · '))}</b></div>
    </div>
    <h3 class="sec"><span>統</span>별자리 × 띠 × 사주</h3>
    <div class="summary"><p>${s.name}(${s.elKo})에 ${a}띠, 사주 일간은 ${esc(state.reading.dayMaster.ko)}${esc(state.reading.dayMaster.elName.ko)}(${state.reading.dayMaster.hanja})입니다. 별자리는 태어난 계절의 태양 위치, 띠는 태어난 해, 사주는 태어난 때 전체를 바탕으로 한 서로 다른 전통이라 같은 사람에게도 다른 면을 비춥니다. 세 가지에서 겹치는 성향이 있다면 그것이 가장 뚜렷한 당신의 특징입니다.</p></div>`;
  animate('#extra-zodiac');
  return z;
}

// ── 바이오리듬 ───────────────────────────────────────────────
const PHASE_KO = { high: '정점', rising: '상승', critical: '전환(주의)', falling: '하강', low: '저점' };
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getMonth() + 1}/${d.getDate()}`; };
function renderBio(state) {
  const r = biorhythm(state.saju.solar, new Date());
  $('#extra-bio').innerHTML = `
    <div class="combo-hero">
      <div class="combo-hero-label">태어난 지 ${r.daysAlive.toLocaleString('ko-KR')}일째 · 오늘의 바이오리듬</div>
      <div class="combo-score"><b>${r.avg}</b><span>%</span></div>
      <div class="combo-grade">${esc(r.level)}</div>
      <div class="combo-sources">${r.now.map(c => `<span class="on" style="border-color:${c.color}66">${c.name} ${c.value}%</span>`).join('')}</div>
    </div>
    <h3 class="sec"><span>圖</span>앞뒤 한 달의 흐름</h3>
    <div class="chart-card wide"><canvas id="bio-chart" class="chart bio" role="img"></canvas>
      <div class="chart-legend">${CYCLES.map(c => `<span><i style="background:${c.color}"></i>${c.name} ${c.period}일</span>`).join('')}</div>
      <p class="chart-hint">0%선을 지나는 날이 전환일입니다. 세로 점선이 오늘이고, 위로 갈수록 좋은 컨디션입니다.</p></div>
    <h3 class="sec"><span>今</span>오늘의 상태</h3>
    <div class="bio-list">${r.now.map(c => `<div class="bio-row"><div class="bio-head"><b style="color:${c.color}">${c.name}</b><small>${esc(c.about)}</small><span class="bio-val">${c.value}%</span><em>${PHASE_KO[c.phase]}</em></div>
      <div class="bio-track"><i style="left:${(c.value + 100) / 2}%;background:${c.color}"></i></div><p>${esc(c.text)}</p></div>`).join('')}</div>
    <h3 class="sec"><span>解</span>풀이</h3>
    <div class="summary">${r.texts.map(t => `<p>${esc(t)}</p>`).join('')}</div>
    <h3 class="sec"><span>期</span>다음 정점 · 저점 · 전환일</h3>
    <div class="bio-next">${CYCLES.map(c => { const n = r.next[c.key]; return `<div><b style="color:${c.color}">${c.name}</b>
      <span>정점 ${n.high ? addDays(n.high) + ` (${n.high}일 뒤)` : '-'}</span><span>저점 ${n.low ? addDays(n.low) + ` (${n.low}일 뒤)` : '-'}</span><span>전환 ${n.critical ? addDays(n.critical) + ` (${n.critical}일 뒤)` : '-'}</span></div>`; }).join('')}</div>`;
  const cv = $('#bio-chart');
  cv.setAttribute('aria-label', '바이오리듬: ' + r.now.map(c => `${c.name} ${c.value}%`).join(', '));
  mountChart(cv, (ctx, w, h, k) => drawBio(ctx, w, h, k, { series: r.series, cycles: CYCLES }));
  return r;
}

// ── 동물상 ───────────────────────────────────────────────────
function renderAnimal(face) {
  const root = $('#extra-animal');
  if (!face) {
    root.innerHTML = `<div class="astro-card"><p>동물상은 얼굴 사진으로 봅니다. 관상 촬영(또는 사진 올리기)을 마치면 같은 측정값으로 닮은 동물을 찾아 드립니다.</p>
      <p><button class="primary" type="button" data-capture="face">📷 얼굴 촬영하기</button></p></div>`;
    return null;
  }
  const r = classifyAnimal(face.features), A = r.primary, S = r.secondary;
  root.innerHTML = `
    <div class="combo-hero zodiac-hero">
      <canvas id="animal-photo" class="animal-photo" aria-label="내 얼굴 사진"></canvas>
      <div class="zodiac-sym">${A.emoji}</div>
      <div class="combo-score"><b style="font-size:2.4rem">${A.name}</b></div>
      <div class="combo-grade">${esc(A.kw)} · 닮은 정도 ${r.similar}%</div>
      <div class="combo-sources"><span class="on">2순위 ${S.emoji} ${S.name}</span></div>
    </div>
    ${r.reasons.length ? `<p class="note">이런 특징이 ${A.name}으로 이끌었어요: <b>${esc(r.reasons.join(' · '))}</b> 얼굴</p>` : ''}
    <h3 class="sec"><span>比</span>동물상 비율</h3>
    <div class="fortunes one">${r.weights.slice(0, 5).map(w => `<div class="fortune"><div class="f-head"><span class="f-icon" aria-hidden="true">${w.animal.emoji}</span><b>${w.animal.name}</b><span class="f-score">${w.pct}%</span></div>
      <div class="meter gold"><i data-w="${Math.min(100, w.pct * 2.2)}%" style="--w:0%"></i></div></div>`).join('')}</div>
    <h3 class="sec"><span>貌</span>${A.name}은 이런 사람</h3>
    <div class="summary"><p>${esc(A.desc)}</p><p><b>매력</b> ${esc(A.charm)}</p><p><b>성향</b> ${esc(A.trait)}</p><p><b>어울리는 스타일</b> ${esc(A.style)}</p><p><b>연애</b> ${esc(A.love)}</p><p><b>조심할 점</b> ${esc(A.caution)}</p></div>
    <h3 class="sec"><span>合</span>잘 어울리는 동물상</h3>
    <div class="compat">${A.match.map(k => `<div><small>${ANIMALS[k].emoji} ${ANIMALS[k].name}</small><b>${esc(ANIMALS[k].kw)}</b></div>`).join('')}</div>
    <p class="chart-hint" style="text-align:center">눈꼬리·눈 크기·얼굴 길이·턱선 등 측정값을 여덟 동물의 대표 특징과 비교한 오락용 결과입니다.</p>`;
  // 얼굴 사진: 관상 결과 화면에 그려 둔 사진을 둥글게 가져온다 (기기 밖으로 나가지 않는다)
  const src = $('#result-photo'), cv = $('#animal-photo');
  if (src && src.width) { const sz = 144; cv.width = sz; cv.height = sz; const c = cv.getContext('2d'), sc = Math.max(sz / src.width, sz / src.height); c.drawImage(src, (sz - src.width * sc) / 2, (sz - src.height * sc) / 2 * 0.6, src.width * sc, src.height * sc); }
  animate('#extra-animal');
  return r;
}

// ── 궁합 ─────────────────────────────────────────────────────
function partnerFormHtml() {
  const yr = new Date().getFullYear();
  const opt = (a, f) => Array.from({ length: a.n }, (_, i) => f(a.start + (a.up ? i : -i))).join('');
  return `<form id="pm-form" class="pm-form" autocomplete="off" novalidate>
    <label class="pm-field">상대 이름 (선택)<input id="pm-name" type="text" maxlength="8" placeholder="예: 지은"></label>
    <fieldset class="seg"><legend class="sr">양력 음력</legend>
      <label><input type="radio" name="pcal" value="solar" checked><span>양력</span></label><label><input type="radio" name="pcal" value="lunar"><span>음력</span></label></fieldset>
    <div class="field-row">
      <select id="pm-year" aria-label="출생 연도"><option value="">년</option>${opt({ n: yr - 1929, start: yr, up: false }, y => `<option value="${y}">${y}년</option>`)}</select>
      <select id="pm-month" aria-label="출생 월"><option value="">월</option>${opt({ n: 12, start: 1, up: true }, m => `<option value="${m}">${m}월</option>`)}</select>
      <select id="pm-day" aria-label="출생 일"><option value="">일</option></select>
    </div>
    <label id="pm-leapwrap" class="check hidden"><input type="checkbox" id="pm-leap"><span>윤달(閏月)입니다</span></label>
    <div class="field-row"><input id="pm-time" type="time" value="12:00" disabled aria-label="태어난 시간"><label class="check"><input type="checkbox" id="pm-timeunknown" checked><span>시간을 몰라요</span></label></div>
    <p id="pm-error" class="form-error hidden" role="alert"></p>
    <button class="primary big" type="submit">궁합 보기</button>
    <p class="chart-hint">입력한 생년월일은 이 기기 안에서 계산에만 쓰이고 저장·전송되지 않습니다.</p></form>`;
}
function bindPartnerForm(onPartner) {
  const f = $('#pm-form'); if (!f) return;
  const $$ = (id) => f.querySelector(id), cal = () => (f.elements.pcal.value === 'lunar' ? 'lunar' : 'solar');
  const days = () => {
    const y = +$$('#pm-year').value || 2000, m = +$$('#pm-month').value || 1, max = cal() === 'lunar' ? 30 : new Date(y, m, 0).getDate(), cur = $$('#pm-day').value;
    $$('#pm-day').innerHTML = '<option value="">일</option>' + Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join('');
    if (cur && +cur <= max) $$('#pm-day').value = cur;
  };
  days();
  f.addEventListener('change', (e) => {
    if (e.target.id === 'pm-year' || e.target.id === 'pm-month' || e.target.name === 'pcal') days();
    if (e.target.name === 'pcal') { $$('#pm-leapwrap').classList.toggle('hidden', cal() !== 'lunar'); if (cal() !== 'lunar') $$('#pm-leap').checked = false; }
    if (e.target.id === 'pm-timeunknown') $$('#pm-time').disabled = e.target.checked;
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $$('#pm-error'); err.classList.add('hidden');
    const year = +$$('#pm-year').value, month = +$$('#pm-month').value, day = +$$('#pm-day').value;
    const fail = (m) => { err.textContent = m; err.classList.remove('hidden'); };
    if (!year || !month || !day) return fail('상대의 생년월일을 모두 선택해 주세요.');
    let hour = null, minute = 0;
    if (!$$('#pm-timeunknown').checked) { const t = /^(\d{1,2}):(\d{2})$/.exec($$('#pm-time').value || ''); if (!t) return fail('태어난 시간을 입력하거나 "시간을 몰라요"를 선택해 주세요.'); hour = +t[1]; minute = +t[2]; }
    try {
      const saju = computeSaju({ year, month, day, calendar: cal(), leap: cal() === 'lunar' && $$('#pm-leap').checked, hour, minute });
      onPartner({ name: ($$('#pm-name').value || '').trim() || '상대', state: { saju, reading: interpretSaju(saju) } });
    } catch (ex) { fail(ex.message || '사주를 계산하지 못했습니다.'); }
  });
}
function renderMatch(ctx) {
  const root = $('#extra-match'), P = ctx.partner;
  if (!P) {
    root.innerHTML = `<div class="astro-card"><p>상대의 생년월일을 입력하면 두 사람의 사주·띠·별자리를 비교해 궁합을 풀이합니다.</p></div>${partnerFormHtml()}`;
    bindPartnerForm(ctx.onPartner);
    return null;
  }
  const r = computeMatch(ctx.saju, P.state, { a: '나', b: P.name });
  root.innerHTML = `
    <div class="combo-hero">
      <div class="combo-hero-label">나 ♥ ${esc(P.name)}</div>
      <div class="combo-score"><b>${r.total}</b><span>점</span></div>
      <div class="combo-grade">${esc(r.grade.name)}</div>
      <div class="combo-sources"><span class="on">${esc(r.best)} 좋음</span><span class="on">${esc(r.worst)} 신경</span></div>
    </div>
    <h3 class="sec"><span>圖</span>다섯 가지 궁합</h3>
    <div class="chart-grid"><div class="chart-card"><canvas id="match-radar" class="chart radar" role="img"></canvas></div>
      <div class="fortunes one">${MATCH_AXES.map(x => `<div class="fortune"><div class="f-head"><b>${x.label}</b><small class="f-sub">${{ heart: '일간', life: '일지', fate: '띠', balance: '오행 보완', star: '별자리' }[x.key]}</small><span class="f-score">${r.axes[x.key]}</span></div>
        <div class="meter gold"><i data-w="${r.axes[x.key]}%" style="--w:0%"></i></div></div>`).join('')}</div></div>
    <h3 class="sec"><span>解</span>궁합 풀이</h3>
    <div class="summary">${r.texts.map(t => `<p>${esc(t)}</p>`).join('')}</div>
    <div class="pm-actions"><button class="ghost" type="button" id="pm-reset">↺ 다른 사람과 궁합 보기</button></div>`;
  const radar = $('#match-radar'), v = MATCH_AXES.map(x => r.axes[x.key]);
  radar.setAttribute('aria-label', '궁합 점수: ' + MATCH_AXES.map((x, i) => `${x.label} ${v[i]}점`).join(', '));
  mountChart(radar, (c, w, h, k) => drawRadar(c, w, h, k, { axes: MATCH_AXES.map(x => ({ label: x.label })), series: [{ color: '#ff6ad5', values: v, glow: true }] }));
  $('#pm-reset').addEventListener('click', ctx.onPartnerReset);
  animate('#extra-match');
  return r;
}

const TABS = ['today', 'year', 'zodiac', 'bio', 'match', 'animal'];
const SAVE_LABEL = { today: '💾 오늘 카드 저장', match: '💾 궁합 카드 저장', animal: '💾 동물상 카드 저장' };
/** @param ctx { saju, face, partner, onPartner, onPartnerReset } */
export function renderExtra(ctx, { tab = 'today', offset = 0, month = null } = {}) {
  $('#extra-tabs').querySelectorAll('button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); if (on) b.scrollIntoView?.({ inline: 'center', block: 'nearest' }); });
  for (const t of TABS) $('#extra-' + t).classList.toggle('hidden', t !== tab);
  const save = $('#extra-save');
  const canSave = tab === 'today' || (tab === 'match' && ctx.partner) || (tab === 'animal' && ctx.face);
  save.classList.toggle('hidden', !canSave); if (SAVE_LABEL[tab]) save.textContent = SAVE_LABEL[tab];
  if (tab === 'today') return renderToday(ctx.saju, offset);
  if (tab === 'year') return renderYear(ctx.saju, month);
  if (tab === 'zodiac') return renderZodiac(ctx.saju);
  if (tab === 'bio') return renderBio(ctx.saju);
  if (tab === 'match') return renderMatch(ctx);
  return renderAnimal(ctx.face);
}

// ── 결과 카드 (저장·공유용 이미지) ───────────────────────────
const W = 1080, PAD = 72, serif = '"Noto Serif KR", serif', sans = '"Noto Sans KR", sans-serif';
/** 공통 카드: 제목·부제·큰 글자(숫자나 이모지)·한 줄 설명·문단·막대 여러 개·마지막 줄 */
async function drawCard({ title, sub, big, bigFont = 190, bigSub, para, bars = [], extra }) {
  await document.fonts?.ready;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = `28px ${sans}`;
  const lines = wrapLines(ctx, para, W - PAD * 2).slice(0, 5);
  const H = 150 + 300 + lines.length * 44 + 50 + bars.length * 92 + (extra ? 100 : 20) + 90;
  cv.width = W; cv.height = H;
  ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, W); g.addColorStop(0, 'rgba(255,178,77,0.2)'); g.addColorStop(1, 'rgba(255,178,77,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  let y = PAD;
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffb24d'; ctx.font = `900 54px ${serif}`; ctx.fillText(title, W / 2, y + 52);
  ctx.fillStyle = '#c8cbd6'; ctx.font = `500 28px ${sans}`; ctx.fillText(sub, W / 2, y + 104);
  y += 150;
  ctx.fillStyle = '#ffd08a'; ctx.font = `900 ${bigFont}px ${serif}`; ctx.textBaseline = 'alphabetic'; ctx.fillText(big, W / 2, y + 170);
  ctx.fillStyle = '#e7e2d4'; ctx.font = `700 40px ${serif}`; ctx.fillText(bigSub, W / 2, y + 240);
  y += 300;
  ctx.textAlign = 'left'; ctx.fillStyle = '#c8cbd6'; ctx.font = `28px ${sans}`;
  for (const l of lines) { ctx.fillText(l, PAD, y + 30); y += 44; }
  y += 50;
  for (const b of bars) {
    ctx.fillStyle = '#f4efe3'; ctx.font = `700 30px ${sans}`; ctx.textAlign = 'left'; ctx.fillText(b.label, PAD, y + 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd08a'; ctx.fillText(b.text, W - PAD, y + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, PAD, y + 48, W - PAD * 2, 14, 7); ctx.fill();
    ctx.fillStyle = '#ffb24d'; roundRect(ctx, PAD, y + 48, Math.max(8, (W - PAD * 2) * b.frac), 14, 7); ctx.fill();
    y += 92;
  }
  if (extra) { y += 20; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd08a'; ctx.font = `500 30px ${sans}`; ctx.fillText(extra, W / 2, y + 40); }
  ctx.textAlign = 'center'; ctx.fillStyle = '#7f8698'; ctx.font = `22px ${sans}`; ctx.fillText('운명 판독기 · 오락용 결과이며 과학적 근거가 없습니다.', W / 2, H - 40);
  return cv;
}

export async function drawTodayCard(state, offset = 0) {
  const date = offset === 0 ? new Date() : dayAt(offset), r = dailyFortune(state, date);
  return drawCard({
    title: '오늘의 운세', sub: `${dateLabel(date)} · ${r.ganji}일`, big: String(r.avg), bigSub: `${r.level.hanja} · ${r.level.ko}  |  ${r.godInfo.name}`, para: r.texts[0],
    bars: AREA_KEYS.map(k => ({ label: `${ICON[k]} ${AREA_NAMES[k]}`, text: String(r.scores[k]), frac: r.scores[k] / 100 })),
    extra: `행운의 색·방향 ${r.lucky.info.lucky}  ·  숫자 ${r.lucky.number}`,
  });
}
export async function drawMatchCard(ctx) {
  const P = ctx.partner, r = computeMatch(ctx.saju, P.state, { a: '나', b: P.name });
  return drawCard({
    title: '우리의 궁합', sub: `나 ♥ ${P.name}`, big: String(r.total), bigSub: r.grade.name, para: `${r.texts[0]} ${r.texts[r.texts.length - 1]}`,
    bars: MATCH_AXES.map(x => ({ label: x.label, text: String(r.axes[x.key]), frac: r.axes[x.key] / 100 })),
  });
}
export async function drawAnimalCard(face) {
  const r = classifyAnimal(face.features), A = r.primary;
  return drawCard({
    title: '나의 동물상', sub: A.kw, big: A.emoji, bigFont: 170, bigSub: `${A.name} · 닮은 정도 ${r.similar}%`, para: A.desc,
    bars: r.weights.slice(0, 3).map(w => ({ label: `${w.animal.emoji} ${w.animal.name}`, text: `${w.pct}%`, frac: Math.min(1, w.pct * 2.2 / 100) })),
    extra: r.reasons.length ? `특징: ${r.reasons.join(' · ')}` : '',
  });
}
