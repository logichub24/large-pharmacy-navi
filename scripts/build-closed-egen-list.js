// 행안부 CSV의 폐업/취소/휴업 목록과 현재 E-Gen(ph_) 데이터를 이름+주소로 매칭해,
// 실제로 폐업했는데 국립중앙의료원 데이터에 아직 남아있는 항목의 "id 목록"을 뽑아
// data/closed-egen-ids.json 으로 저장한다. 이 목록은 커밋되어, 매일 도는 동기화가
// 새로 받은 E-Gen에서 이 id들을 제외하도록 재사용된다(CI에는 CSV가 없으므로).
const fs = require('fs');
const path = require('path');

const CSV_PATH = process.argv[2] || 'C:/Users/chajh/Downloads/건강_약국_utf8.csv';
const STORES_DIR = path.join(__dirname, '..', 'app', 'stores');
const OUT_FILE = path.join(__dirname, '..', 'data', 'closed-egen-ids.json');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
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

const text = fs.readFileSync(CSV_PATH, 'utf-8');
const rows = parseCsv(text);
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const data = rows.slice(1).filter(r => r.length === header.length);

const closed = data.filter(r => r[idx['영업상태명']] !== '영업/정상');
const open = data.filter(r => r[idx['영업상태명']] === '영업/정상');
console.error(`영업/정상이 아닌 레코드: ${closed.length}건 / 영업/정상: ${open.length}건`);

const GWANGJU_GU = ['동구', '서구', '남구', '북구', '광산구'];
function fixBadProvinceName(addr) {
  if (!addr || !addr.startsWith('전남광주통합특별시')) return addr;
  const rest = addr.slice('전남광주통합특별시'.length).trim();
  const isGwangju = GWANGJU_GU.some((gu) => rest.startsWith(gu));
  return `${isGwangju ? '광주광역시' : '전라남도'} ${rest}`;
}
function normAddr(a) { return (a || '').replace(/\s+/g, '').replace(/[(),]/g, ''); }
function extractDong(a) { const m = (a || '').match(/\(([^)]+)\)/); return m ? m[1].split(',')[0].trim() : null; }
function roadCore(a) { const m = (a || '').match(/^(.*?\d+(-\d+)?)/); return m ? normAddr(m[1]) : normAddr(a).slice(0, 14); }

function toRecord(r) {
  return {
    name: r[idx['사업장명']],
    roadAddr: fixBadProvinceName(r[idx['도로명주소']]),
    lotAddr: fixBadProvinceName(r[idx['지번주소']]),
  };
}
function buildByNameMap(records) {
  const map = new Map();
  for (const r of records) { if (!map.has(r.name)) map.set(r.name, []); map.get(r.name).push(r); }
  return map;
}
const closedByName = buildByNameMap(closed.map(toRecord));
const openByName = buildByNameMap(open.map(toRecord));

function addrMatches(aList, addr) {
  const dong = extractDong(addr);
  const core = roadCore(addr);
  return aList.some(c => {
    const cDong = extractDong(c.roadAddr) || extractDong(c.lotAddr);
    const cCore = roadCore(c.roadAddr) || roadCore(c.lotAddr);
    if (dong && cDong) return dong === cDong;
    if (core && cCore) return core === cCore;
    return false;
  });
}

const index = JSON.parse(fs.readFileSync(path.join(STORES_DIR, 'index.json'), 'utf-8'));
const closedIds = [];
for (const entry of index) {
  const stores = JSON.parse(fs.readFileSync(path.join(STORES_DIR, entry.file), 'utf-8'));
  for (const s of stores) {
    if (!s.id.startsWith('ph_')) continue;
    const closedMatch = addrMatches(closedByName.get(s.name) || [], s.address);
    const openMatch = addrMatches(openByName.get(s.name) || [], s.address);
    if (closedMatch && !openMatch) closedIds.push(s.id);
  }
}

closedIds.sort();
fs.writeFileSync(OUT_FILE, JSON.stringify(closedIds, null, 0), 'utf-8');
console.error(`\n폐업으로 판정된 E-Gen id: ${closedIds.length}건 → ${OUT_FILE}`);
