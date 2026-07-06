// scripts/.moi-match-result.json(행안부 면적 데이터 매칭 결과)를 data/service-overrides.json에 병합.
// area(㎡)를 기록해두면 sizeTier(일반/대형/창고형)는 이 값으로부터 자동 계산되므로,
// 다음에 새 행안부 CSV가 나와도 이 스크립트만 다시 돌리면 자동으로 재분류된다.
const fs = require('fs');

const OVERRIDES_FILE = 'data/service-overrides.json';
const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf-8'));
const { matched } = JSON.parse(fs.readFileSync('scripts/.moi-match-result.json', 'utf-8'));

// 전체(3만여 건) 규모라 일반약국까지 _source 텍스트를 다 남기면 파일이 너무 커진다.
// 큐레이션 근거를 남길 가치가 있는 대형/창고형만 _source를 붙이고, 일반약국은 area만 기록.
let added = 0, updated = 0;
for (const m of matched) {
  if (m.moi.area === null) continue; // 면적 정보 자체가 없으면 등록할 값이 없음
  const hpid = m.egen.id.replace(/^ph_/, '');
  const existing = overrides[hpid];
  const noteworthy = m.moi.sizeTier !== 'general';
  if (existing) {
    existing.area = m.moi.area;
    delete existing.large; // area 기반 자동 분류로 대체
    updated++;
  } else {
    overrides[hpid] = noteworthy
      ? { area: m.moi.area, _source: `행정안전부 전국약국표준데이터(약국영업면적 ${m.moi.area}㎡) - ${m.moi.roadAddr || m.moi.lotAddr}` }
      : { area: m.moi.area };
    added++;
  }
}

fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf-8');
console.error(`신규 추가 ${added}건, 기존 항목 업데이트 ${updated}건. 총 ${Object.keys(overrides).length}건 등록됨.`);
