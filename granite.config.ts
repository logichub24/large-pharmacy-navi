import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'large-pharmacy-navi', // 콘솔에 등록한 앱 ID와 반드시 일치해야 함
  brand: {
    displayName: '대형약국',
    primaryColor: '#059669',
    icon: '', // 콘솔에 등록한 로고 URL로 교체
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'node scripts/build-toss.js',
      build: 'node scripts/build-toss.js',
    },
  },
  permissions: [
    { name: 'geolocation', access: 'access' },
  ],
  outdir: 'dist',
});
