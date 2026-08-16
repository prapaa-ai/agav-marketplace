# agav Marketplace

Community-built agents for [agav](https://github.com/prapaa-ai/agav), a terminal-native AI coding assistant. Each agent extends agav with specialized tools for extended developer workflows and automation.

## Available agents

| Agent                      | Category           | Tools | Description                                                                             |
| -------------------------- | ------------------ | ----- | --------------------------------------------------------------------------------------- |
| [jira](agents/jira/)       | Project Management | 21    | Jira — issues, projects, transitions, comments, links, labels, assignments              |
| [win-cua](agents/win-cua/) | Automation         | 13    | Windows desktop automation — mouse, keyboard, clipboard, screenshots, window management |

## Quick start

### 1. Configure agav to use this marketplace

Add `agentMarketplace` to `~/.agav/config.json`:

```json
{
  "agentMarketplace": "https://raw.githubusercontent.com/prapaa-ai/agav-marketplace/main"
}
```

Or set the environment variable (takes priority over config):

```bash
export AGAV_MARKETPLACE_URL=https://raw.githubusercontent.com/prapaa-ai/agav-marketplace/main
```

### 2. Browse and install from the TUI

```
/agents → [2] Marketplace
```

Navigate with `↑`/`↓`, page with `←`/`→`, search with `s`. Press `ENTER` on an agent to install it.

### 3. Or install via CLI

```bash
agav agents install <marketplace-raw-url>/agents/jira
agav agents install <marketplace-raw-url>/agents/win-cua --destination project

# marketplace-raw-url: https://raw.githubusercontent.com/prapaa-ai/agav-marketplace
```

### 4. Configure credentials

After installing, open the TUI and press `i` to inspect, then `e` to open the credential editor:

```
/agents → [1] List → select agent → i → e
```

Enter the required API tokens and URLs. Values are encrypted at rest.

## Repository layout

```
agav-marketplace/
├── index.json              # Agent registry — fetched by agav at runtime
├── README.md
└── agents/
    └── <agent-name>/
        ├── AGENT.md        # Manifest (YAML front-matter) + system prompt
        ├── README.md       # Human-readable description and credential docs
        └── tools/
            └── *.mjs       # One ES module per tool
```

### Why agent directories are gitignored

The `.gitignore` excludes agent directories from being committed. This is intentional for local development — agent directories can accumulate local `config.json` files containing encrypted credentials, and those should never be committed. When contributing a new agent, add only the `AGENT.md` and `tools/` files, and ensure `config.json` is not included.

## index.json format

```json
{
  "version": "1.0.0",
  "categories": [
    { "id": "devops", "name": "DevOps" },
    { "id": "cloud", "name": "Cloud" },
    { "id": "code-review", "name": "Code Review" },
    { "id": "project-management", "name": "Project Management" },
    { "id": "infrastructure", "name": "Infrastructure" },
    { "id": "automation", "name": "Automation" }
  ],
  "agents": [
    {
      "name": "jira",
      "description": "Jira agent for issue tracking, project management, and workflow automation",
      "category": "project-management",
      "tags": ["jira", "issue-tracking", "project-management", "workflow"],
      "version": "1.0.0",
      "path": "agents/jira",
      "tool-count": 21,
      "has-destructive-tools": true
    }
  ]
}
```

All fields are required. `path` is the relative path from the repo root to the agent directory. `has-destructive-tools` is `true` if any tool is classified as `modifies` (creates, edits, or deletes data).

## AGENT.md format

```markdown
---
name: my-agent
description: One-line description shown in the catalog
version: 1.0.0
type: native
required-config:
  - MY_API_TOKEN
  - MY_API_BASE_URL
tools-dir: ./tools
tags: [my-api, records]
tool-permissions:
  my_agent_list_records: safe
  my_agent_create_entry: modifies
  my_agent_delete_entry: modifies
enabled: true
---

# My Agent

System prompt content. Keep it brief: one role sentence and 3–5 guideline bullets.
Tool schemas carry the capability details — don't repeat them here.
```

`tool-permissions` values are `safe` (read-only, no confirmation) or `modifies` (writes/deletes, requires user confirmation).

## Tool file format

```js
// tools/list-records.mjs
export default {
  schema: {
    name: "my_agent_list_records",
    description: "List records from My API",
    destructive: false, // false = safe, true = modifies
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results", default: 20 },
      },
    },
  },
  async execute(input) {
    const { MY_API_TOKEN, MY_API_BASE_URL } = process.env;
    if (!MY_API_TOKEN)
      return { output: "Error: Missing MY_API_TOKEN", isError: true };

    const res = await fetch(
      `${MY_API_BASE_URL}/records?limit=${input.limit ?? 20}`,
      {
        headers: { Authorization: `Bearer ${MY_API_TOKEN}` },
      },
    );
    if (!res.ok) return { output: `API error ${res.status}`, isError: true };

    const { records } = await res.json();
    return {
      output:
        records.map((r) => `• ${r.id}: ${r.title}`).join("\n") || "No records.",
      isError: false,
    };
  },
};
```

**Rules:**

- Credentials come from `process.env` — agav injects them from the user's encrypted config at runtime
- Always return `{ output: string, isError: boolean }`
- Use `fetch()` and Node.js built-ins (`node:fs`, `node:path`, etc.) — no npm packages
- `schema.name` must match the key in `tool-permissions` in AGENT.md
- Mark any tool that writes, updates, or deletes data as `destructive: true`

## Contributing

1. Create `agents/<your-agent>/` with `AGENT.md` and `tools/*.mjs`
2. Add a `README.md` inside the agent directory documenting required credentials and tool descriptions
3. Add an entry to `index.json`
4. Open a pull request

Agents are reviewed for: correct `tool-permissions` classification, credential handling (no hardcoded values), and meaningful tool descriptions that help the LLM choose the right tool.
