// 토스인앱(Apps in Toss) 빌드용 스크립트.
// granite.config.ts의 web.commands.build/dev에서 호출됨.
// 정적 HTML 앱이라 별도 번들러 없이, 필요한 파일만 dist/로 복사한다.
// stores/는 복사하지 않음 - 런타임에 상대경로(fetch('./stores/...'))로 직접 불러오므로
// 번들에 포함시키면 용량만 커지고, 배포 후에도 같은 위치에서 서빙되면 그대로 동작한다.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'app');
const DIST_DIR = path.join(__dirname, '..', 'dist');

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

fs.copyFileSync(path.join(SRC_DIR, 'index.html'), path.join(DIST_DIR, 'index.html'));
fs.copyFileSync(path.join(SRC_DIR, 'ads.js'), path.join(DIST_DIR, 'ads.js'));

for (const file of fs.readdirSync(SRC_DIR)) {
  if (/^icon.*\.(png|svg)$/.test(file)) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
  }
}

console.log('토스 빌드 완료:', DIST_DIR);
