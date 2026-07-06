# service-overrides.json

`scripts/pharmacyLocations.js`가 정부 공개데이터(국립중앙의료원 약국 API)로 채울 수 없는
값들(영업면적/등급, 주차, 드라이브 스루, 건강기능식품, 의료기기, 혈압/혈당 측정, 취급 품목)을
사람이 직접 확인해 입력하는 파일입니다. 약국의 `hpid`(국립중앙의료원 기관 ID)를 키로 사용합니다.

동기화 스크립트(`node scripts/pharmacyLocations.js`)를 실행하면 이 파일의 값이 자동으로 병합되어
`app/stores/*.json`에 반영됩니다. API를 다시 부르지 않고 로컬 파일에만 즉시 반영하려면
`node scripts/applyOverrides.js`를 대신 실행하세요.

## 일반·대형·창고형 분류 기준

앱은 **영업면적(㎡)** 기준으로 일반/대형/창고형 3단계를 자동 분류합니다(법적 기준 아님, 앱 자체 기준):

| 등급 | 면적 기준 |
|---|---|
| 일반약국 | 231㎡ 미만 (70평 미만) |
| 대형약국 | 231㎡ 이상 ~ 991㎡ 미만 (70평~300평) |
| 창고형약국 | 991㎡ 이상 (300평 이상) |

면적(`area`)을 알고 있으면 그 값만 등록하면 등급은 **자동 계산**됩니다. 면적을 모르지만
뉴스 등으로 대형/창고형이라는 것만 확인된 경우 `sizeTier`를 직접 지정할 수 있습니다
(이 경우 등급이 고정되며, 나중에 실제 면적을 알게 되면 `area`로 교체하는 걸 권장).

## 형식 예시

```json
{
  "A1100001": {
    "area": 552,
    "services": {
      "parking": true,
      "driveThrough": false,
      "healthFunctionalFood": true,
      "medicalDevice": true,
      "bloodPressure": true,
      "bloodSugar": false
    },
    "items": ["vitamin", "patch", "digestive", "cold", "probiotics", "omega3", "bp_monitor", "thermometer", "baby", "pet"]
  },
  "A1100002": {
    "sizeTier": "large",
    "_source": "면적 데이터 없이 뉴스 보도만으로 확인된 경우"
  }
}
```

`items`에 넣을 수 있는 값: `vitamin`(비타민), `patch`(파스), `digestive`(소화제), `cold`(감기약),
`probiotics`(유산균), `omega3`(오메가3), `bp_monitor`(혈압계), `thermometer`(체온계), `baby`(유아용품),
`pet`(동물용품).

`sizeTier`가 `large` 또는 `warehouse`로 분류되면 앱에서 두 가지가 바뀝니다: (1) 지도/전체목록
상단의 전체·일반약국·대형약국·창고형약국 4분할 선택에서 해당 등급으로 집계·필터링되고,
(2) 상세시트가 "건강 쇼핑" 구성(서비스 배지 + 취급 품목 전체)으로 표시됩니다. `general`이면
상세시트도 "조제 가능 여부"만 간결하게 보여주는 구성이 됩니다.

## 면적 데이터 대량 확보 방법 (행정안전부 전국약국표준데이터)

data.go.kr에서 "전국약국표준데이터"(지방행정인허가데이터)를 CSV로 내려받으면 `약국영업면적`
필드가 포함되어 있습니다. 이 CSV로 대량 큐레이션하는 절차:

1. CSV를 UTF-8로 변환(원본은 보통 CP949 인코딩)
2. `node scripts/analyze-moi-data.js <csv경로>` - 폐업 제외, 231㎡ 이상만 추려
   `scripts/.moi-large-candidates.json`에 저장
3. `node scripts/compare-moi-with-egen.js` - 이름+주소로 우리 실데이터(hpid)와 매칭해
   `scripts/.moi-match-result.json`에 저장
4. `node scripts/merge-moi-areas.js` - 매칭된 곳의 `area`를 `service-overrides.json`에 병합
5. `node scripts/applyOverrides.js` - 로컬 `app/stores/*.json`에 즉시 반영
6. `node scripts/add-moi-standalone.js` - 4번에서도 매칭 실패한 곳을 독립 매장으로 추가
   (행안부 데이터 자체에 좌표(EPSG:5174)가 있으므로 E-Gen 매칭 없이도 위치 표기 가능.
   `proj4`로 WGS84 변환. 단, 국립중앙의료원 운영시간 데이터가 없어 `hours: null`로
   저장되고, 앱에서는 "영업시간 정보 없음"으로 정직하게 표시됨 - 가짜 시간을 채우지 않음)

이름+주소 자동 매칭이라 일부(전국 데이터 기준 약 20~30%)는 실패할 수 있습니다
(신규 개설이라 아직 우리 데이터에 없거나, 상호명이 다르게 등록된 경우 등).
매칭 실패 목록은 `scripts/.moi-match-result.json`의 `unmatched`에서 확인할 수 있고,
좌표가 있는 건은 6번 스크립트로 구제됩니다(좌표 자체가 없는 나머지는 진짜로 표기 불가).

`hpid`는 국립중앙의료원 API 응답의 `hpid` 필드이며, `scripts/.pharmacy-sync-cache.json`을 열어
약국명으로 찾아볼 수 있습니다(스크립트를 한 번 이상 실행한 뒤 생성됨).
