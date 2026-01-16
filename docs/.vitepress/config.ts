import { defineConfig } from "vitepress";
import { docfindPlugin } from "../../src/index";

export default defineConfig({
  title: "Docfind Demo",
  description: "VitePress with Docfind search",
  themeConfig: {
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Home", link: "/" },
          { text: "Guide", link: "/guide" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Advanced", link: "/advanced" },
          { text: "Samples", link: "/samples" },
        ],
      },
    ],
  },
  vite: {
    plugins: [docfindPlugin()],
  },
});
