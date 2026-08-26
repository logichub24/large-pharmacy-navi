// 토스인앱(Apps in Toss) 빌드용 스크립트.
// granite.config.ts의 web.commands.build/dev에서 호출됨.
// 정적 HTML 앱이라 별도 번들러 없이, 필요한 파일만 dist/로 복사한다.
// 약국 데이터는 별도 data 저장소에서 런타임에 읽으므로 앱 번들에는 넣지 않는다.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'app');
const DIST_DIR = path.join(__dirname, '..', 'dist');

// .env의 VWORLD_KEY를 읽는다(있으면). 커밋되는 app/index.html에는 빈 값으로 두고,
// 배포 산출물(dist)에만 실제 키를 주입해 저장소 히스토리에 키가 남지 않게 한다.
function readEnvKey(name) {
  if (process.env[name]) return process.env[name];
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return '';
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '');
  }
  return '';
}

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

const VWORLD_KEY = readEnvKey('VWORLD_KEY');
let html = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf-8');
if (VWORLD_KEY) {
  html = html.replace(/const VWORLD_KEY = [^;]*;/, `const VWORLD_KEY = '${VWORLD_KEY}';`);
  console.log('VWORLD_KEY 주입됨(dist 전용)');
}
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf-8');
fs.copyFileSync(path.join(SRC_DIR, 'ads.js'), path.join(DIST_DIR, 'ads.js'));
if (fs.existsSync(path.join(SRC_DIR, 'sw.js'))) {
  fs.copyFileSync(path.join(SRC_DIR, 'sw.js'), path.join(DIST_DIR, 'sw.js'));
}

for (const file of fs.readdirSync(SRC_DIR)) {
  if (/^icon.*\.(png|svg)$/.test(file)) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
  }
}

console.log(`토스 빌드 완료: ${DIST_DIR}`);
