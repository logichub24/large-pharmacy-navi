// 토스인앱(Apps in Toss) 광고 SDK 연동.
// 일반 브라우저(GitHub Pages 등)에서는 isSupported()가 false라 전부 조용히 no-op되고,
// 토스 앱 WebView 안에서 열렸을 때만 실제 광고가 붙는다.
//
// 아래 광고 그룹 ID는 예시 placeholder입니다. 앱인토스 콘솔에서 이 앱으로 별도 발급받은
// 실제 ID로 교체해야 광고가 표시됩니다.
import { TossAds, loadFullScreenAd, showFullScreenAd, getCurrentLocation, Accuracy } from 'https://esm.sh/@apps-in-toss/web-bridge@2.9.2';

const AD_CONFIG = {
  banner: 'YOUR_BANNER_AD_GROUP_ID',
  interstitial: 'YOUR_INTERSTITIAL_AD_GROUP_ID',
};

const INTERSTITIAL_EVERY_N_STORE_OPENS = 4;
let storeOpenCount = 0;
let interstitialReady = false;

function loadInterstitial() {
  if (!loadFullScreenAd.isSupported || !loadFullScreenAd.isSupported()) return;
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
  if (!TossAds.initialize.isSupported || !TossAds.initialize.isSupported()) return; // 토스 앱이 아니면 전부 스킵

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
