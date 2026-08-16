/**
 * Get all issue links for a specific Jira issue
 */

export default {
  schema: {
    name: "jira_get_issue_links",
    description: "Get all issue links (e.g., blocks, duplicates, relates to) for a specific Jira issue.",
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

      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}?fields=issuelinks,summary`;
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
      const links = data.fields?.issuelinks || [];

      if (links.length === 0) {
        return {
          output: `No issue links on [${issueKey}].`,
          isError: false,
        };
      }

      const lines = [`Issue links for [${issueKey}]:\n`];

      for (const link of links) {
        const typeName = link.type?.name || "Unknown";
        if (link.outwardIssue) {
          const linked = link.outwardIssue;
          const linkedKey = linked.key;
          const summary = linked.fields?.summary || "No summary";
          const status = linked.fields?.status?.name || "Unknown";
          const direction = link.type?.outward || typeName;
          lines.push(`  ${direction}: [${linkedKey}] ${summary} (${status})`);
        }
        if (link.inwardIssue) {
          const linked = link.inwardIssue;
          const linkedKey = linked.key;
          const summary = linked.fields?.summary || "No summary";
          const status = linked.fields?.status?.name || "Unknown";
          const direction = link.type?.inward || typeName;
          lines.push(`  ${direction}: [${linkedKey}] ${summary} (${status})`);
        }
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return {
        output: `Error retrieving issue links: ${error.message}`,
        isError: true,
      };
    }
  },
};
