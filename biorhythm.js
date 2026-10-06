// ─────────────────────────────────────────────────────────────
//  바이오리듬 (오락용): 태어난 날부터 센 날수로 신체(23일)·감성(28일)·지성(33일) 주기의 사인 곡선을 그린다.
//  과학적으로 검증된 이론은 아니며, "오늘 컨디션을 돌아보는 재미"로만 쓴다.
// ─────────────────────────────────────────────────────────────
import { jdn } from './saju.js';
import { josa } from './physiognomy.js';

export const CYCLES = [
  { key: 'physical', name: '신체', period: 23, color: '#4fc3ff', about: '체력·활력·면역' },
  { key: 'emotional', name: '감성', period: 28, color: '#ff6ad5', about: '기분·직관·사교' },
  { key: 'intellectual', name: '지성', period: 33, color: '#8a6bff', about: '집중·판단·기억' },
];

const TXT = {
  physical: {
    high: '체력이 가장 좋은 시기입니다. 운동·이동·무거운 일을 몰아서 하기 좋습니다.',
    rising: '몸이 점점 가벼워지는 시기입니다. 운동 계획을 시작하기 좋습니다.',
    critical: '체력 리듬이 방향을 바꾸는 날입니다. 무리하지 말고 컨디션을 살피세요.',
    falling: '체력이 서서히 내려가는 시기입니다. 일정을 촘촘히 잡기보다 쉬는 틈을 넣으세요.',
    low: '체력이 바닥에 가까운 시기입니다. 충분한 수면과 가벼운 활동으로 회복에 집중하세요.',
  },
  emotional: {
    high: '감정이 풍부하고 사람 사이가 편안한 시기입니다. 만남과 표현에 좋습니다.',
    rising: '기분이 점점 밝아지는 시기입니다. 먼저 연락하고 모임에 나가 보세요.',
    critical: '감정 리듬이 바뀌는 날이라 기분이 흔들리기 쉽습니다. 중요한 대화는 한 박자 늦추세요.',
    falling: '감정이 차분해지며 예민해지기 쉬운 시기입니다. 말을 고르고 혼자만의 시간을 챙기세요.',
    low: '감정이 가라앉기 쉬운 시기입니다. 큰 결정은 미루고 좋아하는 일로 마음을 달래세요.',
  },
  intellectual: {
    high: '집중력과 판단력이 가장 좋은 시기입니다. 공부·기획·중요한 결정에 좋습니다.',
    rising: '머리가 맑아지는 시기입니다. 새로운 것을 배우거나 계획을 세워 보세요.',
    critical: '사고 리듬이 바뀌는 날이라 실수가 늘 수 있습니다. 계약·서명은 한 번 더 확인하세요.',
    falling: '집중력이 서서히 내려가는 시기입니다. 어려운 일은 아침에 먼저 처리하세요.',
    low: '집중이 잘 안 되는 시기입니다. 새로 시작하기보다 정리·복습 같은 쉬운 일을 하세요.',
  },
};

export const daysSince = (birth, date) => jdn(date.getFullYear(), date.getMonth() + 1, date.getDate()) - jdn(birth.year, birth.month, birth.day);
const val = (d, p) => Math.sin(2 * Math.PI * d / p) * 100;
const slope = (d, p) => Math.cos(2 * Math.PI * d / p);

/** 한 주기의 상태: high(정점) | rising | critical(0 근처) | falling | low(저점) */
export function phaseOf(d, p) {
  const v = val(d, p), s = slope(d, p);
  if (Math.abs(v) < 14) return 'critical';
  if (v >= 70) return 'high';
  if (v <= -70) return 'low';
  return s > 0 ? 'rising' : 'falling';
}

/**
 * @param birth { year, month, day }  양력 생일
 * @param date  기준 날짜
 * @param past, future  그래프에 그릴 이전·이후 날수
 */
export function biorhythm(birth, date = new Date(), { past = 7, future = 23 } = {}) {
  const d0 = daysSince(birth, date);
  const at = (off) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + off); return { off, date: d, values: Object.fromEntries(CYCLES.map(c => [c.key, +val(d0 + off, c.period).toFixed(1)])) }; };
  const series = []; for (let o = -past; o <= future; o++) series.push(at(o));
  const today = series.find(s => s.off === 0);
  const now = CYCLES.map(c => {
    const v = today.values[c.key], ph = phaseOf(d0, c.period);
    return { ...c, value: Math.round(v), phase: ph, text: TXT[c.key][ph], day: (((d0 % c.period) + c.period) % c.period) + 1 };
  });
  // 다음 정점·저점·전환일 (60일 안)
  const next = {};
  for (const c of CYCLES) {
    const found = { high: null, low: null, critical: null };
    for (let o = 1; o <= 60 && (!found.high || !found.low || !found.critical); o++) {
      const dd = d0 + o, v = val(dd, c.period), pv = val(dd - 1, c.period), nv = val(dd + 1, c.period);
      if (!found.high && v > pv && v >= nv) found.high = o;
      if (!found.low && v < pv && v <= nv) found.low = o;
      if (!found.critical && Math.sign(v) !== Math.sign(pv) && pv !== 0) found.critical = o;
    }
    next[c.key] = found;
  }
  const avg = Math.round(now.reduce((a, c) => a + c.value, 0) / 3);
  const level = avg >= 40 ? '컨디션 좋음' : avg >= 10 ? '무난한 컨디션' : avg >= -20 ? '평온·주의' : '쉬어 가기';
  const crit = now.filter(c => c.phase === 'critical').map(c => c.name);
  const best = [...now].sort((a, b) => b.value - a.value)[0], worst = [...now].sort((a, b) => a.value - b.value)[0];
  const texts = [];
  texts.push(`태어난 지 ${d0.toLocaleString('ko-KR')}일째입니다. 오늘 세 주기의 평균은 ${avg}%로 ${level}입니다.`);
  texts.push(`${josa(`${best.name}(${best.value}%)`, '이', '가')} 가장 높고 ${josa(`${worst.name}(${worst.value}%)`, '이', '가')} 가장 낮습니다. ${best.text}`);
  if (crit.length) texts.push(`${crit.join('·')} 리듬이 방향을 바꾸는 전환일(위험일)입니다. 이런 날은 무리한 일정과 큰 결정을 피하고 평소보다 한 번 더 확인하세요.`);
  else texts.push(`${worst.text}`);
  return { daysAlive: d0, series, today, now, avg, level, next, texts };
}
