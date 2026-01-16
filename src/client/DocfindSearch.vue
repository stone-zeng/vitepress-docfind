<template>
  <div class="docfind" :class="rootClass">
    <input
      v-model="query"
      type="search"
      class="docfind-input"
      :class="inputClass"
      :placeholder="placeholder"
      @input="onSearch"
    />
    <ul v-if="results.length" class="docfind-results" :class="listClass">
      <li
        v-for="item in results"
        :key="item.href"
        class="docfind-item"
        :class="itemClass"
      >
        <a
          :href="resolveHref(item.href)"
          class="docfind-link"
          :class="linkClass"
        >
          <span class="docfind-title" v-html="highlight(item.title)"></span>
          <span
            v-if="item.category"
            class="docfind-category"
            v-html="highlight(item.category)"
          ></span>
          <span
            v-if="item.snippet"
            class="docfind-snippet"
            v-html="item.snippet"
          ></span>
        </a>
      </li>
    </ul>
    <p v-else-if="errorMessage" class="docfind-empty" :class="emptyClass">
      {{ errorMessage }}
    </p>
    <p v-else-if="query" class="docfind-empty" :class="emptyClass">
      {{ emptyText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

export type DocfindResult = {
  title: string;
  category?: string;
  href: string;
};

type DocfindDocument = DocfindResult & {
  body: string;
};

type DocfindResultView = DocfindResult & {
  snippet?: string;
};

const props = withDefaults(
  defineProps<{
    indexBase?: string;
    placeholder?: string;
    limit?: number;
    emptyText?: string;
    errorText?: string;
    rootClass?: string;
    inputClass?: string;
    listClass?: string;
    itemClass?: string;
    linkClass?: string;
    emptyClass?: string;
  }>(),
  {
    indexBase: `${import.meta.env.BASE_URL}docfind`,
    placeholder: "Search docs",
    limit: 10,
    emptyText: "No results",
    errorText: "Search index not found. Run docs:build.",
  }
);

const query = ref("");
const results = ref<DocfindResultView[]>([]);
const errorMessage = ref("");

const indexUrl = computed(() => props.indexBase.replace(/\/$/, ""));
const markClass = "docfind-highlight";
const siteBase = import.meta.env.BASE_URL;

let searchModule: ((query: string) => Promise<DocfindResult[]>) | null = null;
let documentsCache: DocfindDocument[] | null = null;

async function loadSearch() {
  if (searchModule) return searchModule;
  try {
    const mod = await import(/* @vite-ignore */ `${indexUrl.value}/docfind.js`);
    searchModule = mod.default as (query: string) => Promise<DocfindResult[]>;
    return searchModule;
  } catch {
    return null;
  }
}

async function loadDocuments() {
  if (documentsCache) return documentsCache;
  try {
    const response = await fetch(`${indexUrl.value}/documents.json`);
    if (!response.ok) return null;
    const data = (await response.json()) as DocfindDocument[];
    documentsCache = data;
    return data;
  } catch {
    return null;
  }
}

async function fallbackSearch(needle: string) {
  const documents = await loadDocuments();
  if (!documents) return [];
  const term = needle.toLowerCase();
  const matches = documents.filter((doc) => {
    const haystack = `${doc.title} ${doc.category ?? ""} ${
      doc.body
    }`.toLowerCase();
    return haystack.includes(term);
  });
  return matches.map((doc) => ({
    title: doc.title,
    category: doc.category,
    href: doc.href,
  }));
}

async function enrichResults(items: DocfindResult[], needle: string) {
  const documents = await loadDocuments();
  if (!documents) return items.map((item) => ({ ...item }));
  return items.map((item) => {
    const doc = documents.find((entry) => entry.href === item.href);
    const snippet = doc ? buildSnippet(doc.body, needle) : undefined;
    return { ...item, snippet };
  });
}

async function onSearch() {
  errorMessage.value = "";
  const needle = query.value.trim();
  if (!needle) {
    results.value = [];
    return;
  }
  const search = await loadSearch();
  let items: DocfindResult[] = [];
  if (search) {
    try {
      items = await search(needle);
    } catch {
      searchModule = null;
      items = [];
    }
  }
  if (!items.length) {
    items = await fallbackSearch(needle);
  }
  const enriched = await enrichResults(items, needle);
  if (!items.length && !search) {
    errorMessage.value = props.errorText;
  }
  results.value = enriched.slice(0, props.limit);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(value: string) {
  const text = escapeHtml(value);
  const needle = query.value.trim();
  if (!needle) return text;
  const pattern = new RegExp(escapeRegExp(needle), "gi");
  return text.replace(
    pattern,
    (match) => `<mark class="${markClass}">${match}</mark>`
  );
}

function resolveHref(href: string) {
  if (/^https?:\/\//.test(href)) return href;
  if (href.startsWith(siteBase)) return href;
  const base = siteBase.endsWith("/") ? siteBase.slice(0, -1) : siteBase;
  if (href.startsWith("/")) return `${base}${href}`;
  return `${siteBase}${href}`;
}

function buildSnippet(body: string, needle: string) {
  const clean = body.replace(/\s+/g, " ").trim();
  if (!needle) return escapeHtml(clean.slice(0, 160));
  const lower = clean.toLowerCase();
  const term = needle.toLowerCase();
  const index = lower.indexOf(term);
  if (index === -1) return escapeHtml(clean.slice(0, 160));
  const start = Math.max(0, index - 60);
  const end = Math.min(clean.length, index + term.length + 60);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  const slice = clean.slice(start, end);
  return `${prefix}${highlight(slice)}${suffix}`;
}
</script>

<style scoped>
.docfind {
  display: grid;
  gap: 0.75rem;
  max-width: 32rem;
}

.docfind-input {
  border: 1px solid var(--vp-c-divider, #e2e2e2);
  border-radius: 0.5rem;
  padding: 0.6rem 0.8rem;
  font-size: 0.95rem;
  background: var(--vp-c-bg, #fff);
}

.docfind-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.docfind-item {
  border: 1px solid var(--vp-c-divider, #e2e2e2);
  border-radius: 0.5rem;
  padding: 0.6rem 0.8rem;
}

.docfind-link {
  text-decoration: none;
  color: inherit;
  display: grid;
  gap: 0.25rem;
}

.docfind-title {
  font-weight: 600;
}

.docfind-category {
  font-size: 0.8rem;
  color: var(--vp-c-text-2, #666);
}

.docfind-snippet {
  font-size: 0.85rem;
  color: var(--vp-c-text-2, #666);
  line-height: 1.4;
}

.docfind-highlight {
  background: rgba(250, 204, 21, 0.35);
  color: inherit;
  border-radius: 0.2rem;
  padding: 0 0.15rem;
}

.docfind-empty {
  font-size: 0.9rem;
  color: var(--vp-c-text-2, #666);
}
</style>
