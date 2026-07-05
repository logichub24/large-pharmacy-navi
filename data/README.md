# service-overrides.json

`scripts/pharmacyLocations.js`가 정부 공개데이터(국립중앙의료원 약국 API)로 채울 수 없는
값들(대형약국 여부, 주차, 드라이브 스루, 건강기능식품, 의료기기, 혈압/혈당 측정, 취급 품목)을
사람이 직접 확인해 입력하는 파일입니다. 약국의 `hpid`(국립중앙의료원 기관 ID)를 키로 사용합니다.

동기화 스크립트를 실행하면 이 파일의 값이 자동으로 병합되어 `app/stores/*.json`에 반영됩니다.

## 형식 예시

```json
{
  "A1100001": {
    "large": true,
    "services": {
      "parking": true,
      "driveThrough": false,
      "healthFunctionalFood": true,
      "medicalDevice": true,
      "bloodPressure": true,
      "bloodSugar": false
    },
    "items": ["vitamin", "patch", "digestive", "cold", "probiotics", "omega3", "bp_monitor", "thermometer", "baby"]
  }
}
```

`items`에 넣을 수 있는 값: `vitamin`(비타민), `patch`(파스), `digestive`(소화제), `cold`(감기약),
`probiotics`(유산균), `omega3`(오메가3), `bp_monitor`(혈압계), `thermometer`(체온계), `baby`(유아용품).

`large: true`(대형약국)로 표시하면 앱 상세시트가 "건강 쇼핑" 구성(서비스 배지 + 취급 품목 전체)으로
바뀌고, `large`가 없거나 false면 "조제 가능 여부"만 간결하게 보여주는 일반약국 구성으로 표시됩니다.

`hpid`는 국립중앙의료원 API 응답의 `hpid` 필드이며, `scripts/.pharmacy-sync-cache.json`을 열어
약국명으로 찾아볼 수 있습니다(스크립트를 한 번 이상 실행한 뒤 생성됨).
