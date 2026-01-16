# vitepress-docfind

Docfind integration for VitePress.

## Install

Install the docfind CLI and this package.

## VitePress config

```ts
import { defineConfig } from 'vitepress';
import { docfindPlugin } from 'vitepress-docfind';

export default defineConfig({
	vite: {
		plugins: [docfindPlugin()]
	}
});
```

## Component

```vue
<DocfindSearch />
```

```vue
<DocfindSearch
	root-class="mt-6"
	input-class="border-slate-400"
	item-class="border-slate-200"
/>
```

## Demo

The demo lives in the docs folder and uses VitePress.

```bash
pnpm docs:dev
```
