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
        : "docs";
    const href = fileToHref(entry, base, options.cleanUrls);
    documents.push({ title, category, href, body: parsed.content.trim() });
  }

  return documents;
}

async function buildIndex(options: Required<DocfindPluginOptions>, targetDir: string) {
  const documents = await collectDocuments(options);
  const documentsPath = path.join(targetDir, "documents.json");
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(documentsPath, JSON.stringify(documents, null, 2));
  await runDocfind(documentsPath, targetDir);
}

function getContentType(filePath: string) {
  if (filePath.endsWith(".js")) return "text/javascript";
  if (filePath.endsWith(".wasm")) return "application/wasm";
  if (filePath.endsWith(".json")) return "application/json";
  return "application/octet-stream";
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
  const resolvedDevIndexDir = path.resolve(
    cwd,
    options.indexDir ?? path.join(resolvedDocsDir, ".vitepress/cache/docfind")
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
  const basePath = resolveBase(resolvedOptions.base);
  const indexMount = `${basePath}/docfind/`;

  return {
    name: "vitepress-docfind",
    async configureServer(server) {
      const logger = server.config.logger;
      let building = false;
      let pending = false;

      const rebuild = async () => {
        if (building) {
          pending = true;
          return;
        }
        building = true;
        try {
          await buildIndex(resolvedOptions, resolvedDevIndexDir);
          logger.info("docfind: index updated");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`docfind: ${message}`);
        } finally {
          building = false;
          if (pending) {
            pending = false;
            await rebuild();
          }
        }
      };

      server.watcher.on("add", (file) => {
        if (file.startsWith(resolvedDocsDir) && file.endsWith(".md")) rebuild();
      });
      server.watcher.on("change", (file) => {
        if (file.startsWith(resolvedDocsDir) && file.endsWith(".md")) rebuild();
      });
      server.watcher.on("unlink", (file) => {
        if (file.startsWith(resolvedDocsDir) && file.endsWith(".md")) rebuild();
      });

      await rebuild();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const url = req.url.split("?")[0];
        if (!url.startsWith(indexMount)) return next();
        const relPath = decodeURIComponent(url.slice(indexMount.length));
        const filePath = path.join(resolvedDevIndexDir, relPath);
        if (!filePath.startsWith(resolvedDevIndexDir)) return next();
        try {
          const data = await fs.readFile(filePath);
          res.statusCode = 200;
          res.setHeader("Content-Type", getContentType(filePath));
          res.end(data);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
    },
    async closeBundle() {
      try {
        await buildIndex(resolvedOptions, resolvedIndexDir);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`docfind failed: ${message}`);
      }
    },
  };
}
