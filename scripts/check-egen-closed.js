// 행안부 CSV의 "폐업/취소/말소/만료/정지/중지/휴업" 목록과 우리 E-Gen(ph_) 데이터를
// 이름+주소로 매칭해, 실제로는 폐업했는데 국립중앙의료원 데이터에 아직 남아있는(스테일)
// 항목을 찾아 제거한다. 국립중앙의료원 API는 응급의료기관 조회가 주목적이라 폐업 반영이
// 지자체 인허가 데이터보다 늦을 수 있다.
const fs = require('fs');
const path = require('path');

const CSV_PATH = process.argv[2] || 'C:/Users/chajh/Downloads/건강_약국_utf8.csv';
const STORES_DIR = path.join(__dirname, '..', 'app', 'stores');

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

console.error('CSV 읽는 중...');
const text = fs.readFileSync(CSV_PATH, 'utf-8');
const rows = parseCsv(text);
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const data = rows.slice(1).filter(r => r.length === header.length);

const closed = data.filter(r => r[idx['영업상태명']] !== '영업/정상');
const open = data.filter(r => r[idx['영업상태명']] === '영업/정상');
console.error(`영업/정상이 아닌(폐업·취소·휴업 등) 레코드: ${closed.length}건 / 영업/정상: ${open.length}건`);

const GWANGJU_GU = ['동구', '서구', '남구', '북구', '광산구'];
function fixBadProvinceName(addr) {
  if (!addr || !addr.startsWith('전남광주통합특별시')) return addr;
  const rest = addr.slice('전남광주통합특별시'.length).trim();
  const isGwangju = GWANGJU_GU.some((gu) => rest.startsWith(gu));
  return `${isGwangju ? '광주광역시' : '전라남도'} ${rest}`;
}
function normAddr(a) { return (a || '').replace(/\s+/g, '').replace(/[(),]/g, ''); }
function extractDong(a) {
  const m = (a || '').match(/\(([^)]+)\)/);
  return m ? m[1].split(',')[0].trim() : null;
}
function roadCore(a) {
  const m = (a || '').match(/^(.*?\d+(-\d+)?)/);
  return m ? normAddr(m[1]) : normAddr(a).slice(0, 14);
}

function toRecord(r) {
  return {
    name: r[idx['사업장명']],
    status: r[idx['영업상태명']],
    roadAddr: fixBadProvinceName(r[idx['도로명주소']]),
    lotAddr: fixBadProvinceName(r[idx['지번주소']]),
  };
}
function buildByNameMap(records) {
  const map = new Map();
  for (const r of records) {
    if (!map.has(r.name)) map.set(r.name, []);
    map.get(r.name).push(r);
  }
  return map;
}
// 같은 상호·주소로 여러 인허가 이력(폐업→재등록 등)이 있는 경우가 매우 흔하다(같은 자리에서
// 사업자만 바뀌며 계속 영업). 그래서 "폐업 이력이 있다"만으로는 부족하고, 그 이름+주소에
// 해당하는 "영업/정상" 레코드가 하나도 없을 때만 진짜 폐업으로 간주한다.
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
let totalRemoved = 0;
const removedLog = [];

for (const entry of index) {
  const filePath = path.join(STORES_DIR, entry.file);
  const stores = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const kept = [];

  for (const s of stores) {
    if (!s.id.startsWith('ph_')) { kept.push(s); continue; } // moi_는 이미 "영업/정상"만으로 재생성 예정이라 대상 아님

    const closedMatch = addrMatches(closedByName.get(s.name) || [], s.address);
    const openMatch = addrMatches(openByName.get(s.name) || [], s.address);
    // 폐업 이력은 있지만, 같은 이름+주소로 "영업/정상" 레코드도 있다면(재등록 등) 계속 영업 중인 것 -
    // 폐업 이력만 있고 현재 영업 레코드가 하나도 없을 때만 진짜 폐업으로 간주
    const isClosed = closedMatch && !openMatch;

    if (isClosed) {
      totalRemoved++;
      removedLog.push(`${entry.province} | ${s.name} | ${s.address}`);
    } else {
      kept.push(s);
    }
  }

  if (kept.length !== stores.length) {
    fs.writeFileSync(filePath, JSON.stringify(kept), 'utf-8');
  }
}

console.error(`\n행안부 폐업/취소/휴업 목록과 매칭돼 제거된 E-Gen 항목: ${totalRemoved}건`);
if (removedLog.length) {
  fs.writeFileSync(path.join(__dirname, '.removed-closed-egen.json'), JSON.stringify(removedLog, null, 2), 'utf-8');
  console.error('상세 목록: scripts/.removed-closed-egen.json');
  removedLog.slice(0, 20).forEach(l => console.error('  ', l));
}
