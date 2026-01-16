# Guide

Docfind indexes markdown files after the site build finishes.

## Usage

Add the plugin in VitePress config and register the search component in the theme.

```ts
import { defineConfig } from "vitepress";
import { docfindPlugin } from "vitepress-docfind";

export default defineConfig({
	vite: {
		plugins: [docfindPlugin()],
	},
});
```

```ts
import DefaultTheme from "vitepress/theme";
import DocfindSearch from "vitepress-docfind/component";
import type { Theme } from "vitepress";

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component("DocfindSearch", DocfindSearch);
	},
} satisfies Theme;
```

## Features

- Build-time search index
- Client-side search
- Simple Vue component

## Result Fields

Each result includes:

- title
- category
- href

## Styling

Use utility classes or custom CSS. The highlight markup uses the class .docfind-highlight.

## Example Queries

Search for "component", "search", "index", and "highlight" to verify ranking and highlighting.
