/**
 * Get available workflow transitions for a Jira issue
 */

export default {
  schema: {
    name: "jira_get_available_transitions",
    description: "Get all available workflow transitions for a Jira issue. Use this before transitioning an issue to find valid transition IDs and their target statuses.",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
        },
      },
      required: ["issue_key"],
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

    const issueKey = input.issue_key;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}/transitions`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        const errorText = await response.text();
        return {
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const data = await response.json();
      const transitions = data.transitions || [];

      if (transitions.length === 0) {
        return {
          output: `No transitions available for [${issueKey}].`,
          isError: false,
        };
      }

      const lines = [`Available transitions for [${issueKey}]:\n`];

      for (const t of transitions) {
        const toStatus = t.to?.name || "Unknown";
        const toCategory = t.to?.statusCategory?.name || "";
        const categoryNote = toCategory ? ` [${toCategory}]` : "";
        lines.push(`  ${t.id}: ${t.name} → ${toStatus}${categoryNote}`);
      }

      lines.push("\nUse the transition ID with jira_transition_issue to apply a transition.");

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return {
        output: `Error retrieving transitions: ${error.message}`,
        isError: true,
      };
    }
  },
};
