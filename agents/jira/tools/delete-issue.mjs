/**
 * Permanently delete a Jira issue
 */

export default {
  schema: {
    name: "jira_delete_issue",
    description: "Permanently delete a Jira issue. This action cannot be undone. Requires appropriate project permissions.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key to delete (e.g., PROJ-123)",
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

      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        if (response.status === 403) {
          return {
            output: `Permission denied: you do not have permission to delete [${issueKey}].`,
            isError: true,
          };
        }
        const errorText = await response.text();
        return {
          output: `Failed to delete [${issueKey}] (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      return {
        output: `Deleted [${issueKey}] successfully.`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error deleting issue: ${error.message}`,
        isError: true,
      };
    }
  },
};
