// ─────────────────────────────────────────────────────────────
//  통합 리포트 (오락용): 관상·손금·사주(타고난 바탕)에 별자리·띠·동물상·MBTI(성향)와
//  오늘·올해·월별·바이오리듬·타로·궁합(지금의 흐름)을 한데 모아 하나의 총평으로 읽는다.
//  - 바탕 지수: 관상·손금·사주를 합친 점수(없으면 사주만).
//  - 흐름 지수: 오늘 40% · 올해 35% · 바이오리듬 25%.   - 종합 지수: 바탕 65% + 흐름 35%.
//  타로·궁합·MBTI·동물상은 점수에 넣지 않고 풀이에만 곁들인다(무작위·자기보고·재미 요소라서).
// ─────────────────────────────────────────────────────────────
import { dailyFortune, yearlyFortune, zodiacProfile, hourlyFortune, levelOf, AREA_KEYS, AREA_NAMES } from './fortune-time.js';
import { biorhythm } from './biorhythm.js';
import { classifyAnimal } from './animal-face.js';
import { computeMatch } from './match.js';
import { TYPES } from './mbti.js';
import { EL } from './saju.js';
import { clamp } from './util.js';
import { josa } from './physiognomy.js';

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const ADVICE = {
  wealth: '지출을 한 번 기록해 보고 큰 결정은 하루 미루세요.', love: '고마운 마음을 먼저 말로 표현해 보세요.', career: '작은 목표 하나를 정해 오늘 안에 끝내 보세요.',
  health: '수면과 식사 시간을 지키고 가볍게 몸을 움직이세요.', social: '먼저 안부를 묻는 연락을 한 통 보내 보세요.',
};
const BIO_TIP = { physical: '몸을 무리하지 말고 충분히 쉬세요', emotional: '감정이 큰 대화는 한 박자 늦추세요', intellectual: '중요한 계약·서명은 한 번 더 확인하세요' };
const EL_AXIS = { fire: 1, air: 1, earth: -1, water: -1 };        // 별자리 원소의 에너지 방향 (+ 바깥으로 / − 안으로)
const EL_FEEL = { water: 1, fire: 1, air: -1, earth: -1 };        // + 감성 / − 이성

/** @param ctx { saju, face, palm, fused, partner, tarot, mbti, date } */
export function buildReport(ctx) {
  const { saju, face, palm, fused, partner, tarot, mbti } = ctx, date = ctx.date || new Date();
  const has = { saju: !!saju, face: !!face, palm: !!palm, fused: !!fused, animal: !!face, mbti: !!mbti, tarot: !!tarot, partner: !!(partner && saju) };
  if (!has.fused && !has.saju) return null;

  // ── 바탕 ──
  const areaBase = {};
  if (fused) fused.fortunes.forEach(f => { areaBase[f.key] = f.combined; }); else AREA_KEYS.forEach(k => { areaBase[k] = saju.reading.fortunes[k]; });
  const base = { score: fused ? fused.avg : Math.round(mean(AREA_KEYS.map(k => areaBase[k]))), areas: areaBase, sources: fused ? fused.sources : ['saju'] };
  base.level = levelOf(base.score);

  // ── 흐름 (사주가 있어야 계산) ──
  let flow = null, zodiac = null, daily = null, yearly = null, bio = null, hourly = null;
  if (saju) {
    daily = dailyFortune(saju, date); yearly = yearlyFortune(saju, date); bio = biorhythm(saju.saju.solar, date); hourly = hourlyFortune(saju, date); zodiac = zodiacProfile(saju);
    const bioScore = Math.round(clamp(74 + bio.avg * 0.15, 55, 90));
    flow = { score: Math.round(0.4 * daily.avg + 0.35 * yearly.avg + 0.25 * bioScore), today: daily.avg, year: yearly.avg, bio: bioScore };
    flow.level = levelOf(flow.score);
  }
  const totalScore = flow ? Math.round(0.65 * base.score + 0.35 * flow.score) : base.score;
  const total = { score: totalScore, level: levelOf(totalScore) };

  // ── 동물상·MBTI·타로·궁합 ──
  const animal = face ? classifyAnimal(face.features) : null;
  const match = has.partner ? computeMatch(saju, partner.state, { a: '나', b: partner.name }) : null;

  // ── 프로필 타일 ──
  const profile = [];
  if (saju) { const r = saju.reading, dm = r.dayMaster; profile.push({ key: 'saju', glyph: '命', title: `${dm.ko}${dm.elName.ko}(${dm.hanja}${dm.elName.hanja}) 일간`, sub: `${r.strong ? '신강' : '신약'} · ${dm.image}`, color: dm.elName.color });
    profile.push({ key: 'ddi', glyph: ANIMAL_EMOJI[r.animal] || '🐾', title: `${r.animal}띠`, sub: r.animalText, color: '#5cb78a' });
    profile.push({ key: 'zodiac', glyph: zodiac.sign.sym, title: zodiac.sign.name, sub: `${zodiac.sign.elKo} · ${zodiac.sign.kw}`, color: '#8a6bff' }); }
  if (face) profile.push({ key: 'face', glyph: '相', title: face.type.primary.name, sub: `${face.shape.primary.name} · ${face.shape.primary.shape}`, color: face.type.primary.color || '#ffb24d' });
  if (palm) profile.push({ key: 'palm', glyph: '手', title: palm.reading.shape.primary.name, sub: `${palm.reading.sideInfo ? palm.reading.sideInfo.name : ''} ${palm.reading.shape.primary.shape}`.trim(), color: '#4fc3ff' });
  if (animal) profile.push({ key: 'animal', glyph: animal.primary.emoji, title: animal.primary.name, sub: animal.primary.kw, color: '#ff6ad5' });
  if (mbti) profile.push({ key: 'mbti', glyph: mbti.code, title: TYPES[mbti.code].nick, sub: TYPES[mbti.code].kw.join(' · '), color: '#4fc3ff', small: true });
  if (tarot) { const c = tarot.reading.cards[0]; profile.push({ key: 'tarot', glyph: c.card.sym, title: `${c.card.name} · ${c.orient}`, sub: c.kw, color: '#ffb24d' }); }
  if (match) profile.push({ key: 'match', glyph: '合', title: `${partner.name}와의 궁합 ${match.total}점`, sub: match.grade.name, color: '#ff6ad5' });

  // ── 영역별 비교(바탕·올해·오늘) ──
  const areaMix = AREA_KEYS.map(k => ({ key: k, name: AREA_NAMES[k], base: areaBase[k], year: yearly ? yearly.scores[k] : null, today: daily ? daily.scores[k] : null }));

  // ── 교차 해석 ──
  const texts = [];
  const ids = [];
  if (saju) { const dm = saju.reading.dayMaster; ids.push(`사주로는 ${dm.ko}${dm.elName.ko}(${dm.hanja}${dm.elName.hanja}) 일간의 ${saju.reading.strong ? '신강' : '신약'} 사주(${dm.image})`); ids.push(`${saju.reading.animal}띠`); ids.push(`${zodiac.sign.name}(${zodiac.sign.elKo})`); }
  if (face) ids.push(`관상은 ${face.shape.primary.name}에 ${face.type.primary.name}`);
  if (palm) ids.push(`손금은 ${palm.reading.shape.primary.name}`);
  if (animal) ids.push(`${animal.primary.name}`);
  if (mbti) ids.push(`${mbti.code}(${TYPES[mbti.code].nick})`);
  texts.push(`여러 방면을 함께 보면 당신은 ${ids.join(', ')}의 사람입니다. 종합 지수는 ${total.score}점(${total.level.ko})으로, 타고난 바탕 ${base.score}점${flow ? `과 지금의 흐름 ${flow.score}점` : ''}을 합친 값입니다.`);

  // 에너지 방향 / 감성-이성 교차
  const votes = [];
  if (mbti) votes.push([`MBTI ${mbti.code[0] === 'E' ? '외향' : '내향'}`, mbti.code[0] === 'E' ? 1 : -1]);
  if (saju) votes.push([`사주 ${saju.reading.strong ? '신강' : '신약'}`, saju.reading.strong ? 1 : -1]);
  if (zodiac) votes.push([`별자리 ${zodiac.sign.elKo}`, EL_AXIS[zodiac.sign.el]]);
  if (votes.length >= 2) {
    const up = votes.filter(v => v[1] > 0), down = votes.filter(v => v[1] < 0), names = (a) => a.map(v => v[0]).join(', ');
    texts.push(up.length === votes.length ? `에너지의 방향은 ${names(votes)} 모두 바깥을 향합니다. 사람을 만나고 무언가를 이끌 때 힘이 나는 사람이니 활동 속에서 기회를 찾으세요.`
      : down.length === votes.length ? `에너지의 방향은 ${names(votes)} 모두 안쪽을 향합니다. 조용히 깊이 파고들 때 힘이 나는 사람이니 충전의 시간을 일부러 확보하세요.`
      : `에너지의 방향이 엇갈립니다. 바깥을 향하는 쪽은 ${names(up)}, 안쪽을 향하는 쪽은 ${josa(names(down), '이라서', '라서')} 상황에 따라 활발한 얼굴과 차분한 얼굴을 모두 보여 주는 입체적인 사람입니다.`);
  }
  if (mbti && zodiac) {
    const feelM = mbti.code[2] === 'F' ? 1 : -1, feelZ = EL_FEEL[zodiac.sign.el];
    texts.push(feelM === feelZ ? `판단 방식에서는 MBTI(${mbti.code[2] === 'F' ? '감정' : '사고'})와 별자리 원소(${zodiac.sign.elKo})가 ${feelM > 0 ? '마음과 공감' : '논리와 현실'} 쪽으로 같은 방향을 가리켜 결정이 일관된 편입니다.`
      : `판단 방식에서는 MBTI(${mbti.code[2] === 'F' ? '감정' : '사고'})와 별자리 원소(${zodiac.sign.elKo})가 서로 다른 쪽을 가리켜, 머리와 마음 사이에서 고민이 길어질 수 있으니 결정 전에 둘을 모두 적어 비교해 보세요.`);
  }
  if (animal && (face || palm)) {
    const el = EL[face ? face.type.primary.key : (palm ? palm.reading.shape.primary.key : 'wood')];
    texts.push(`첫인상은 ${animal.primary.name}(${animal.primary.kw})인데 관상의 바탕 기운은 ${el ? josa(el.name + '(' + el.hanja + ')', '이라', '라') : ''} 겉으로 보이는 분위기와 속의 기질이 ${animal.reasons.length ? '「' + animal.reasons[0] + '」 인상에서 ' : ''}자연스럽게 이어집니다.`);
  }

  // 바탕과 흐름
  if (flow) {
    const diff = flow.score - base.score;
    texts.push(diff >= 4 ? `타고난 바탕(${base.score}점)보다 지금의 흐름(${flow.score}점)이 더 좋아 기회를 잡고 도전하기 좋은 시기입니다.`
      : diff <= -4 ? `타고난 바탕(${base.score}점)에 비해 지금의 흐름(${flow.score}점)은 잠잠합니다. 무리하게 넓히기보다 힘을 모으고 다지는 시기로 쓰세요.`
      : `타고난 바탕(${base.score}점)과 지금의 흐름(${flow.score}점)이 비슷해 큰 기복 없이 안정적으로 나아가는 시기입니다.`);
    const m = date.getMonth() + 1, cur = yearly.months[m - 1];
    texts.push(`올해는 ${yearly.ganji}년으로 ${yearly.godInfo.name}의 해이며, ${yearly.best3.map(x => x.month + '월').join('·')}이 특히 좋고 ${yearly.worst3.map(x => x.month + '월').join('·')}은 쉬어 가기 좋습니다. 이번 달(${m}월)은 ${cur.avg}점으로 ${cur.avg >= yearly.avg ? '올해 평균보다 높은' : '올해 평균보다 낮은'} 달입니다. 오늘은 ${daily.ganji}일(${daily.godInfo.name})로 ${daily.avg}점이고, 하루 중에는 ${josa(`${hourly.best.name}(${hourly.best.range}시)`, '이', '가')} 가장 좋습니다.`);
    const hi = bio.now.filter(c => c.phase === 'high').map(c => c.name), crit = bio.now.filter(c => c.phase === 'critical').map(c => c.name), lowc = bio.now.filter(c => c.phase === 'low').map(c => c.name);
    texts.push(`바이오리듬은 평균 ${bio.avg}%입니다. ${hi.length ? `${hi.join('·')} 리듬이 정점이라 그 방면의 일을 밀어붙이기 좋고` : '정점에 오른 리듬은 없고'}${crit.length ? `, ${crit.join('·')} 리듬은 전환점이라 무리한 결정을 피하는 게 좋습니다` : ''}${lowc.length ? `, ${lowc.join('·')} 리듬은 저점이라 회복이 필요합니다` : ''}.`);
  }
  if (tarot) {
    const cs = tarot.reading.cards, tone = mean(cs.map(c => c.e));
    texts.push(`${tarot.question && tarot.question.trim() ? `「${tarot.question.trim()}」에 대해 ` : '오늘 '}뽑은 타로는 ${cs.map(c => `${c.card.name}(${c.orient})`).join(', ')}입니다. ${tarot.reading.summary[0]} ${flow ? (tone > 0.3 && flow.score >= base.score ? '카드의 기운도 사주의 흐름과 같은 방향이라 지금의 선택에 힘이 실립니다.' : tone < -0.3 ? '카드는 조심할 부분을 짚고 있으니 사주의 흐름이 좋더라도 점검을 한 번 더 하세요.' : '카드는 큰 방향보다 마음가짐을 점검하라고 말합니다.') : ''}`);
  }
  if (match) texts.push(`함께 본 ${partner.name}님과의 궁합은 ${match.total}점(${match.grade.name})입니다. 가장 잘 맞는 부분은 ${match.best}, 신경 쓸 부분은 ${match.worst}입니다.`);

  // ── 실천 ──
  const actions = [];
  const mixed = AREA_KEYS.map(k => [k, daily ? 0.5 * areaBase[k] + 0.5 * daily.scores[k] : areaBase[k]]).sort((a, b) => a[1] - b[1])[0][0];
  actions.push({ icon: '🎯', title: `보완할 영역: ${AREA_NAMES[mixed]}`, text: ADVICE[mixed] });
  if (hourly) actions.push({ icon: '⏰', title: `오늘 힘 있는 시간: ${hourly.best.name}(${hourly.best.range}시)`, text: `중요한 일과 제안은 이 시간에 두세요. 가장 조심할 시간은 ${hourly.worst.name}(${hourly.worst.range}시)입니다.` });
  if (daily) actions.push({ icon: '🎨', title: `행운 포인트: ${daily.lucky.info.lucky}`, text: `행운의 숫자 ${daily.lucky.number}, 힘이 나는 시간 ${daily.lucky.hours}.` });
  if (bio) { const w = [...bio.now].sort((a, b) => a.value - b.value)[0]; actions.push({ icon: '🌊', title: `${w.name} 리듬 ${w.value}%`, text: `${BIO_TIP[w.key]}.` }); }
  if (tarot) actions.push({ icon: '🔮', title: '타로의 조언', text: tarot.reading.cards[tarot.reading.cards.length > 1 ? 1 : 0].card.advice });

  return { has, base, flow, total, profile, areaMix, texts, actions, daily, yearly, bio, hourly, zodiac, animal, match, mbti, tarot,
    chartMonths: yearly ? yearly.months.map(m => m.avg) : null, currentMonth: date.getMonth() + 1 };
}

const ANIMAL_EMOJI = { 쥐: '🐭', 소: '🐮', 호랑이: '🐯', 토끼: '🐰', 용: '🐲', 뱀: '🐍', 말: '🐴', 양: '🐑', 원숭이: '🐵', 닭: '🐔', 개: '🐶', 돼지: '🐷' };
export { ANIMAL_EMOJI };
