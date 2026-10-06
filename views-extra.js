// ─────────────────────────────────────────────────────────────
//  오늘의 운세 · 올해·월별 운세 · 띠 · 별자리 화면과 오늘의 운세 카드
// ─────────────────────────────────────────────────────────────
import { dailyFortune, yearlyFortune, zodiacProfile, AREA_KEYS, AREA_NAMES, levelOf } from './fortune-time.js';
import { SRC_COLOR, mountChart, drawRadar, drawMonthly } from './charts.js';
import { esc, $, wrapLines, roundRect } from './util.js';

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

export function renderExtra(state, { tab = 'today', offset = 0, month = null } = {}) {
  $('#extra-tabs').querySelectorAll('button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  for (const t of ['today', 'year', 'zodiac']) $('#extra-' + t).classList.toggle('hidden', t !== tab);
  $('#extra-save').classList.toggle('hidden', tab !== 'today');
  if (tab === 'today') return renderToday(state, offset);
  if (tab === 'year') return renderYear(state, month);
  return renderZodiac(state);
}

// ── 오늘의 운세 카드 (저장·공유용 이미지) ────────────────────
export async function drawTodayCard(state, offset = 0) {
  await document.fonts?.ready;
  const date = offset === 0 ? new Date() : dayAt(offset), r = dailyFortune(state, date);
  const W = 1080, PAD = 72, serif = '"Noto Serif KR", serif', sans = '"Noto Sans KR", sans-serif';
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = `28px ${sans}`;
  const lines = wrapLines(ctx, r.texts[0], W - PAD * 2).slice(0, 4);
  const H = 160 + 380 + lines.length * 44 + 40 + 5 * 92 + 190 + 80;
  cv.width = W; cv.height = H;
  ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, W); g.addColorStop(0, 'rgba(255,178,77,0.2)'); g.addColorStop(1, 'rgba(255,178,77,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  let y = PAD;
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffb24d'; ctx.font = `900 54px ${serif}`; ctx.fillText('오늘의 운세', W / 2, y + 52);
  ctx.fillStyle = '#c8cbd6'; ctx.font = `500 28px ${sans}`; ctx.fillText(`${dateLabel(date)} · ${r.ganji}일`, W / 2, y + 104);
  y += 150;
  ctx.fillStyle = '#ffd08a'; ctx.font = `900 190px ${serif}`; ctx.fillText(String(r.avg), W / 2, y + 170);
  ctx.fillStyle = '#e7e2d4'; ctx.font = `700 40px ${serif}`; ctx.fillText(`${r.level.hanja} · ${r.level.ko}  |  ${r.godInfo.name}`, W / 2, y + 240);
  y += 300;
  ctx.textAlign = 'left'; ctx.fillStyle = '#c8cbd6'; ctx.font = `28px ${sans}`;
  for (const l of lines) { ctx.fillText(l, PAD, y + 30); y += 44; }
  y += 50;
  for (const k of AREA_KEYS) {
    ctx.fillStyle = '#f4efe3'; ctx.font = `700 30px ${sans}`; ctx.textAlign = 'left'; ctx.fillText(`${ICON[k]} ${AREA_NAMES[k]}`, PAD, y + 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd08a'; ctx.fillText(String(r.scores[k]), W - PAD, y + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, PAD, y + 48, W - PAD * 2, 14, 7); ctx.fill();
    ctx.fillStyle = '#ffb24d'; roundRect(ctx, PAD, y + 48, (W - PAD * 2) * r.scores[k] / 100, 14, 7); ctx.fill();
    y += 92;
  }
  y += 20; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd08a'; ctx.font = `500 30px ${sans}`;
  ctx.fillText(`행운의 색·방향 ${r.lucky.info.lucky}  ·  숫자 ${r.lucky.number}`, W / 2, y + 40);
  ctx.fillStyle = '#7f8698'; ctx.font = `22px ${sans}`; ctx.fillText('운명 판독기 · 오락용 결과이며 과학적 근거가 없습니다.', W / 2, H - 40);
  return cv;
}
