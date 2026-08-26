// 토스인앱(Apps in Toss) 광고 SDK 연동.
// 일반 브라우저(GitHub Pages 등)에서는 SDK 상수 접근이 예외를 던질 수 있어 전부 조용히 no-op되고,
// 토스 앱 WebView 안에서 열렸을 때만 실제 광고가 붙는다.
//
// 앱인토스 콘솔에서 이 앱으로 발급받은 실제 광고 그룹 ID(live).
import { TossAds, loadFullScreenAd, showFullScreenAd, getCurrentLocation, Accuracy } from 'https://esm.sh/@apps-in-toss/web-framework@3.1.1';

const AD_CONFIG = {
  banner: 'ait.v2.live.ebd5bc82cd084fe6',
  interstitial: 'ait.v2.live.41fab208a62d4ad4',
  reward: 'ait.v2.live.11e75add17f64d1f', // 발급받았으나 보상 로직 미연동 - 보상 구조 확정 후 붙일 예정
};

const INTERSTITIAL_EVERY_N_STORE_OPENS = 4;
let storeOpenCount = 0;
let interstitialReady = false;

function isSupported(api) {
  try { return typeof api?.isSupported === 'function' && api.isSupported(); } catch { return false; }
}

function loadInterstitial() {
  if (!isSupported(loadFullScreenAd)) return;
  loadFullScreenAd({
    options: { adGroupId: AD_CONFIG.interstitial },
    onEvent: (event) => { if (event.type === 'loaded') interstitialReady = true; },
    onError: () => { interstitialReady = false; },
  });
}

// 약국 상세를 N번째 열 때 전면 광고 노출 (너무 자주 끼우면 이탈률이 올라가므로 빈도 제한)
window.onStoreOpened = function onStoreOpened() {
  storeOpenCount++;
  if (storeOpenCount % INTERSTITIAL_EVERY_N_STORE_OPENS !== 0) return;
  if (!interstitialReady) return;

  showFullScreenAd({
    options: { adGroupId: AD_CONFIG.interstitial },
    onEvent: (event) => {
      if (event.type === 'dismissed' || event.type === 'failedToShow') {
        interstitialReady = false;
        loadInterstitial();
      }
    },
    onError: () => {},
  });
};

// 토스 앱 안에서는 navigator.geolocation이 막혀있을 수 있어 SDK 전용 위치 정보 함수를 써야 함.
window.tossGetCurrentLocation = function tossGetCurrentLocation() {
  return getCurrentLocation({ accuracy: Accuracy.Balanced });
};

function init() {
  if (!isSupported(TossAds.initialize)) return; // 토스 앱이 아니면 전부 스킵

  document.body.classList.add('in-toss-app');

  TossAds.initialize({
    callbacks: {
      onInitialized: () => {
        const slot = document.getElementById('adBannerSlot');
        if (slot) TossAds.attachBanner(AD_CONFIG.banner, slot);
        loadInterstitial();
      },
    },
  });
};

document.addEventListener('DOMContentLoaded', init);
