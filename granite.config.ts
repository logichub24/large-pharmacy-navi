import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'large-pharmacy-navi', // 콘솔에 등록한 앱 ID와 반드시 일치해야 함
  brand: {
    displayName: '대형약국',
    primaryColor: '#059669',
    icon: 'https://static.toss.im/appsintoss/32449/fe9026e3-db89-4cb6-8b0d-13b62d146c4b.png',
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
