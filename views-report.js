// ─────────────────────────────────────────────────────────────
//  종합 결과 화면의 통합 리포트: 링 게이지, 통합 총평, 프로필, 지금의 흐름(영역 비교·시간대·월별·바이오리듬), 실천 목록
// ─────────────────────────────────────────────────────────────
import { SRC_COLOR, mountChart, drawRings, drawColumns, drawMonthly } from './charts.js';
import { esc, $ } from './util.js';

const MISSING = [
  ['animal', '獸', '동물상', '관상 촬영 결과로 닮은 동물을 찾아요'], ['mbti', '性', 'MBTI', '20문항 간이 검사로 성향을 알아봐요'],
  ['tarot', '牌', '타로', '오늘 뽑은 카드가 총평에 곁들여져요'], ['match', '合', '궁합', '상대 생년월일로 궁합을 풀이해요'],
];

/** @param rp buildReport() 결과 */
export function renderReport(rp) {
  // 1) 링 게이지 히어로
  const rings = [{ value: rp.total.score, color: SRC_COLOR.all, min: 40 }, { value: rp.base.score, color: SRC_COLOR.face, min: 40 }];
  if (rp.flow) rings.push({ value: rp.flow.score, color: SRC_COLOR.palm, min: 40 });
  const cv = $('#rp-rings');
  cv.setAttribute('aria-label', `종합 지수 ${rp.total.score}점, 타고난 바탕 ${rp.base.score}점${rp.flow ? `, 지금의 흐름 ${rp.flow.score}점` : ''}`);
  mountChart(cv, (ctx, w, h, k) => drawRings(ctx, w, h, k, { rings, center: String(rp.total.score), centerSub: '종합 지수', min: 40, max: 100 }), { dur: 1100 });
  $('#combo-hero-label').textContent = rp.flow ? '종합 리포트 · 바탕 + 흐름' : '종합 리포트';
  $('#combo-grade').textContent = `${rp.total.level.hanja} · ${rp.total.level.ko}`;
  $('#rp-legend').innerHTML = [[SRC_COLOR.all, '종합', rp.total.score], [SRC_COLOR.face, '타고난 바탕', rp.base.score], ...(rp.flow ? [[SRC_COLOR.palm, '지금의 흐름', rp.flow.score]] : [])]
    .map(([c, t, v]) => `<span><i style="background:${c}"></i>${t} <b>${v}</b></span>`).join('');
  const inc = [['saju', '사주'], ['face', '관상'], ['palm', '손금'], ['saju', '별자리'], ['saju', '띠'], ['animal', '동물상'], ['mbti', 'MBTI'], ['saju', '오늘'], ['saju', '올해'], ['saju', '바이오리듬'], ['tarot', '타로'], ['partner', '궁합']];
  $('#combo-sources').innerHTML = inc.map(([k, t]) => `<span class="${rp.has[k] ? 'on' : ''}">${rp.has[k] ? '✓ ' : ''}${t}</span>`).join('');

  // 2) 통합 총평
  $('#rp-summary').innerHTML = rp.texts.map(t => `<p>${esc(t)}</p>`).join('');

  // 3) 프로필
  $('#rp-profile').innerHTML = rp.profile.map(p => `<div class="rp-tile" style="--c:${p.color}"><div class="rp-glyph${p.small ? ' small' : ''}" aria-hidden="true">${esc(p.glyph)}</div><div><b>${esc(p.title)}</b><small>${esc(p.sub)}</small></div></div>`).join('');

  // 4) 지금의 흐름
  const flowEl = $('#rp-flow');
  if (!rp.flow) { flowEl.innerHTML = ''; flowEl.classList.add('hidden'); }
  else {
    flowEl.classList.remove('hidden');
    flowEl.innerHTML = `
      <h3 class="sec"><span>比</span>영역별: 바탕 · 올해 · 오늘</h3>
      <div class="chart-card wide"><canvas id="rp-areas" class="chart cols" role="img"></canvas>
        <div class="chart-legend"><span><i style="background:${SRC_COLOR.face}"></i>타고난 바탕</span><span><i style="background:${SRC_COLOR.palm}"></i>올해</span><span><i style="background:${SRC_COLOR.all}"></i>오늘</span></div></div>
      <h3 class="sec"><span>時</span>오늘 하루의 시간대 흐름</h3>
      <div class="chart-card wide"><canvas id="rp-hours" class="chart cols tall" role="img"></canvas>
        <p class="chart-hint">열두 시진의 기운을 내 일간과 비교한 점수입니다. 빛나는 막대가 지금 시간이고, 가장 높은 시간은 ${esc(rp.hourly.best.name)}(${esc(rp.hourly.best.range)}시)입니다.</p></div>
      <h3 class="sec"><span>月</span>올해의 월별 흐름</h3>
      <div class="chart-card wide"><canvas id="rp-months" class="chart monthly" role="img"></canvas></div>
      <h3 class="sec"><span>律</span>오늘의 바이오리듬</h3>
      <div class="chart-grid"><div class="chart-card"><canvas id="rp-bio" class="chart radar" role="img"></canvas></div>
        <div class="bio-list">${rp.bio.now.map(c => `<div class="bio-row"><div class="bio-head"><b style="color:${c.color}">${c.name}</b><small>${c.about}</small><span class="bio-val">${c.value}%</span></div><p>${esc(c.text)}</p></div>`).join('')}</div></div>`;
    const mix = rp.areaMix, labels = mix.map(m => m.name.replace('운', '').replace('관계', '').replace('·명예', ''));
    const areas = $('#rp-areas'); areas.setAttribute('aria-label', '영역별 점수: ' + mix.map(m => `${m.name} 바탕 ${m.base} 올해 ${m.year} 오늘 ${m.today}`).join(', '));
    mountChart(areas, (ctx, w, h, k) => drawColumns(ctx, w, h, k, { labels, min: 40, max: 100, series: [{ color: SRC_COLOR.face, values: mix.map(m => m.base) }, { color: SRC_COLOR.palm, values: mix.map(m => m.year) }, { color: SRC_COLOR.all, values: mix.map(m => m.today) }] }));
    const hrs = $('#rp-hours'); hrs.setAttribute('aria-label', '시간대별 점수: ' + rp.hourly.hours.map(x => `${x.name} ${x.avg}`).join(', '));
    mountChart(hrs, (ctx, w, h, k) => drawColumns(ctx, w, h, k, { labels: rp.hourly.hours.map(x => x.name.replace('시', '')), min: 50, max: 95, highlight: rp.hourly.nowIdx, series: [{ color: SRC_COLOR.all, values: rp.hourly.hours.map(x => x.avg) }] }));
    const mo = $('#rp-months'); mo.setAttribute('aria-label', '월별 점수: ' + rp.chartMonths.map((v, i) => `${i + 1}월 ${v}`).join(', '));
    mountChart(mo, (ctx, w, h, k) => drawMonthly(ctx, w, h, k, { values: rp.chartMonths, current: rp.currentMonth, selected: rp.currentMonth }));
    const bio = $('#rp-bio'); bio.setAttribute('aria-label', '바이오리듬: ' + rp.bio.now.map(c => `${c.name} ${c.value}%`).join(', '));
    mountChart(bio, (ctx, w, h, k) => drawRings(ctx, w, h, k, { rings: rp.bio.now.map(c => ({ value: c.value, color: c.color, min: -100, max: 100 })), center: `${rp.bio.avg}%`, centerSub: '평균', min: -100, max: 100 }), { dur: 1000 });
  }

  // 5) 더하면 풍부해지는 것
  const miss = MISSING.filter(([k]) => !rp.has[k === 'match' ? 'partner' : k]);
  $('#rp-more').innerHTML = miss.length ? `<h3 class="sec"><span>增</span>더하면 총평이 풍부해져요</h3><div class="rp-more">${miss.map(([k, g, t, d]) => `<button type="button" class="rp-add" data-open-extra="${k}"><b>${g}</b><span><strong>${t}</strong><small>${d}</small></span></button>`).join('')}</div>` : '';

  // 6) 실천
  $('#rp-actions').innerHTML = rp.actions.map(a => `<div class="rp-act"><span class="ic" aria-hidden="true">${a.icon}</span><div><b>${esc(a.title)}</b><p>${esc(a.text)}</p></div></div>`).join('');
}
