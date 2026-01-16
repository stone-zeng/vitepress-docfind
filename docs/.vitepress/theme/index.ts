import DefaultTheme from 'vitepress/theme';
import DocfindSearch from '../../../src/client/DocfindSearch.vue';
import type { Theme } from 'vitepress';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DocfindSearch', DocfindSearch);
  }
} satisfies Theme;
