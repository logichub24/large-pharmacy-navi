// 행안부 단독 등록(moi_) 약국의 중복을 두 단계로 정리한다.
//  A) 같은 id가 한 파일에 두 번 들어간 완전중복 → 1부만 유지(add-moi-standalone 기존 버그)
//  B) 같은 약국이 상호 표기 차이로 E-Gen(ph_)과 겹친 고신뢰 중복(50m 이내 + 상호명 완전일치) → 제거
// app/stores/*.json 과 data/moi-standalone.json 양쪽에 동일하게 적용해 동기화가 되살리지 않게 한다.
const fs = require('fs');
const path = require('path');

const STORES_DIR = path.join(__dirname, '..', 'app', 'stores');
const MOI_FILE = path.join(__dirname, '..', 'data', 'moi-standalone.json');
const DRY = process.argv.includes('--dry');

function dist(a, b) {
  const R = 6371000, toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const la1 = toR(a.lat), la2 = toR(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function norm(s) { return (s || '').replace(/\s|약국|한약국/g, ''); }

// 한 시/도의 store 배열에서 (A) id 완전중복 제거 후 (B) 이름기반 ph_ 중복 moi_ 제거한 결과 반환
function cleanProvince(stores) {
  const seenId = new Set();
  const idDeduped = stores.filter((s) => {
    if (!s.id.startsWith('moi_')) return true;
    if (seenId.has(s.id)) return false;
    seenId.add(s.id);
    return true;
  });
  const ph = idDeduped.filter((s) => s.id.startsWith('ph_'));
  const nameDupIds = new Set();
  for (const m of idDeduped) {
    if (!m.id.startsWith('moi_')) continue;
    const mn = norm(m.name);
    if (!mn || mn.length < 2) continue;
    for (const p of ph) {
      if (norm(p.name) === mn && dist(m, p) <= 50) { nameDupIds.add(m.id); break; }
    }
  }
  const kept = idDeduped.filter((s) => !nameDupIds.has(s.id));
  return { kept, idDupRemoved: stores.length - idDeduped.length, nameDupRemoved: nameDupIds.size, nameDupIds };
}

const index = JSON.parse(fs.readFileSync(path.join(STORES_DIR, 'index.json'), 'utf-8'));
let totalIdDup = 0, totalNameDup = 0;
const allNameDupIds = new Set();
const perProvince = {};

for (const entry of index) {
  const stores = JSON.parse(fs.readFileSync(path.join(STORES_DIR, entry.file), 'utf-8'));
  const r = cleanProvince(stores);
  perProvince[entry.province] = r;
  totalIdDup += r.idDupRemoved;
  totalNameDup += r.nameDupRemoved;
  r.nameDupIds.forEach((id) => allNameDupIds.add(id));
}
console.error(`(A) id 완전중복 제거: ${totalIdDup}곳`);
console.error(`(B) 이름기반 ph_ 중복 제거: ${totalNameDup}곳`);
console.error(`합계 제거: ${totalIdDup + totalNameDup}곳`);
if (DRY) return;

// app/stores/*.json + index 갱신
for (const entry of index) {
  const kept = perProvince[entry.province].kept;
  const filePath = path.join(STORES_DIR, entry.file);
  fs.writeFileSync(filePath, JSON.stringify(kept), 'utf-8');
  const lats = kept.map((x) => x.lat), lngs = kept.map((x) => x.lng);
  entry.count = kept.length;
  entry.minLat = Math.min(...lats); entry.maxLat = Math.max(...lats);
  entry.minLng = Math.min(...lngs); entry.maxLng = Math.max(...lngs);
}
fs.writeFileSync(path.join(STORES_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');

// data/moi-standalone.json 도 동일하게(id 완전중복 + 이름중복 제거)
const moiFile = JSON.parse(fs.readFileSync(MOI_FILE, 'utf-8'));
for (const prov of Object.keys(moiFile)) {
  const seen = new Set();
  moiFile[prov] = moiFile[prov].filter((s) => {
    if (allNameDupIds.has(s.id)) return false;
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  if (moiFile[prov].length === 0) delete moiFile[prov];
}
fs.writeFileSync(MOI_FILE, JSON.stringify(moiFile), 'utf-8');
console.error('app/stores/, index.json, moi-standalone.json 갱신 완료');
