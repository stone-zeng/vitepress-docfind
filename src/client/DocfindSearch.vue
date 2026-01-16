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
        <a :href="item.href" class="docfind-link" :class="linkClass">
          <span class="docfind-title">{{ item.title }}</span>
          <span v-if="item.category" class="docfind-category">{{
            item.category
          }}</span>
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
    errorText: "Search index not found. Run docs:build."
  }
);

const query = ref("");
const results = ref<DocfindResult[]>([]);
const errorMessage = ref("");

const indexUrl = computed(() => props.indexBase.replace(/\/$/, ""));

let searchModule: ((query: string) => Promise<DocfindResult[]>) | null = null;

async function loadSearch() {
  if (searchModule) return searchModule;
  try {
    const mod = await import(/* @vite-ignore */ `${indexUrl.value}/docfind.js`);
    searchModule = mod.default as (query: string) => Promise<DocfindResult[]>;
    return searchModule;
  } catch {
    errorMessage.value = props.errorText;
    return null;
  }
}

async function onSearch() {
  errorMessage.value = "";
  if (!query.value.trim()) {
    results.value = [];
    return;
  }
  const search = await loadSearch();
  if (!search) return;
  const items = await search(query.value.trim());
  results.value = items.slice(0, props.limit);
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

.docfind-empty {
  font-size: 0.9rem;
  color: var(--vp-c-text-2, #666);
}
</style>
