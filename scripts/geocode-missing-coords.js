// scripts/.moi-match-result.json의 unmatched 중 좌표(X,Y) 필드 자체가 비어있는 항목을
// 브이월드 주소검색 API로 직접 지오코딩한다(도로명주소 → 실패 시 지번주소로 재시도).
// 이 API는 결과를 WGS84로 바로 주므로 EPSG:5174 변환이 필요 없다.
//
// 사용법: node scripts/geocode-missing-coords.js
// .env 에 VWORLD_KEY=발급받은키 한 줄 있으면 자동으로 읽는다.

const fs = require('fs');
const path = require('path');
const axios = require('axios');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const VWORLD_KEY = process.env.VWORLD_KEY;
const CACHE_FILE = path.join(__dirname, '.moi-geocode-cache.json');
const OUT_FILE = path.join(__dirname, '.moi-geocoded.json');

// 원본 CSV 일부 레코드(전남/광주 지역)에 "전남광주통합특별시"라는 잘못된 시/도명이 붙어있어
// (전라남도와 광주광역시가 뒤섞인, 실존하지 않는 행정구역명) 이걸 그대로 지오코딩에 보내면
// 브이월드가 엉뚱한 동명 도로로 잘못 매칭한다(add-moi-standalone.js와 동일한 보정 로직).
const GWANGJU_GU = ['동구', '서구', '남구', '북구', '광산구'];
function fixBadProvinceName(addr) {
  if (!addr || !addr.startsWith('전남광주통합특별시')) return addr;
  const rest = addr.slice('전남광주통합특별시'.length).trim();
  const isGwangju = GWANGJU_GU.some((gu) => rest.startsWith(gu));
  return `${isGwangju ? '광주광역시' : '전라남도'} ${rest}`;
}

async function searchAddress(query, category) {
  const { data } = await axios.get('https://api.vworld.kr/req/search', {
    params: { service: 'search', request: 'search', version: '2.0', query, type: 'address', category, format: 'json', key: VWORLD_KEY },
    timeout: 10000,
  });
  const items = data?.response?.status === 'OK' ? data.response.result.items : [];
  return items[0] || null;
}

async function geocode(candidate) {
  const roadAddr = fixBadProvinceName(candidate.roadAddr);
  const lotAddr = fixBadProvinceName(candidate.lotAddr);
  if (roadAddr) {
    const r = await searchAddress(roadAddr, 'road');
    if (r) return { lat: parseFloat(r.point.y), lng: parseFloat(r.point.x) };
  }
  if (lotAddr) {
    const r = await searchAddress(lotAddr, 'parcel');
    if (r) return { lat: parseFloat(r.point.y), lng: parseFloat(r.point.x) };
  }
  return null;
}

async function run() {
  if (!VWORLD_KEY) {
    console.error('VWORLD_KEY 환경변수가 필요합니다(.env에 추가하세요). https://www.vworld.kr 에서 무료 발급.');
    process.exit(1);
  }

  const { unmatched } = JSON.parse(fs.readFileSync(path.join(__dirname, '.moi-match-result.json'), 'utf-8'));
  const targets = unmatched.filter((c) => !c.x5174 || !c.y5174 || isNaN(c.x5174) || isNaN(c.y5174));
  console.error(`좌표 없는 미매칭 ${targets.length}건 지오코딩 시작`);

  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) : {};
  let done = 0, found = 0, failed = 0;

  for (const c of targets) {
    done++;
    if (done % 50 === 0) console.error(`  진행 ${done}/${targets.length} (성공 ${found}, 실패 ${failed})`);
    if (cache[c.manageNo] !== undefined) { if (cache[c.manageNo]) found++; else failed++; continue; }

    try {
      const result = await geocode(c);
      cache[c.manageNo] = result; // 실패해도 null로 캐시해서 재실행 시 다시 안 부름
      if (result) found++; else failed++;
    } catch (e) {
      console.error(`지오코딩 오류 (${c.name}):`, e.message);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 120));
    if (done % 20 === 0) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8'); // 주기적 저장(중단 대비)
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8');

  const geocoded = targets
    .filter((c) => cache[c.manageNo])
    .map((c) => ({ ...c, lat: cache[c.manageNo].lat, lng: cache[c.manageNo].lng }));

  fs.writeFileSync(OUT_FILE, JSON.stringify(geocoded), 'utf-8');
  console.error(`\n지오코딩 완료: 성공 ${found}건, 실패 ${failed}건`);
  console.error(`scripts/.moi-geocoded.json 저장 완료 (${geocoded.length}건)`);
}

run();
