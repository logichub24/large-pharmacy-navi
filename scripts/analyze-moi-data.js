// 사용자가 다운로드한 행정안전부(지방행정인허가) 전국약국표준데이터 CSV를 분석.
// 폐업 제외 전체를 추출(면적 있으면 일반/대형/창고형 자동 분류, 없으면 일반약국 기본값).
//
// 분류 기준(앱 자체 기준, 법적 기준 아님): 일반<231㎡, 231≤대형<991㎡, 창고형≥991㎡ (70평/300평)
const fs = require('fs');

const CSV_PATH = process.argv[2] || 'C:\\Users\\chajh\\Downloads\\건강_약국_utf8.csv';
const LARGE_MIN = 231; // 70평
const WAREHOUSE_MIN = 991; // 300평

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function classifyBySize(area) {
  if (area === null) return 'general';
  if (area >= WAREHOUSE_MIN) return 'warehouse';
  if (area >= LARGE_MIN) return 'large';
  return 'general';
}

console.error('CSV 읽는 중...');
const text = fs.readFileSync(CSV_PATH, 'utf-8');
const rows = parseCsv(text);
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const data = rows.slice(1).filter(r => r.length === header.length);
console.error(`총 ${data.length}행 파싱 완료`);

// "폐업"만 제외하면 안 된다 - "취소/말소/만료/정지/중지"·"휴업"도 지금 실제로 영업 중이
// 아니므로 함께 제외해야 한다. 확실하게 "영업/정상" 상태인 것만 남긴다.
const open = data.filter(r => r[idx['영업상태명']] === '영업/정상');
console.error(`영업중(영업/정상)만 ${open.length}건 (전체 ${data.length}건 중 폐업·취소·휴업 등 제외)`);

const all = open.map(r => {
  const rawArea = parseFloat(r[idx['약국영업면적']]);
  const area = rawArea > 0 ? rawArea : null;
  return {
    manageNo: r[idx['관리번호']],
    name: r[idx['사업장명']],
    area,
    sizeTier: classifyBySize(area),
    roadAddr: r[idx['도로명주소']],
    lotAddr: r[idx['지번주소']],
    phone: r[idx['전화번호']],
    status: r[idx['영업상태명']],
    x5174: parseFloat(r[idx['좌표정보(X)']]),
    y5174: parseFloat(r[idx['좌표정보(Y)']]),
  };
});

const tierCounts = { general: 0, large: 0, warehouse: 0 };
all.forEach(x => tierCounts[x.sizeTier]++);
console.error(`\n분류 결과: 일반약국 ${tierCounts.general}곳 / 대형약국 ${tierCounts.large}곳 / 창고형약국 ${tierCounts.warehouse}곳`);
console.error(`면적 데이터 있는 곳: ${all.filter(x => x.area !== null).length}/${all.length}건`);

fs.writeFileSync('scripts/.moi-large-candidates.json', JSON.stringify(all), 'utf-8');
console.error(`\nscripts/.moi-large-candidates.json 저장 완료 (전체 ${all.length}건)`);
