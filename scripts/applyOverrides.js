// data/service-overrides.json 의 값을 이미 동기화된 app/stores/*.json에 병합한다.
// scripts/pharmacyLocations.js는 API를 다시 호출해야 해서(일일 할당량 소모) 큐레이션 값만
// 바꿨을 때 쓰기엔 낭비다 - 이 스크립트는 API 호출 없이 로컬 파일만 갱신한다.
//
// 사용법: node scripts/applyOverrides.js

const fs = require('fs');
const path = require('path');

const STORES_DIR = path.join(__dirname, '..', 'app', 'stores');
const OVERRIDES_FILE = path.join(__dirname, '..', 'data', 'service-overrides.json');

const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf-8'));
const indexFile = path.join(STORES_DIR, 'index.json');
const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));

let totalUpdated = 0;
for (const { file } of index) {
  const filePath = path.join(STORES_DIR, file);
  const stores = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let changed = 0;

  for (const store of stores) {
    const hpid = store.id.replace(/^ph_/, '');
    const override = overrides[hpid];
    if (!override) continue;

    if (override.large !== undefined) store.large = override.large;
    if (override.services) Object.assign(store.services, override.services);
    if (override.items) store.items = override.items;
    changed++;
  }

  if (changed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(stores), 'utf-8');
    console.error(`${file}: ${changed}건 병합`);
    totalUpdated += changed;
  }
}

console.error(`총 ${totalUpdated}곳에 큐레이션 값을 반영했습니다.`);
