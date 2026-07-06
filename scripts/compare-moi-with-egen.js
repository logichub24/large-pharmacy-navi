// scripts/.moi-large-candidates.json(행안부 전체 후보, 폐업 제외)을 우리 E-Gen 실데이터
// (app/stores/*.json)와 이름+주소 기준으로 매칭한다. 이름 기준 Map으로 인덱싱해 대량(3만건) 처리.
const fs = require('fs');
const path = require('path');

const candidates = JSON.parse(fs.readFileSync('scripts/.moi-large-candidates.json', 'utf-8'));
const index = JSON.parse(fs.readFileSync('app/stores/index.json', 'utf-8'));

let allStores = [];
for (const { file } of index) {
  const stores = JSON.parse(fs.readFileSync(path.join('app/stores', file), 'utf-8'));
  allStores.push(...stores);
}
console.error(`E-Gen 실데이터 총 ${allStores.length}곳 로드`);

const byName = new Map();
for (const s of allStores) {
  if (!byName.has(s.name)) byName.set(s.name, []);
  byName.get(s.name).push(s);
}

function normAddr(a) {
  return (a || '').replace(/\s+/g, '').replace(/[(),]/g, '');
}
function extractDong(a) {
  const m = (a || '').match(/\(([^)]+)\)/);
  return m ? m[1].split(',')[0].trim() : null;
}
// 도로명주소에서 "OO로 123" 형태의 핵심 토큰(도로명+번지)만 추출 - 건물명/호수 등 뒷부분 제외
function roadCore(a) {
  const m = (a || '').match(/^(.*?\d+(-\d+)?)/);
  return m ? normAddr(m[1]) : normAddr(a).slice(0, 14);
}

const matched = [];
const unmatched = [];
let processed = 0;

for (const c of candidates) {
  processed++;
  if (processed % 5000 === 0) console.error(`  진행 ${processed}/${candidates.length}`);

  const dong = extractDong(c.roadAddr) || extractDong(c.lotAddr);
  const core = roadCore(c.roadAddr) || roadCore(c.lotAddr);
  const sameNameCandidates = byName.get(c.name) || [];

  let best = null;
  if (sameNameCandidates.length === 1) best = sameNameCandidates[0];
  else if (sameNameCandidates.length > 1 && dong) best = sameNameCandidates.find(s => (s.address || '').includes(dong));
  else if (sameNameCandidates.length > 1 && core) best = sameNameCandidates.find(s => normAddr(s.address).includes(core));

  if (best) {
    matched.push({ moi: c, egen: { id: best.id, name: best.name, address: best.address, sizeTier: best.sizeTier } });
  } else {
    unmatched.push(c);
  }
}

// 같은 E-Gen 매장에 후보가 중복 매칭된 경우 면적이 큰 것(더 근거 있는 쪽)만 남김
const byEgenId = new Map();
for (const m of matched) {
  const prev = byEgenId.get(m.egen.id);
  if (!prev || (m.moi.area || 0) > (prev.moi.area || 0)) byEgenId.set(m.egen.id, m);
}
const uniqueMatched = [...byEgenId.values()];

console.error(`\n매칭 성공(고유): ${uniqueMatched.length}/${candidates.length}`);
console.error(`매칭 실패: ${unmatched.length}/${candidates.length}`);

const tierCounts = { general: 0, large: 0, warehouse: 0 };
uniqueMatched.forEach(m => tierCounts[m.moi.sizeTier]++);
console.error('매칭된 것 중 등급별:', tierCounts);
const unmatchedTierCounts = { general: 0, large: 0, warehouse: 0 };
unmatched.forEach(c => unmatchedTierCounts[c.sizeTier]++);
console.error('매칭 실패 중 등급별:', unmatchedTierCounts);

fs.writeFileSync('scripts/.moi-match-result.json', JSON.stringify({ matched: uniqueMatched, unmatched }), 'utf-8');
console.error(`\nscripts/.moi-match-result.json 저장 완료`);
