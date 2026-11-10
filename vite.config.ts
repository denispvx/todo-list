import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const productionPolicy: Plugin = {
  name: 'production-content-policy',
  apply: 'build',
  transformIndexHtml() {
    return [{
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'",
      },
      injectTo: 'head-prepend',
    }];
  },
};

export default defineConfig({
  base: '/todo-list/',
  plugins: [react(), productionPolicy],
});
