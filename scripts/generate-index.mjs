#!/usr/bin/env node

/**
 * Generate index.json by walking agents/<name>/ directories.
 * Reads AGENT.md frontmatter for metadata, lists files,
 * counts tools, and detects destructive permissions.
 *
 * Usage: node scripts/generate-index.mjs
 */

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const AGENTS_DIR = join(ROOT_DIR, "agents");
const INDEX_PATH = join(ROOT_DIR, "index.json");

/** Tag-to-category inference priority (first match wins). */
const TAG_CATEGORY_RULES = [
  { tags: ["project-management"], category: "project-management" },
  { tags: ["code-review", "pr", "merge-requests"], category: "code-review" },
  { tags: ["pipelines", "ci-cd", "gitops"], category: "devops" },
  { tags: ["cloud", "google-cloud"], category: "cloud" },
  { tags: ["kubernetes", "k8s"], category: "infrastructure" },
  { tags: ["automation", "computer-use", "browser", "desktop"], category: "automation" },
];

/**
 * Parse YAML frontmatter from AGENT.md content.
 * Handles simple key-value pairs, inline arrays [a, b, c],
 * and indented map entries (key: value under a parent key).
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const lines = match[1].split(/\r?\n/);
  const result = {};
  let currentMapKey = null;

  for (const line of lines) {
    // Skip blank lines
    if (!line.trim()) continue;

    // Indented map entry (e.g. "  tool_name: safe")
    const indentedMatch = line.match(/^  (\S.*?):\s*(.*)$/);
    if (indentedMatch && currentMapKey) {
      if (typeof result[currentMapKey] !== "object" || Array.isArray(result[currentMapKey])) {
        result[currentMapKey] = {};
      }
      result[currentMapKey][indentedMatch[1].trim()] = indentedMatch[2].trim();
      continue;
    }

    // Top-level key: value
    const kvMatch = line.match(/^(\S.*?):\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1].trim();
    const rawValue = kvMatch[2].trim();

    // Inline array [a, b, c]
    const arrayMatch = rawValue.match(/^\[(.*)\]$/);
    if (arrayMatch) {
      result[key] = arrayMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      currentMapKey = null;
      continue;
    }

    // Empty value or list/map parent → prepare for indented children
    if (rawValue === "" || rawValue === "[]") {
      result[key] = rawValue === "[]" ? [] : {};
      currentMapKey = key;
      continue;
    }

    result[key] = rawValue;
    currentMapKey = key;
  }

  return result;
}

/**
 * Recursively list all files under a directory, returning
 * paths relative to `baseDir` using forward slashes.
 */
async function listFilesRecursive(dir, baseDir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath, baseDir)));
    } else {
      files.push(relative(baseDir, fullPath).replace(/\\/g, "/"));
    }
  }

  return files.sort();
}

/**
 * Infer category from tags using TAG_CATEGORY_RULES.
 */
function inferCategory(tags) {
  for (const rule of TAG_CATEGORY_RULES) {
    if (tags.some((t) => rule.tags.includes(t))) {
      return rule.category;
    }
  }
  return "automation";
}

async function main() {
  // Load existing index.json for category overrides and structure
  let existingIndex = { version: "1.0.0", agents: [], categories: [] };
  try {
    const raw = await readFile(INDEX_PATH, "utf-8");
    existingIndex = JSON.parse(raw);
  } catch {
    // First run — use defaults
  }

  // Build a name → category lookup from the existing index
  const existingCategories = {};
  for (const agent of existingIndex.agents || []) {
    existingCategories[agent.name] = agent.category;
  }

  const agentEntries = await readdir(AGENTS_DIR);
  const agents = [];

  for (const name of agentEntries.sort()) {
    const agentDir = join(AGENTS_DIR, name);
    const s = await stat(agentDir).catch(() => null);
    if (!s?.isDirectory()) continue;

    // Read and parse AGENT.md
    const agentMdPath = join(agentDir, "AGENT.md");
    let frontmatter = {};
    try {
      const content = await readFile(agentMdPath, "utf-8");
      frontmatter = parseFrontmatter(content);
    } catch {
      console.warn(`  SKIP ${name}: no AGENT.md`);
      continue;
    }

    if (!frontmatter.name) {
      console.warn(`  SKIP ${name}: no name in frontmatter`);
      continue;
    }

    // List all files under the agent directory
    const files = await listFilesRecursive(agentDir, agentDir);

    // Count .mjs files in tools/
    const toolCount = files.filter(
      (f) => f.startsWith("tools/") && f.endsWith(".mjs"),
    ).length;

    // Check tool-permissions for any destructive entries
    const toolPermissions = frontmatter["tool-permissions"] || {};
    const hasDestructiveTools = Object.values(toolPermissions).some(
      (v) => v === "destructive",
    );

    // Resolve tags
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];

    // Category: prefer existing index value, then infer from tags
    const category =
      existingCategories[frontmatter.name] || inferCategory(tags);

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description || "",
      category,
      tags,
      version: frontmatter.version || "1.0.0",
      path: `agents/${name}`,
      "tool-count": toolCount,
      "has-destructive-tools": hasDestructiveTools,
      files,
    });

    console.log(`  ${name}: ${toolCount} tools, ${files.length} files`);
  }

  const index = {
    version: existingIndex.version || "1.0.0",
    agents,
    categories: existingIndex.categories || [],
  };

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf-8");
  console.log(`\nDone: ${agents.length} agents written to index.json.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
