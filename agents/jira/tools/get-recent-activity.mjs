/**
 * Get recently updated Jira issues across all projects
 */

export default {
  schema: {
    name: "jira_get_recent_activity",
    description: "Get recently updated Jira issues across all accessible projects. Useful for a daily standup or project health check.",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "How many days back to look (default: 7)",
          default: 7,
        },
        max_results: {
          type: "number",
          description: "Maximum number of issues to return (default: 20)",
          default: 20,
        },
      },
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

    const days = input.days || 7;
    const maxResults = input.max_results || 20;
    const jql = `updated >= -${days}d ORDER BY updated DESC`;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/search/jql`;
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jql,
          maxResults,
          fields: ["summary", "status", "updated", "assignee", "issuetype", "priority"],
        }),
      });

      if (!response.ok) {
        // Fall back to GET-based search if POST JQL endpoint is not available
        if (response.status === 404 || response.status === 405) {
          const fallbackUrl = `${JIRA_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,updated,assignee,issuetype,priority`;
          const fallbackResponse = await fetch(fallbackUrl, { headers });
          if (!fallbackResponse.ok) {
            const errorText = await fallbackResponse.text();
            return {
              output: `Jira API error (${fallbackResponse.status}): ${errorText}`,
              isError: true,
            };
          }
          const fallbackData = await fallbackResponse.json();
          return formatResults(fallbackData.issues || [], days);
        }
        const errorText = await response.text();
        return {
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const data = await response.json();
      return formatResults(data.issues || [], days);
    } catch (error) {
      return {
        output: `Error retrieving recent activity: ${error.message}`,
        isError: true,
      };
    }
  },
};

function formatResults(issues, days) {
  if (issues.length === 0) {
    return {
      output: `No issues updated in the last ${days} day(s).`,
      isError: false,
    };
  }

  const lines = [`Recently updated issues (last ${days} day(s)) — ${issues.length} result(s):\n`];

  for (const issue of issues) {
    const key = issue.key;
    const summary = issue.fields?.summary || "No summary";
    const status = issue.fields?.status?.name || "Unknown";
    const assignee = issue.fields?.assignee?.displayName || "Unassigned";
    const issueType = issue.fields?.issuetype?.name || "Unknown";
    const updated = issue.fields?.updated
      ? new Date(issue.fields.updated).toLocaleString()
      : "Unknown";

    lines.push(`• [${key}] ${summary}`);
    lines.push(`  Type: ${issueType} | Status: ${status} | Assignee: ${assignee} | Updated: ${updated}`);
  }

  return { output: lines.join("\n"), isError: false };
}
