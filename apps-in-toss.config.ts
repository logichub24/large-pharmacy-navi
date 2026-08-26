import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 콘솔에 등록한 앱 ID와 반드시 일치해야 함
  appName: 'large-pharmacy-navi',

  brand: {
    primaryColor: '#059669'
  },

  permissions: [
    { name: 'geolocation', access: 'access' },
  ],

  webBundleDir: 'dist'
});
