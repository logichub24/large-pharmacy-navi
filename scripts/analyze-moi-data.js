// 사용자가 다운로드한 행정안전부(지방행정인허가) 전국약국표준데이터 CSV를 분석.
// 1) 폐업 제외 2) 약국영업면적 기준 일반/대형/창고형 3단계 분류
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

const open = data.filter(r => !r[idx['영업상태명']].includes('폐업'));
console.error(`폐업 제외 ${open.length}건`);

const withArea = open
  .map(r => ({
    manageNo: r[idx['관리번호']],
    name: r[idx['사업장명']],
    area: parseFloat(r[idx['약국영업면적']]),
    roadAddr: r[idx['도로명주소']],
    lotAddr: r[idx['지번주소']],
    phone: r[idx['전화번호']],
    status: r[idx['영업상태명']],
    x5174: parseFloat(r[idx['좌표정보(X)']]),
    y5174: parseFloat(r[idx['좌표정보(Y)']]),
  }))
  .filter(x => x.area > 0);

console.error(`면적 유효값(>0) ${withArea.length}/${open.length}건`);

const tierCounts = { general: 0, large: 0, warehouse: 0 };
withArea.forEach(x => { x.sizeTier = classifyBySize(x.area); tierCounts[x.sizeTier]++; });

console.error(`\n분류 결과(면적 데이터 있는 곳 기준):`);
console.error(`  일반약국(<231㎡): ${tierCounts.general}곳`);
console.error(`  대형약국(231~991㎡): ${tierCounts.large}곳`);
console.error(`  창고형약국(991㎡+): ${tierCounts.warehouse}곳`);

const largeAndUp = withArea.filter(x => x.sizeTier !== 'general');
largeAndUp.sort((a, b) => b.area - a.area);

fs.writeFileSync('scripts/.moi-large-candidates.json', JSON.stringify(largeAndUp, null, 2), 'utf-8');
console.error(`\nscripts/.moi-large-candidates.json 저장 완료 (대형+창고형 ${largeAndUp.length}건)`);
