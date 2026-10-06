// 얼굴을 찍기 전에 부위마다 어떤 의미가 있는지 하나씩 짚어 주는 안내 (관상 촬영 화면)
// 랜드마크 번호는 MediaPipe Face Landmarker(478점) 기준이며, 부위별 풀이는 physiognomy.js 의 십이궁·오관 설명과 같은 틀을 따른다.

/** 안내하는 순서와 내용. groups 는 강조할 부위를 감싸는 랜드마크 묶음(여러 묶음이면 좌우 두 곳 등). text 는 3줄 안에 들어오게 짧게 쓴다. */
export const FACE_TOUR = [
  { key: 'forehead', name: '이마', topic: '관록궁 · 초년운', text: '이마가 넓고 매끈하면 초년운이 좋고 총명하며, 직업과 명예, 윗사람의 덕을 봅니다.', groups: [[103, 67, 109, 10, 338, 297, 332, 9]] },
  { key: 'glabella', name: '미간', topic: '명궁 · 운명의 중심', text: '두 눈썹 사이는 운명의 중심입니다. 넓고 밝으면 마음이 트이고 소원이 잘 이루어진다고 봅니다.', groups: [[9, 168, 107, 336]] },
  { key: 'brow', name: '눈썹', topic: '형제궁 · 인간관계', text: '눈썹이 길고 가지런하면 형제와 친구, 동료 복이 있고 감정이 안정적이라고 봅니다.', groups: [[70, 63, 105, 107], [336, 334, 293, 300]] },
  { key: 'eye', name: '눈', topic: '감찰관 · 마음과 의지', text: '눈은 마음의 창입니다. 맑고 또렷할수록 판단력과 의지가 좋고, 눈꼬리는 연애와 배우자운을 봅니다.', groups: [[33, 133, 159, 145], [263, 362, 386, 374]] },
  { key: 'nose', name: '코', topic: '재백궁 · 재물과 자존심', text: '코는 재물궁입니다. 콧대가 곧고 코끝이 도톰하면 재물운이 든든하고 중년운이 좋다고 봅니다.', groups: [[168, 1, 129, 358, 2]] },
  { key: 'mouth', name: '입과 인중', topic: '출납관 · 말솜씨와 식복', text: '입꼬리가 올라가고 입술이 도톰하면 인복과 말솜씨가 좋습니다. 인중은 건강과 수명을 뜻합니다.', groups: [[61, 291, 0, 17, 2]] },
  { key: 'chin', name: '턱', topic: '노복궁 · 말년운', text: '턱이 둥글고 단단하면 말년이 안정되고 끈기가 있으며, 아랫사람의 도움을 받는다고 봅니다.', groups: [[152, 172, 397, 150, 379, 176, 400]] },
];

export const TOUR_STOP_MS = 1700;                              // 한 부위를 짚어 주는 시간 (읽을 수 있을 만큼)
export const TOUR_END_MS = 700;                                // 마지막 부위 뒤 "다 읽었어요" 를 보여 주는 시간
export const TOUR_TOTAL_MS = FACE_TOUR.length * TOUR_STOP_MS + TOUR_END_MS;

/** 얼굴이 알맞게 잡힌 채 흐른 시간(ms) → 지금 안내할 부위 번호(끝나면 -1)와 진행률 */
export function tourAt(ms) {
  const n = FACE_TOUR.length;
  return { index: ms >= n * TOUR_STOP_MS ? -1 : Math.floor(ms / TOUR_STOP_MS), done: ms >= TOUR_TOTAL_MS, frac: Math.min(1, ms / TOUR_TOTAL_MS) };
}

/** 부위 묶음마다 감싸는 사각형 {x, y, w, h} (영상 픽셀) — pad 는 얼굴 너비에 대한 여백 비율 */
export function regionBoxes(stop, pts, pad = 0.035) {
  const faceW = Math.hypot(pts[454].x - pts[234].x, pts[454].y - pts[234].y) || 1;
  const m = faceW * pad;
  return stop.groups.map(g => {
    const xs = g.map(i => pts[i].x), ys = g.map(i => pts[i].y);
    const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m, x1 = Math.max(...xs) + m, y1 = Math.max(...ys) + m;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  });
}
