// app.js 와 views-combo.js 가 함께 쓰는 작은 도구

/** 글자 수·단어 경계를 보며 maxW 안에 들어가게 줄을 나눈다 (한국어 포함) */
export function wrapLines(ctx, text, maxW) {
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

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export const $ = (s, root = document) => root.querySelector(s);
export const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
