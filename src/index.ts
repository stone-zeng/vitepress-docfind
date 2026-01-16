export type DocfindPluginOptions = {
  docsDir?: string;
  outDir?: string;
  indexDir?: string;
  base?: string;
  cleanUrls?: boolean;
  include?: string[];
  exclude?: string[];
};

export function docfindPlugin(_options: DocfindPluginOptions = {}) {
  return {} as unknown;
}
