/**
 * Get detailed information about a specific Jira project
 */

export default {
  schema: {
    name: "jira_get_project_info",
    description: "Get detailed information about a specific Jira project by its key. Returns name, type, lead, description, and available issue types.",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_key: {
          type: "string",
          description: "The Jira project key (e.g., 'PROJ')",
        },
      },
      required: ["project_key"],
    },
  },
  async execute(input) {
    const { JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

    if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      return {
        output: "Error: Missing Jira credentials. Please configure JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN.",
        isError: true,
      };
    }

    const projectKey = input.project_key;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/project/${projectKey}?expand=lead,description,issueTypes`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Project '${projectKey}' not found.`,
            isError: true,
          };
        }
        const errorText = await response.text();
        return {
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const project = await response.json();

      const lines = [
        `[${project.key}] ${project.name}`,
        "",
        `Type: ${project.projectTypeKey || "Unknown"}`,
        `Style: ${project.style || "Unknown"}`,
        `Lead: ${project.lead?.displayName || "Not set"}`,
        `Category: ${project.projectCategory?.name || "None"}`,
        `URL: ${JIRA_URL}/browse/${project.key}`,
      ];

      // Extract description from ADF if present
      if (project.description) {
        let descText = "";
        if (typeof project.description === "object" && project.description.content) {
          descText = extractAdfText(project.description);
        } else if (typeof project.description === "string") {
          descText = project.description;
        }
        if (descText.trim()) {
          lines.push("");
          lines.push("Description:");
          lines.push(descText.trim());
        }
      }

      // Issue types
      const issueTypes = project.issueTypes || [];
      if (issueTypes.length > 0) {
        lines.push("");
        lines.push("Issue Types:");
        for (const it of issueTypes) {
          const subtask = it.subtask ? " (subtask)" : "";
          lines.push(`  • ${it.name}${subtask}`);
        }
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return {
        output: `Error retrieving project info: ${error.message}`,
        isError: true,
      };
    }
  },
};

function extractAdfText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (Array.isArray(node.content)) {
    const parts = node.content.map(extractAdfText).join("");
    // Add newline after block-level nodes
    const blockTypes = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock"]);
    return blockTypes.has(node.type) ? parts + "\n" : parts;
  }
  return "";
}
