// scripts/.moi-match-result.json의 unmatched(E-Gen 실데이터와 매칭 안 된 대형/창고형 후보)를
// 행안부 좌표(EPSG:5174)를 WGS84로 변환해 독립 매장으로 app/stores/*.json에 추가한다.
// E-Gen 매칭이 안 됐을 뿐 행안부 데이터 자체엔 위치정보가 있으므로 표기 가능하다.
//
// 이 경로로 들어온 매장은 국립중앙의료원 운영시간 데이터가 없어 hours:null로 남긴다
// (거짓으로 "09:00~20:00" 같은 기본값을 채우면 실제와 다를 때 오히려 위험하므로).
const fs = require('fs');
const path = require('path');
const proj4 = require('proj4');

proj4.defs('EPSG:5174', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43');

const STORES_DIR = path.join(__dirname, '..', 'app', 'stores');
const { unmatched } = JSON.parse(fs.readFileSync('scripts/.moi-match-result.json', 'utf-8'));

const PROVINCE_ALIASES = [
  ['서울특별시', '서울특별시'], ['부산광역시', '부산광역시'], ['대구광역시', '대구광역시'],
  ['인천광역시', '인천광역시'], ['광주광역시', '광주광역시'], ['대전광역시', '대전광역시'],
  ['울산광역시', '울산광역시'], ['세종특별자치시', '세종특별자치시'],
  ['경기도', '경기도'],
  ['강원특별자치도', '강원특별자치도'], ['강원도', '강원특별자치도'],
  ['충청북도', '충청북도'], ['충청남도', '충청남도'],
  ['전북특별자치도', '전북특별자치도'], ['전라북도', '전북특별자치도'],
  ['전라남도', '전라남도'],
  ['경상북도', '경상북도'], ['경상남도', '경상남도'],
  ['제주특별자치도', '제주특별자치도'], ['제주도', '제주특별자치도'],
];
function detectProvince(addr) {
  if (!addr) return null;
  for (const [alias, canonical] of PROVINCE_ALIASES) {
    if (addr.startsWith(alias)) return canonical;
  }
  return null;
}

let added = 0, skippedNoCoord = 0, skippedNoProvince = 0;
const byProvince = new Map();

for (const c of unmatched) {
  if (!c.x5174 || !c.y5174 || isNaN(c.x5174) || isNaN(c.y5174)) { skippedNoCoord++; continue; }

  const addr = c.roadAddr || c.lotAddr;
  const province = detectProvince(addr) || detectProvince(c.roadAddr) || detectProvince(c.lotAddr);
  if (!province) { skippedNoProvince++; console.error(`시/도 판별 실패: ${c.name} | ${addr}`); continue; }

  const [lng, lat] = proj4('EPSG:5174', 'EPSG:4326', [c.x5174, c.y5174]);
  // 국내 좌표 범위 벗어나면(변환 실패/원본 좌표 이상) 건너뜀
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) { console.error(`좌표 범위 이상: ${c.name} → (${lat}, ${lng})`); continue; }

  if (!byProvince.has(province)) byProvince.set(province, []);
  byProvince.get(province).push({
    id: `moi_${c.manageNo}`,
    name: c.name,
    lat, lng,
    address: addr || '',
    phone: c.phone || null,
    area: c.area,
    sizeTier: c.sizeTier,
    hours: null, // 국립중앙의료원 운영시간 데이터가 없음 - 방문 전 전화 확인 필요
    services: {
      parking: null, driveThrough: null, prescription: true,
      healthFunctionalFood: true, // 대형/창고형 약국의 정의상 특성으로 간주
      medicalDevice: null, bloodPressure: null, bloodSugar: null,
    },
    items: [],
  });
  added++;
}

console.error(`\n좌표 변환 및 추가: ${added}건, 좌표없음 ${skippedNoCoord}건, 시/도판별실패 ${skippedNoProvince}건`);

const indexFile = path.join(STORES_DIR, 'index.json');
const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
const indexByProvince = new Map(index.map(e => [e.province, e]));

for (const [province, newStores] of byProvince.entries()) {
  const entry = indexByProvince.get(province);
  if (!entry) { console.error(`index.json에 없는 시/도: ${province} - 건너뜀`); continue; }
  const filePath = path.join(STORES_DIR, entry.file);
  const stores = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const existingIds = new Set(stores.map(s => s.id));
  const toAdd = newStores.filter(s => !existingIds.has(s.id));
  stores.push(...toAdd);
  fs.writeFileSync(filePath, JSON.stringify(stores), 'utf-8');
  entry.count = stores.length;
  entry.centerLat = stores.reduce((s, x) => s + x.lat, 0) / stores.length;
  entry.centerLng = stores.reduce((s, x) => s + x.lng, 0) / stores.length;
  console.error(`${entry.file}: +${toAdd.length}건 추가 (총 ${stores.length}건)`);
}

fs.writeFileSync(indexFile, JSON.stringify([...indexByProvince.values()], null, 2), 'utf-8');
console.error('\nstores/index.json 갱신 완료');
