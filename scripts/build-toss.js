// 토스인앱(Apps in Toss) 빌드용 스크립트.
// granite.config.ts의 web.commands.build/dev에서 호출됨.
// 정적 HTML 앱이라 별도 번들러 없이, 필요한 파일만 dist/로 복사한다.
// 약국 데이터는 별도 data 저장소에서 런타임에 읽으므로 앱 번들에는 넣지 않는다.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'app');
const DIST_DIR = path.join(__dirname, '..', 'dist');

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

fs.copyFileSync(path.join(SRC_DIR, 'index.html'), path.join(DIST_DIR, 'index.html'));
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
