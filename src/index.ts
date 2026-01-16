import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import fg from "fast-glob";
import matter from "gray-matter";
import type { Plugin } from "vite";

export type DocfindPluginOptions = {
  docsDir?: string;
  outDir?: string;
  indexDir?: string;
  base?: string;
  cleanUrls?: boolean;
  include?: string[];
  exclude?: string[];
};

type DocfindDocument = {
  title: string;
  category?: string;
  href: string;
  body: string;
};

const defaultExclude = ["**/node_modules/**", "**/.vitepress/**"];

function resolveBase(base: string | undefined) {
  if (!base || base === "/") return "";
  return `/${base.replace(/^\/+|\/+$/g, "")}`;
}

function fileToHref(file: string, base: string, cleanUrls: boolean) {
  const unixPath = file.replace(/\\/g, "/");
  let pathPart = unixPath.replace(/\.md$/, "");
  if (pathPart.endsWith("/index")) {
    pathPart = pathPart.slice(0, -"/index".length);
  }
  const suffix = cleanUrls ? "/" : ".html";
  const raw = pathPart ? `/${pathPart}${suffix}` : "/";
  return `${base}${raw}`.replace(/\/+/g, "/");
}

function inferTitle(content: string) {
  const line = content.split(/\r?\n/).find((item) => item.startsWith("# "));
  return line ? line.replace(/^#\s+/, "").trim() : "Untitled";
}

async function runDocfind(documentsPath: string, indexDir: string) {
  await fs.mkdir(indexDir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn("docfind", [documentsPath, indexDir], {
      stdio: "inherit",
    });
    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docfind exited with code ${code}`));
    });
  });
}

async function collectDocuments(options: Required<DocfindPluginOptions>) {
  const entries = await fg(options.include, {
    cwd: options.docsDir,
    ignore: options.exclude,
    dot: false,
  });

  const base = resolveBase(options.base);
  const documents: DocfindDocument[] = [];

  for (const entry of entries) {
    const filePath = path.join(options.docsDir, entry);
    const source = await fs.readFile(filePath, "utf8");
    const parsed = matter(source);
    if (parsed.data?.search === false) continue;

    const title =
      typeof parsed.data?.title === "string"
        ? parsed.data.title
        : inferTitle(parsed.content);
    const category =
      typeof parsed.data?.category === "string"
        ? parsed.data.category
        : undefined;
    const href = fileToHref(entry, base, options.cleanUrls);
    documents.push({ title, category, href, body: parsed.content.trim() });
  }

  return documents;
}

export function docfindPlugin(options: DocfindPluginOptions = {}): Plugin {
  const cwd = process.cwd();
  const resolvedDocsDir = path.resolve(cwd, options.docsDir ?? "docs");
  const resolvedOutDir = path.resolve(
    cwd,
    options.outDir ?? path.join(resolvedDocsDir, ".vitepress/dist")
  );
  const resolvedIndexDir = path.resolve(
    cwd,
    options.indexDir ?? path.join(resolvedOutDir, "docfind")
  );
  const resolvedOptions: Required<DocfindPluginOptions> = {
    docsDir: resolvedDocsDir,
    outDir: resolvedOutDir,
    indexDir: resolvedIndexDir,
    base: options.base ?? "/",
    cleanUrls: options.cleanUrls ?? true,
    include: options.include ?? ["**/*.md"],
    exclude: options.exclude ?? defaultExclude,
  };

  return {
    name: "vitepress-docfind",
    apply: "build",
    async closeBundle() {
      const documents = await collectDocuments(resolvedOptions);
      const documentsPath = path.join(resolvedIndexDir, "documents.json");
      await fs.mkdir(resolvedIndexDir, { recursive: true });
      await fs.writeFile(documentsPath, JSON.stringify(documents, null, 2));
      try {
        await runDocfind(documentsPath, resolvedIndexDir);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`docfind failed: ${message}`);
      }
    },
  };
}
