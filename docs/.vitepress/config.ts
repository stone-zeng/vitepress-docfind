import { defineConfig } from 'vitepress';
import { docfindPlugin } from '../../src/index';

export default defineConfig({
  title: 'Docfind Demo',
  description: 'VitePress with Docfind search',
  vite: {
    plugins: [docfindPlugin()]
  }
});
