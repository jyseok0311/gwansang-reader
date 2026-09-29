// ─────────────────────────────────────────────────────────────
//  운명 판독기 로컬 서버
//  - http://localhost:5173        : PC에서 사용
//  - https://<PC의 IP>:5443       : 같은 와이파이의 휴대폰에서 사용 (카메라는 HTTPS 필수)
//  사용법: node server.js [HTTP포트] [HTTPS포트] [--open]   (--open: 준비되면 브라우저 열기)
//  외부 패키지 없이 동작합니다. HTTPS 인증서는 openssl 로 자동 생성합니다.
// ─────────────────────────────────────────────────────────────
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const args = process.argv.slice(2);
const nums = args.filter(a => /^\d+$/.test(a)).map(Number);
const HTTP_PORT = nums[0] || Number(process.env.PORT) || 5173;
const HTTPS_PORT = nums[1] || Number(process.env.HTTPS_PORT) || 5443;
const OPEN = args.includes('--open');
const ROOT = __dirname;
const CERT_DIR = path.join(ROOT, 'certs');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
// 외부에 내보내면 안 되는 경로 (인증서 개인키, 개발 도구, 설정)
const BLOCKED = [/^certs(\/|$)/, /^tools(\/|$)/, /^server\.js$/, /^start\.bat$/, /(^|\/)\./];

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  // 사설망 주소를 앞으로
  return out.sort((a, b) => Number(!/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a)) - Number(!/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(b)));
}

// ── HTTPS 인증서 (자체 서명) ─────────────────────────────────
function findOpenssl() {
  const candidates = ['openssl',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe', 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe', '/usr/bin/openssl', '/opt/homebrew/bin/openssl', '/usr/local/bin/openssl'];
  for (const c of candidates) {
    try { execFileSync(c, ['version'], { stdio: 'ignore' }); return c; } catch { /* 다음 후보 */ }
  }
  return null;
}

function ensureCert(ips) {
  const keyFile = path.join(CERT_DIR, 'key.pem');
  const certFile = path.join(CERT_DIR, 'cert.pem');
  const metaFile = path.join(CERT_DIR, 'meta.json');
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { /* 없음 */ }
  const sameIps = meta && ips.every(ip => meta.ips.includes(ip));
  if (fs.existsSync(keyFile) && fs.existsSync(certFile) && sameIps) {
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  }
  const openssl = findOpenssl();
  if (!openssl) {
    if (fs.existsSync(keyFile) && fs.existsSync(certFile)) return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
    return null;
  }
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map(ip => `IP:${ip}`)].join(',');
  execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '825',
    '-keyout', keyFile, '-out', certFile, '-subj', '/CN=Gwansang Local', '-addext', `subjectAltName=${san}`], { stdio: 'ignore' });
  fs.writeFileSync(metaFile, JSON.stringify({ ips, created: new Date().toISOString() }, null, 2));
  console.log('  HTTPS 인증서를 새로 만들었습니다:', san);
  return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
}

// ── 요청 처리 ────────────────────────────────────────────────
let httpsReady = false;
function handler(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end('Bad request'); }

  if (urlPath === '/api/info') {
    const ips = lanAddresses();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({
      http: ips.map(ip => `http://${ip}:${HTTP_PORT}/`),
      https: httpsReady ? ips.map(ip => `https://${ip}:${HTTPS_PORT}/`) : [],
    }));
  }

  if (urlPath === '/') urlPath = '/index.html';
  const rel = path.posix.normalize(urlPath).replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  const inside = path.relative(ROOT, file);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside) || BLOCKED.some(r => r.test(inside.split(path.sep).join('/')))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    const isVendor = inside.startsWith('vendor' + path.sep) || inside.startsWith('icons' + path.sep);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': isVendor ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// ── 시작 ─────────────────────────────────────────────────────
const ips = lanAddresses();
function openBrowser(url) {
  const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).unref(); } catch { /* 무시 */ }
}
http.createServer(handler).listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('\n  운명 판독기 실행 중  (끄려면 이 창을 닫거나 Ctrl+C)');
  console.log(`  PC       : http://localhost:${HTTP_PORT}`);
  if (OPEN) openBrowser(`http://localhost:${HTTP_PORT}/`);
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ${HTTP_PORT}번 포트를 이미 쓰고 있습니다. 운명 판독기가 이미 켜져 있을 수 있습니다: http://localhost:${HTTP_PORT}`);
    if (OPEN) openBrowser(`http://localhost:${HTTP_PORT}/`);
  } else {
    console.error(e.message);
  }
  process.exitCode = 1;
});

let creds = null;
try { creds = ensureCert(ips); } catch (e) { console.warn('  HTTPS 인증서 생성 실패:', e.message); }
if (creds) {
  https.createServer(creds, handler).listen(HTTPS_PORT, '0.0.0.0', () => {
    httpsReady = true;
    for (const ip of ips) console.log(`  휴대폰   : https://${ip}:${HTTPS_PORT}   (같은 와이파이에서 접속)`);
    console.log('\n  휴대폰에서 "연결이 비공개가 아님" 경고가 나오면 [고급] → [계속/방문]을 누르세요.');
    console.log('  PC 화면의 QR 코드를 휴대폰 카메라로 찍으면 바로 열립니다.\n');
  }).on('error', e => console.warn(`  HTTPS 포트 ${HTTPS_PORT} 사용 불가:`, e.message));
} else {
  for (const ip of ips) console.log(`  휴대폰   : http://${ip}:${HTTP_PORT}   (HTTP: 기본 카메라 앱으로 촬영)`);
  console.log('\n  openssl 을 찾지 못해 HTTPS 없이 실행합니다. 휴대폰에서는 기본 카메라 앱 촬영 방식으로 동작합니다.\n');
}
