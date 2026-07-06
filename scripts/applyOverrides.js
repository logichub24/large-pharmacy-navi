// data/service-overrides.json 의 값을 이미 동기화된 app/stores/*.json에 병합한다.
// scripts/pharmacyLocations.js는 API를 다시 호출해야 해서(일일 할당량 소모) 큐레이션 값만
// 바꿨을 때 쓰기엔 낭비다 - 이 스크립트는 API 호출 없이 로컬 파일만 갱신한다.
//
// 사용법: node scripts/applyOverrides.js

const fs = require('fs');
const path = require('path');

const STORES_DIR = path.join(__dirname, '..', 'app', 'stores');
const OVERRIDES_FILE = path.join(__dirname, '..', 'data', 'service-overrides.json');

// 일반/대형/창고형 분류 기준(앱 자체 기준 - 법적 기준 아님): 70평(231㎡) / 300평(991㎡)
const LARGE_MIN_AREA = 231;
const WAREHOUSE_MIN_AREA = 991;
function classifySizeTier(area, manualTier) {
  if (typeof area === 'number' && area > 0) {
    if (area >= WAREHOUSE_MIN_AREA) return 'warehouse';
    if (area >= LARGE_MIN_AREA) return 'large';
    return 'general';
  }
  return manualTier || 'general';
}

const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf-8'));
const indexFile = path.join(STORES_DIR, 'index.json');
const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));

// 모든 매장을 대상으로 스키마를 통일한다(큐레이션 안 된 곳도 area:null, sizeTier:'general'로 채움).
// 그래야 예전 large:boolean 필드가 일부 매장에만 남아있는 상태가 안 생긴다.
let totalUpdated = 0, totalCurated = 0;
for (const { file } of index) {
  const filePath = path.join(STORES_DIR, file);
  const stores = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let curated = 0;

  for (const store of stores) {
    const hpid = store.id.replace(/^ph_/, '');
    const override = overrides[hpid];

    delete store.large; // 이전 boolean 스키마 잔재 정리
    store.area = override && typeof override.area === 'number' ? override.area : null;
    store.sizeTier = classifySizeTier(store.area, override && override.sizeTier);
    if (override) {
      if (override.services) Object.assign(store.services, override.services);
      if (override.items) store.items = override.items;
      curated++;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(stores), 'utf-8');
  console.error(`${file}: 전체 ${stores.length}건 스키마 갱신 (큐레이션 반영 ${curated}건)`);
  totalUpdated += stores.length;
  totalCurated += curated;
}

console.error(`\n총 ${totalUpdated}곳 스키마 갱신, 이 중 ${totalCurated}곳에 큐레이션 값 반영했습니다.`);
