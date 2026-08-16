/**
 * Search for Jira issues using JQL (Jira Query Language)
 */

export default {
  schema: {
    name: "jira_search_issues",
    description: "Search for Jira issues using JQL (Jira Query Language). Examples: 'project = PROJ AND status = Open', 'assignee = currentUser() AND priority = High', 'created >= -7d ORDER BY created DESC'",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        jql_query: {
          type: "string",
          description: "JQL query string to search for issues",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return",
          default: 50,
        },
      },
      required: ["jql_query"],
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

    const jqlQuery = input.jql_query;
    const maxResults = input.max_results || 50;

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
          jql: jqlQuery,
          maxResults,
          fields: ["summary", "status", "priority", "issuetype", "assignee"],
        }),
      });

      if (!response.ok) {
        // Fall back to GET /rest/api/3/search for older Jira Server versions
        if (response.status === 404 || response.status === 405) {
          const fallback = await fetch(
            `${JIRA_URL}/rest/api/3/search?jql=${encodeURIComponent(jqlQuery)}&maxResults=${maxResults}`,
            { headers },
          );
          if (!fallback.ok) {
            const err = await fallback.text();
            return { output: `Jira API error (${fallback.status}): ${err}`, isError: true };
          }
          const data = await fallback.json();
          return formatIssues(data.issues || [], jqlQuery);
        }
        const errorText = await response.text();
        return { output: `Jira API error (${response.status}): ${errorText}`, isError: true };
      }

      const data = await response.json();
      return formatIssues(data.issues || [], jqlQuery);
    } catch (error) {
      return { output: `Error searching issues: ${error.message}`, isError: true };
    }
  },
};

function formatIssues(issues, jqlQuery) {
  if (issues.length === 0) {
    return { output: `No issues found matching query: ${jqlQuery}`, isError: false };
  }

  const lines = [`Found ${issues.length} issue(s) matching '${jqlQuery}':\n`];
  for (const issue of issues) {
    const key = issue.key;
    const summary = issue.fields?.summary || "No summary";
    const status = issue.fields?.status?.name || "Unknown";
    const priority = issue.fields?.priority?.name || "None";
    const issueType = issue.fields?.issuetype?.name || "Unknown";
    const assignee = issue.fields?.assignee?.displayName || "Unassigned";
    lines.push(
      `• [${key}] ${summary}\n` +
      `  Type: ${issueType} | Status: ${status} | Priority: ${priority} | Assignee: ${assignee}`,
    );
  }
  return { output: lines.join("\n"), isError: false };
}
