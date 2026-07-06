// scripts/.moi-large-candidates.json(행안부 대형/창고형 후보)을 우리 E-Gen 실데이터(app/stores/*.json)와
// 이름+주소 기준으로 매칭한다.
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

for (const c of candidates) {
  const dong = extractDong(c.roadAddr) || extractDong(c.lotAddr);
  const core = roadCore(c.roadAddr) || roadCore(c.lotAddr);

  let best = null;
  const byName = allStores.filter(s => s.name === c.name);
  if (byName.length === 1) best = byName[0];
  else if (byName.length > 1 && dong) best = byName.find(s => (s.address || '').includes(dong));
  else if (byName.length > 1 && core) best = byName.find(s => normAddr(s.address).includes(core));

  if (!best && dong) {
    const loose = allStores.filter(s => (s.name.includes(c.name) || c.name.includes(s.name)) && (s.address || '').includes(dong));
    if (loose.length >= 1) best = loose[0];
  }
  // 동(dong) 정보가 없는 주소(면 단위 등)에 대한 폴백: 도로명 핵심 토큰으로 매칭
  if (!best && core && core.length >= 6) {
    const loose = allStores.filter(s => (s.name.includes(c.name) || c.name.includes(s.name)) && normAddr(s.address).includes(core));
    if (loose.length >= 1) best = loose[0];
  }

  if (best) {
    matched.push({ moi: c, egen: { id: best.id, name: best.name, address: best.address, large: best.large } });
  } else {
    unmatched.push(c);
  }
}

// 같은 E-Gen 매장에 후보가 중복 매칭된 경우 면적이 큰 것(더 근거 있는 쪽)만 남김
const byEgenId = new Map();
for (const m of matched) {
  const prev = byEgenId.get(m.egen.id);
  if (!prev || m.moi.area > prev.moi.area) byEgenId.set(m.egen.id, m);
}
const uniqueMatched = [...byEgenId.values()];

console.error(`\n매칭 성공(고유): ${uniqueMatched.length}/${candidates.length}`);
console.error(`매칭 실패: ${unmatched.length}/${candidates.length}\n`);

const tierCounts = { large: 0, warehouse: 0 };
uniqueMatched.forEach(m => tierCounts[m.moi.sizeTier]++);
console.error('매칭된 것 중 등급별:', tierCounts);

console.error('\n=== 매칭 성공 목록 ===');
uniqueMatched
  .sort((a, b) => b.moi.area - a.moi.area)
  .forEach(m => console.log(`${m.moi.area}㎡ [${m.moi.sizeTier}] | ${m.egen.id} | ${m.egen.name} | ${m.egen.address}`));

console.error('\n=== 매칭 실패 (수동 확인 필요) ===');
unmatched.forEach(c => console.log(`${c.area}㎡ [${c.sizeTier}] | ${c.name} | ${c.roadAddr || c.lotAddr}`));

fs.writeFileSync('scripts/.moi-match-result.json', JSON.stringify({ matched: uniqueMatched, unmatched }, null, 2), 'utf-8');
console.error(`\nscripts/.moi-match-result.json 저장 완료`);
