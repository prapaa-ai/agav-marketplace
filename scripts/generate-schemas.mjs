#!/usr/bin/env node

/**
 * Generate .schema.json sidecar files for all agent tools.
 * Imports each .mjs to extract the static schema, normalizes
 * `parameters` → `inputSchema`, and writes a companion JSON file.
 *
 * Usage: node scripts/generate-schemas.mjs
 */

import { readdir, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const AGENTS_DIR = resolve(import.meta.dirname, "..", "agents");

async function generateForAgent(agentDir) {
  const toolsDir = join(agentDir, "tools");
  let entries;
  try {
    entries = await readdir(toolsDir);
  } catch {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    if (!entry.endsWith(".mjs") && !entry.endsWith(".js")) continue;

    const toolPath = join(toolsDir, entry);
    try {
      const mod = await import(pathToFileURL(toolPath).href);
      const toolDef = mod.default || mod;
      const schema = toolDef.schema;

      if (!schema || !schema.name) {
        console.warn(`  SKIP ${entry}: no schema.name`);
        continue;
      }

      // Normalize: some tools use `parameters` instead of `inputSchema`
      const outputSchema = {
        name: schema.name,
        description: schema.description || "",
        ...(schema.destructive !== undefined && { destructive: schema.destructive }),
        inputSchema: schema.inputSchema || schema.parameters || {
          type: "object",
          properties: {},
        },
      };

      const sidecarPath = toolPath.replace(/\.(mjs|js)$/, ".schema.json");
      await writeFile(sidecarPath, JSON.stringify(outputSchema, null, 2) + "\n", "utf-8");
      count++;
      console.log(`  ✓ ${entry} → ${entry.replace(/\.(mjs|js)$/, ".schema.json")}`);
    } catch (err) {
      console.error(`  ✗ ${entry}: ${err.message}`);
    }
  }
  return count;
}

async function main() {
  const agentEntries = await readdir(AGENTS_DIR);
  let total = 0;

  for (const name of agentEntries.sort()) {
    const agentDir = join(AGENTS_DIR, name);
    const s = await stat(agentDir).catch(() => null);
    if (!s?.isDirectory()) continue;

    console.log(`\n${name}/`);
    const count = await generateForAgent(agentDir);
    total += count;
  }

  console.log(`\nDone: ${total} schema files generated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
