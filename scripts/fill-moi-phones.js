// 행안부 전국약국표준데이터 CSV의 "전화번호" 컬럼으로, 전화번호가 없는 moi_ 단독 약국을 채운다.
// moi_ id가 moi_<관리번호> 형식이라 CSV의 관리번호와 정확 매칭된다(퍼지 매칭 불필요).
// app/stores/*.json 과 data/moi-standalone.json 양쪽에 반영해 동기화 후에도 유지되게 한다.
const fs = require('fs');
const path = require('path');

const CSV_PATH = process.argv[2] || path.join(__dirname, '..', '건강_약국_utf8.csv');
const STORES_DIR = path.join(__dirname, '..', 'app', 'stores');
const MOI_FILE = path.join(__dirname, '..', 'data', 'moi-standalone.json');

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

// raw 숫자열을 E-Gen과 같은 하이픈 형식으로. 유효하지 않으면 null.
function formatPhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length < 9) return null; // 02-XXX-XXXX(9) 미만은 불완전
  let area, rest;
  if (d.startsWith('02')) { area = '02'; rest = d.slice(2); }
  else { area = d.slice(0, 3); rest = d.slice(3); } // 031/051/070/010 등 3자리 지역/식별번호
  if (rest.length === 7) return `${area}-${rest.slice(0, 3)}-${rest.slice(3)}`;
  if (rest.length === 8) return `${area}-${rest.slice(0, 4)}-${rest.slice(4)}`;
  return null;
}

console.error('CSV 읽는 중...');
const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf-8'));
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const colMng = idx['관리번호'], colTel = idx['전화번호'];
if (colMng === undefined || colTel === undefined) { console.error('관리번호/전화번호 컬럼을 찾을 수 없습니다.'); process.exit(1); }

// 관리번호 -> 포맷된 전화번호
const phoneByMng = new Map();
for (const r of rows.slice(1)) {
  if (r.length < header.length) continue;
  const p = formatPhone(r[colTel]);
  if (p) phoneByMng.set(r[colMng], p);
}
console.error(`CSV에서 유효 전화번호: ${phoneByMng.size}건`);

function phoneFor(store) {
  if (!store.id.startsWith('moi_')) return null;
  return phoneByMng.get(store.id.slice(4)) || null; // 'moi_' 제거 = 관리번호
}

// moi_ 한 건에 대해: 없으면 CSV로 채우고, 있으면(raw 저장분) E-Gen 형식으로 정규화.
let filled = 0, stillEmpty = 0, reformatted = 0;
function applyPhone(s, province) {
  if (!s.id.startsWith('moi_')) return false;
  if (!s.phone) {
    const p = phoneFor(s);
    if (p) { s.phone = p; filled++; return true; }
    stillEmpty++; return false;
  }
  if (!s.phone.includes('-')) { // 기존 raw 저장분 정규화
    const d = s.phone.replace(/\D/g, '');
    // 서울에서 8자리(02 생략된 지역번호) → 02-XXXX-XXXX
    const raw = (d.length === 8 && province === '서울특별시') ? '02' + d : s.phone;
    const p = formatPhone(raw);
    if (p && p !== s.phone) { s.phone = p; reformatted++; return true; }
  }
  return false;
}

// 1) app/stores/*.json
const index = JSON.parse(fs.readFileSync(path.join(STORES_DIR, 'index.json'), 'utf-8'));
for (const entry of index) {
  const filePath = path.join(STORES_DIR, entry.file);
  const stores = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let changed = false;
  for (const s of stores) { if (applyPhone(s, entry.province)) changed = true; }
  if (changed) fs.writeFileSync(filePath, JSON.stringify(stores), 'utf-8');
}

// 2) data/moi-standalone.json (동기화 유지용)
const moiFile = JSON.parse(fs.readFileSync(MOI_FILE, 'utf-8'));
for (const prov of Object.keys(moiFile)) {
  for (const s of moiFile[prov]) applyPhone(s, prov);
}
fs.writeFileSync(MOI_FILE, JSON.stringify(moiFile), 'utf-8');

console.error(`\n전화번호 채움: ${filled}건, 기존 raw 정규화: ${reformatted}건, 여전히 없음(CSV에도 없음): ${stillEmpty}건`);
