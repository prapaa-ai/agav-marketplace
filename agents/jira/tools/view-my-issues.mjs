/**
 * View all Jira issues assigned to the authenticated user
 */

export default {
  schema: {
    name: "jira_view_my_issues",
    description: "View all Jira issues assigned to me (the authenticated user), ordered by most recently updated",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "Maximum number of issues to return",
          default: 50,
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

    const maxResults = input.max_results || 50;
    const jql = `assignee = currentUser() ORDER BY updated DESC`;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      // Use POST /rest/api/3/search/jql (current Jira Cloud API)
      const response = await fetch(`${JIRA_URL}/rest/api/3/search/jql`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jql,
          maxResults,
          fields: ["summary", "status", "priority", "issuetype", "assignee"],
        }),
      });

      if (!response.ok) {
        // Fall back to GET /rest/api/3/search for older Jira Server versions
        if (response.status === 404 || response.status === 405) {
          const fallback = await fetch(
            `${JIRA_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`,
            { headers },
          );
          if (!fallback.ok) {
            const err = await fallback.text();
            return { output: `Jira API error (${fallback.status}): ${err}`, isError: true };
          }
          const data = await fallback.json();
          return formatIssues(data.issues || []);
        }
        const errorText = await response.text();
        return { output: `Jira API error (${response.status}): ${errorText}`, isError: true };
      }

      const data = await response.json();
      return formatIssues(data.issues || []);
    } catch (error) {
      return { output: `Error retrieving your issues: ${error.message}`, isError: true };
    }
  },
};

function formatIssues(issues) {
  if (issues.length === 0) {
    return { output: "No issues are currently assigned to you.", isError: false };
  }

  const lines = [`Found ${issues.length} issue(s) assigned to you:\n`];
  for (const issue of issues) {
    const key = issue.key;
    const summary = issue.fields?.summary || "No summary";
    const status = issue.fields?.status?.name || "Unknown";
    const priority = issue.fields?.priority?.name || "None";
    const issueType = issue.fields?.issuetype?.name || "Unknown";
    lines.push(
      `• [${key}] ${summary}\n` +
      `  Type: ${issueType} | Status: ${status} | Priority: ${priority}`,
    );
  }
  return { output: lines.join("\n"), isError: false };
}
